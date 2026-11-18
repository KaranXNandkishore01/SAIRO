import { dataStore, timingSafeEqualHex } from '../store/dataStore.js';

export function createRoomRegistry() {
  // Map<roomHash, Map<socketId, { sessionId: string, joinedAt: number }>>
  const activeRooms = new Map();

  return {
    addParticipant(roomHash, socketId, sessionId) {
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
      // Count distinct ephemeral sessionIds (handles brief reconnects cleanly)
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
          return ack?.({ ok: false, error: 'Missing room credentials.' });
        }

        const room = await dataStore.findRoomByHash(roomHash);
        if (!room || !timingSafeEqualHex(room.authVerifier, authVerifier)) {
          return ack?.({ ok: false, error: 'Invalid or expired room.' });
        }

        // Leave any previously joined room on this socket
        if (currentRoomHash && currentRoomHash !== roomHash) {
          socket.leave(currentRoomHash);
          roomRegistry.removeParticipant(currentRoomHash, socket.id);
          io.to(currentRoomHash).emit('room:presence', roomRegistry.getSnapshot(currentRoomHash));
        }

        const existingCount = roomRegistry.getParticipantCount(roomHash);
        // Check capacity (allow if same session is reconnecting)
        if (existingCount >= room.maxParticipants) {
          return ack?.({ ok: false, error: 'Room is currently full.' });
        }

        currentRoomHash = roomHash;
        currentSessionId = String(sessionId).slice(0, 64);
        socket.join(roomHash);

        const snapshot = roomRegistry.addParticipant(roomHash, socket.id, currentSessionId);
        io.to(roomHash).emit('room:presence', snapshot);
        socket.to(roomHash).emit('room:peer-event', {
          type: 'joined',
          timestamp: Date.now(),
        });

        return ack?.({ ok: true, ...snapshot });
      } catch (err) {
        console.error('[SOCKET] room:join error:', err);
        return ack?.({ ok: false, error: 'Failed to connect to room.' });
      }
    });

    socket.on('message:send', async ({ iv, ciphertext }, ack) => {
      try {
        if (!currentRoomHash || !currentSessionId) {
          return ack?.({ ok: false, error: 'Not connected to an encrypted room.' });
        }

        if (typeof iv !== 'string' || typeof ciphertext !== 'string') {
          return ack?.({ ok: false, error: 'Invalid encrypted payload.' });
        }

        // Guard against oversized payloads (max ~64KB encrypted)
        if (iv.length > 64 || ciphertext.length > 65536) {
          return ack?.({ ok: false, error: 'Message exceeds maximum encrypted size.' });
        }

        const room = await dataStore.findRoomByHash(currentRoomHash);
        if (!room) {
          socket.emit('room:burned', { reason: 'This room has expired or been dissolved.' });
          return ack?.({ ok: false, error: 'Room no longer exists.' });
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
        return ack?.({ ok: false, error: 'Unable to deliver encrypted message.' });
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
      socket.to(roomHash).emit('room:peer-event', {
        type: 'left',
        timestamp: Date.now(),
      });

      if (remaining === 0) {
        try {
          const room = await dataStore.findRoomByHash(roomHash);
          if (room?.burnWhenEmpty) {
            await dataStore.deleteRoomByHash(roomHash);
            roomRegistry.clearRoom(roomHash);
          }
        } catch (err) {
          console.error('[SOCKET] burnWhenEmpty cleanup error:', err);
        }
      }
    };

    socket.on('room:leave', handleLeave);
    socket.on('disconnect', handleLeave);
  });
}
