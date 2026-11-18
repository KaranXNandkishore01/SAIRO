import { dataStore, timingSafeEqualHex } from '../store/dataStore.js';

const BURN_GRACE_MS = 15_000;

export function createRoomRegistry() {
  // Map<roomHash, Map<socketId, { sessionId: string, joinedAt: number }>>
  const activeRooms = new Map();
  // Map<roomHash, Timeout>
  const burnTimers = new Map();

  return {
    cancelBurnTimer(roomHash) {
      const timer = burnTimers.get(roomHash);
      if (timer) {
        clearTimeout(timer);
        burnTimers.delete(roomHash);
      }
    },

    scheduleBurnTimer(roomHash, onBurn) {
      this.cancelBurnTimer(roomHash);
      const timer = setTimeout(async () => {
        burnTimers.delete(roomHash);
        if (this.getParticipantCount(roomHash) === 0) {
          await onBurn();
        }
      }, BURN_GRACE_MS);
      timer.unref?.();
      burnTimers.set(roomHash, timer);
    },

    hasSession(roomHash, sessionId) {
      if (!sessionId) return false;
      const roomMap = activeRooms.get(roomHash);
      if (!roomMap) return false;
      for (const info of roomMap.values()) {
        if (info.sessionId === sessionId) return true;
      }
      return false;
    },

    addParticipant(roomHash, socketId, sessionId) {
      this.cancelBurnTimer(roomHash);
      if (!activeRooms.has(roomHash)) {
        activeRooms.set(roomHash, new Map());
      }
      activeRooms.get(roomHash).set(socketId, { sessionId, joinedAt: Date.now() });
      return this.getSnapshot(roomHash);
    },

    removeParticipant(roomHash, socketId) {
      const roomMap = activeRooms.get(roomHash);
      if (!roomMap) return { participantCount: 0, remaining: 0 };
      roomMap.delete(socketId);
      const remaining = roomMap.size;
      if (remaining === 0) {
        activeRooms.delete(roomHash);
      }
      return { participantCount: this.getParticipantCount(roomHash), remaining };
    },

    getParticipantCount(roomHash) {
      const roomMap = activeRooms.get(roomHash);
      if (!roomMap) return 0;
      const uniqueSessions = new Set();
      for (const info of roomMap.values()) {
        uniqueSessions.add(info.sessionId);
      }
      return uniqueSessions.size;
    },

    getSnapshot(roomHash) {
      const roomMap = activeRooms.get(roomHash);
      if (!roomMap) return { participantCount: 0 };
      return { participantCount: this.getParticipantCount(roomHash) };
    },

    clearRoom(roomHash) {
      this.cancelBurnTimer(roomHash);
      activeRooms.delete(roomHash);
    },
  };
}

