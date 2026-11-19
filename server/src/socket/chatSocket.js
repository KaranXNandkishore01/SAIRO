import crypto from 'crypto';
import { dataStore, timingSafeEqualHex } from '../store/dataStore.js';

// Short grace period so brief mobile reconnects don't wipe an active live chat,
// while still removing the room from MongoDB within seconds once everyone leaves.
const END_CLEANUP_GRACE_MS = 6_000;

export function createRoomRegistry() {
  // Map<roomHash, Map<socketId, { sessionId: string, joinedAt: number }>>
  const activeRooms = new Map();
  // Map<roomHash, Timeout>
  const cleanupTimers = new Map();

  return {
    cancelCleanupTimer(roomHash) {
      const timer = cleanupTimers.get(roomHash);
      if (timer) {
        clearTimeout(timer);
        cleanupTimers.delete(roomHash);
      }
    },

    scheduleCleanupTimer(roomHash, onCleanup) {
      this.cancelCleanupTimer(roomHash);
      const timer = setTimeout(async () => {
        cleanupTimers.delete(roomHash);
        if (this.getParticipantCount(roomHash) === 0) {
          await onCleanup();
        }
      }, END_CLEANUP_GRACE_MS);
      timer.unref?.();
      cleanupTimers.set(roomHash, timer);
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
      this.cancelCleanupTimer(roomHash);
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

    getSocketIdsBySession(roomHash, sessionId) {
      const roomMap = activeRooms.get(roomHash);
      if (!roomMap) return [];
      const ids = [];
      for (const [sockId, info] of roomMap.entries()) {
        if (info.sessionId === sessionId) ids.push(sockId);
      }
      return ids;
    },

    clearRoom(roomHash) {
      this.cancelCleanupTimer(roomHash);
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

        if (currentRoomHash && currentRoomHash !== roomHash) {
          socket.leave(currentRoomHash);
          roomRegistry.removeParticipant(currentRoomHash, socket.id);
          io.to(currentRoomHash).emit('room:presence', roomRegistry.getSnapshot(currentRoomHash));
        }

        const existingCount = roomRegistry.getParticipantCount(roomHash);
        const alreadyInRoom = roomRegistry.hasSession(roomHash, cleanSessionId);

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

    // Live-only relay: encrypted messages are NEVER stored in the database
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
          socket.emit('room:burned', { reason: 'This chat has ended.' });
          return ack?.({ ok: false, error: 'Chat no longer exists.' });
        }

        const payload = {
          _id: crypto.randomUUID(),
          iv,
          ciphertext,
          senderSessionId: currentSessionId,
          createdAt: new Date().toISOString(),
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

    // Zero-knowledge encrypted WebRTC call signalling relay
    socket.on('call:signal', ({ iv, ciphertext, targetSessionId }, ack) => {
      if (!currentRoomHash || !currentSessionId) {
        return ack?.({ ok: false, error: 'Not connected to chat.' });
      }
      if (typeof iv !== 'string' || typeof ciphertext !== 'string') {
        return ack?.({ ok: false, error: 'Invalid call signal.' });
      }
      if (iv.length > 64 || ciphertext.length > 65536) {
        return ack?.({ ok: false, error: 'Call signal payload too large.' });
      }

      const packet = {
        fromSessionId: currentSessionId,
        iv,
        ciphertext,
      };

      if (targetSessionId && typeof targetSessionId === 'string') {
        const targetSockets = roomRegistry.getSocketIdsBySession(
          currentRoomHash,
          targetSessionId
        );
        for (const sockId of targetSockets) {
          if (sockId !== socket.id) {
            io.to(sockId).emit('call:signal', packet);
          }
        }
      } else {
        socket.to(currentRoomHash).emit('call:signal', packet);
      }

      return ack?.({ ok: true });
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
      socket.to(roomHash).emit('call:peer-disconnected', {
        sessionId,
      });

      const { participantCount, remaining } = roomRegistry.removeParticipant(roomHash, socket.id);
      io.to(roomHash).emit('room:presence', { participantCount });

      if (!roomRegistry.hasSession(roomHash, sessionId)) {
        socket.to(roomHash).emit('room:peer-event', {
          type: 'left',
          timestamp: Date.now(),
        });
      }

      // When everyone has left, remove the room from MongoDB automatically
      if (remaining === 0) {
        roomRegistry.scheduleCleanupTimer(roomHash, async () => {
          try {
            await dataStore.deleteRoomByHash(roomHash);
            roomRegistry.clearRoom(roomHash);
          } catch (err) {
            console.error('[SOCKET] Room end cleanup error:', err);
          }
        });
      }
    };

    socket.on('room:leave', handleLeave);
    socket.on('disconnect', handleLeave);
  });
}