export function registerChatSocket(io, roomRegistry) {
  io.on('connection', (socket) => {
    let currentRoomHash = null;
    let currentSessionId = null;

    socket.on('room:join', async ({ roomHash, authVerifier, sessionId }, ack) => {
      try {
        if (!roomHash || !authVerifier || !sessionId) {
          return ack?.({ ok: false, error: 'Missing chat credentials.' });
        }

        const room = await dataStore.findRoomByHash(roomHash);
        if (!room || !timingSafeEqualHex(room.authVerifier, authVerifier)) {
          return ack?.({ ok: false, error: 'Invalid or expired chat.' });
        }

        const cleanSessionId = String(sessionId).slice(0, 64);

        // Leave any previously joined room on this socket
        if (currentRoomHash && currentRoomHash !== roomHash) {
          socket.leave(currentRoomHash);
          roomRegistry.removeParticipant(currentRoomHash, socket.id);
          io.to(currentRoomHash).emit('room:presence', roomRegistry.getSnapshot(currentRoomHash));
        }

        const existingCount = roomRegistry.getParticipantCount(roomHash);
        const alreadyInRoom = roomRegistry.hasSession(roomHash, cleanSessionId);

        // Allow reconnecting sessions even if room is at maxParticipants
        if (!alreadyInRoom && existingCount >= room.maxParticipants) {
          return ack?.({ ok: false, error: 'This chat is currently full.' });
        }

        currentRoomHash = roomHash;
        currentSessionId = cleanSessionId;
        socket.join(roomHash);

        const snapshot = roomRegistry.addParticipant(roomHash, socket.id, currentSessionId);
        io.to(roomHash).emit('room:presence', snapshot);

        if (!alreadyInRoom) {
          socket.to(roomHash).emit('room:peer-event', {
            type: 'joined',
            timestamp: Date.now(),
          });
        }

        return ack?.({ ok: true, ...snapshot });
      } catch (err) {
        console.error('[SOCKET] room:join error:', err);
        return ack?.({ ok: false, error: 'Failed to connect to chat.' });
      }
    });

    socket.on('message:send', async ({ iv, ciphertext }, ack) => {
      try {
        if (!currentRoomHash || !currentSessionId) {
          return ack?.({ ok: false, error: 'Not connected to a chat.' });
        }

        if (typeof iv !== 'string' || typeof ciphertext !== 'string') {
          return ack?.({ ok: false, error: 'Invalid message payload.' });
        }

        if (iv.length > 64 || ciphertext.length > 65536) {
          return ack?.({ ok: false, error: 'Message is too large.' });
        }

        const room = await dataStore.findRoomByHash(currentRoomHash);
        if (!room) {
          socket.emit('room:burned', { reason: 'This chat has expired or been deleted.' });
          return ack?.({ ok: false, error: 'Chat no longer exists.' });
        }

        const saved = await dataStore.createMessage({
          roomHash: currentRoomHash,
          iv,
          ciphertext,
          senderSessionId: currentSessionId,
          expiresAt: room.expiresAt,
        });

        const payload = {
          _id: saved._id,
          iv: saved.iv,
          ciphertext: saved.ciphertext,
          senderSessionId: saved.senderSessionId,
          createdAt: saved.createdAt,
        };

        io.to(currentRoomHash).emit('message:new', payload);
        return ack?.({ ok: true, message: payload });
      } catch (err) {
        console.error('[SOCKET] message:send error:', err);
        return ack?.({ ok: false, error: 'Unable to send message.' });
      }
    });

    socket.on('typing:start', () => {
      if (!currentRoomHash || !currentSessionId) return;
      socket.to(currentRoomHash).emit('typing:update', {
        sessionId: currentSessionId,
        isTyping: true,
      });
    });

    socket.on('typing:stop', () => {
      if (!currentRoomHash || !currentSessionId) return;
      socket.to(currentRoomHash).emit('typing:update', {
        sessionId: currentSessionId,
        isTyping: false,
      });
    });

    const handleLeave = async () => {
      if (!currentRoomHash) return;
      const roomHash = currentRoomHash;
      const sessionId = currentSessionId;
      currentRoomHash = null;
      currentSessionId = null;

      socket.leave(roomHash);
      socket.to(roomHash).emit('typing:update', {
        sessionId,
        isTyping: false,
      });

      const { participantCount, remaining } = roomRegistry.removeParticipant(roomHash, socket.id);
      io.to(roomHash).emit('room:presence', { participantCount });

      // Only announce leave if this session no longer has another active socket in the room
      if (!roomRegistry.hasSession(roomHash, sessionId)) {
        socket.to(roomHash).emit('room:peer-event', {
          type: 'left',
          timestamp: Date.now(),
        });
      }

      if (remaining === 0) {
        try {
          const room = await dataStore.findRoomByHash(roomHash);
          if (room?.burnWhenEmpty) {
            // Grace period prevents accidental deletion during brief reconnects or dev StrictMode remounts
            roomRegistry.scheduleBurnTimer(roomHash, async () => {
              try {
                await dataStore.deleteRoomByHash(roomHash);
                roomRegistry.clearRoom(roomHash);
              } catch (err) {
                console.error('[SOCKET] burnWhenEmpty cleanup error:', err);
              }
            });
          }
        } catch (err) {
          console.error('[SOCKET] burnWhenEmpty lookup error:', err);
        }
      }
    };

    socket.on('room:leave', handleLeave);
    socket.on('disconnect', handleLeave);
  });
}
