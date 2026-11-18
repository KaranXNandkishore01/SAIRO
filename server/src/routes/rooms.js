import express from 'express';
import { dataStore, timingSafeEqualHex } from '../store/dataStore.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';

const HEX_64_RE = /^[a-f0-9]{64}$/i;
const HEX_32_RE = /^[a-f0-9]{32}$/i;

export function createRoomRouter(io, roomRegistry) {
  const router = express.Router();

  const authLimiter = createRateLimiter({
    windowMs: 60_000,
    max: 60,
    message: 'Too many attempts. Please wait a minute and try again.',
  });

  const createLimiter = createRateLimiter({
    windowMs: 60_000,
    max: 60,
    message: 'Too many chats started in a short time. Please wait a moment.',
  });

  // POST /api/rooms — Create a zero-knowledge encrypted room (or seamlessly enter if already exists with matching passcode)
  router.post('/', createLimiter, async (req, res) => {
    try {
      const {
        roomHash,
        authVerifier,
        salt,
        ttlMinutes = 120,
        maxParticipants = 10,
        sessionId,
      } = req.body || {};

      if (!HEX_64_RE.test(roomHash) || !HEX_64_RE.test(authVerifier) || !HEX_32_RE.test(salt)) {
        return res.status(400).json({ error: 'Invalid passcode details. Please try again.' });
      }

      const clampedTtl = Math.min(Math.max(Number(ttlMinutes) || 120, 15), 1440);
      const clampedMax = Math.min(Math.max(Number(maxParticipants) || 10, 2), 25);
      const expiresAt = new Date(Date.now() + clampedTtl * 60 * 1000);

      // If an active room already exists for this exact passcode, seamlessly connect to it
      // instead of rejecting the user (as long as capacity allows or same session is reconnecting).
      const existing = await dataStore.findRoomByHash(roomHash);
      if (existing && timingSafeEqualHex(existing.authVerifier, authVerifier)) {
        const activeCount = roomRegistry.getParticipantCount(existing.roomHash);
        const alreadyIn = sessionId && roomRegistry.hasSession(existing.roomHash, sessionId);

        if (!alreadyIn && activeCount >= existing.maxParticipants) {
          return res.status(409).json({
            error: 'A chat with this passcode is already full. Please choose a different passcode.',
          });
        }

        return res.status(200).json({
          publicId: existing.publicId,
          roomHash: existing.roomHash,
          salt: existing.salt,
          maxParticipants: existing.maxParticipants,
          burnWhenEmpty: true,
          expiresAt: existing.expiresAt,
          createdAt: existing.createdAt,
          reused: true,
        });
      }

      const room = await dataStore.createRoom({
        roomHash,
        authVerifier,
        salt,
        maxParticipants: clampedMax,
        burnWhenEmpty: true,
        expiresAt,
      });

      return res.status(201).json({
        publicId: room.publicId,
        roomHash: room.roomHash,
        salt: room.salt,
        maxParticipants: room.maxParticipants,
        burnWhenEmpty: room.burnWhenEmpty,
        expiresAt: room.expiresAt,
        createdAt: room.createdAt,
      });
    } catch (err) {
      if (err?.code === 11000) {
        // Race condition: two users clicked Create with the same passcode at the exact same moment
        try {
          const { roomHash, authVerifier } = req.body || {};
          const existing = await dataStore.findRoomByHash(roomHash);
          if (existing && timingSafeEqualHex(existing.authVerifier, authVerifier)) {
            return res.status(200).json({
              publicId: existing.publicId,
              roomHash: existing.roomHash,
              salt: existing.salt,
              maxParticipants: existing.maxParticipants,
              burnWhenEmpty: existing.burnWhenEmpty,
              expiresAt: existing.expiresAt,
              createdAt: existing.createdAt,
              reused: true,
            });
          }
        } catch {}
        return res.status(409).json({
          error: 'A chat with this passcode already exists. Please try another passcode.',
        });
      }
      console.error('[ROOMS] Create error:', err);
      return res.status(500).json({ error: 'Unable to start chat right now. Please try again.' });
    }
  });

  // POST /api/rooms/join — Join directly by entering the secret passcode
  router.post('/join', authLimiter, async (req, res) => {
    try {
      const { roomHash, authVerifier, sessionId } = req.body || {};

      if (!HEX_64_RE.test(roomHash) || !HEX_64_RE.test(authVerifier)) {
        return res.status(400).json({ error: 'Invalid passcode.' });
      }

      const room = await dataStore.findRoomByHash(roomHash);
      if (!room || !timingSafeEqualHex(room.authVerifier, authVerifier)) {
        return res.status(404).json({
          error: 'No active chat matches that secret passcode.',
        });
      }

      const activeCount = roomRegistry.getParticipantCount(room.roomHash);
      const alreadyIn = sessionId && roomRegistry.hasSession(room.roomHash, sessionId);
      if (!alreadyIn && activeCount >= room.maxParticipants) {
        return res.status(403).json({
          error: 'This chat is currently full.',
        });
      }

      return res.json({
        publicId: room.publicId,
        roomHash: room.roomHash,
        salt: room.salt,
        maxParticipants: room.maxParticipants,
        burnWhenEmpty: room.burnWhenEmpty,
        expiresAt: room.expiresAt,
        createdAt: room.createdAt,
        activeCount,
      });
    } catch (err) {
      console.error('[ROOMS] Join error:', err);
      return res.status(500).json({ error: 'Unable to verify secret passcode.' });
    }
  });

  // GET /api/rooms/:publicId/meta — Check whether an invite link points to a live room
  router.get('/:publicId/meta', async (req, res) => {
    try {
      const { publicId } = req.params;
      const room = await dataStore.findRoomByPublicId(publicId);
      if (!room) {
        return res.status(404).json({
          exists: false,
          error: 'This chat does not exist or has expired.',
        });
      }

      return res.json({
        exists: true,
        publicId: room.publicId,
        maxParticipants: room.maxParticipants,
        activeCount: roomRegistry.getParticipantCount(room.roomHash),
        expiresAt: room.expiresAt,
      });
    } catch (err) {
      console.error('[ROOMS] Meta error:', err);
      return res.status(500).json({ error: 'Unable to check chat status.' });
    }
  });

  // POST /api/rooms/:publicId/verify — Unlock a specific room link with its secret passcode
  router.post('/:publicId/verify', authLimiter, async (req, res) => {
    try {
      const { publicId } = req.params;
      const { roomHash, authVerifier, sessionId } = req.body || {};

      if (!HEX_64_RE.test(roomHash) || !HEX_64_RE.test(authVerifier)) {
        return res.status(400).json({ error: 'Invalid passcode.' });
      }

      const room = await dataStore.findRoomByPublicId(publicId);
      if (!room) {
        return res.status(404).json({ error: 'This chat no longer exists.' });
      }

      const hashMatches = timingSafeEqualHex(room.roomHash, roomHash);
      const verifierMatches = timingSafeEqualHex(room.authVerifier, authVerifier);

      if (!hashMatches || !verifierMatches) {
        return res.status(401).json({
          error: 'Incorrect secret passcode for this chat.',
        });
      }

      const activeCount = roomRegistry.getParticipantCount(room.roomHash);
      const alreadyIn = sessionId && roomRegistry.hasSession(room.roomHash, sessionId);
      if (!alreadyIn && activeCount >= room.maxParticipants) {
        return res.status(403).json({
          error: 'This chat is currently full.',
        });
      }

      return res.json({
        publicId: room.publicId,
        roomHash: room.roomHash,
        salt: room.salt,
        maxParticipants: room.maxParticipants,
        burnWhenEmpty: room.burnWhenEmpty,
        expiresAt: room.expiresAt,
        createdAt: room.createdAt,
        activeCount,
      });
    } catch (err) {
      console.error('[ROOMS] Verify error:', err);
      return res.status(500).json({ error: 'Unable to verify passcode.' });
    }
  });

  // GET /api/rooms/:roomHash/messages — Fetch ciphertext history (verifier required)
  router.get('/:roomHash/messages', async (req, res) => {
    try {
      const { roomHash } = req.params;
      const authVerifier = req.headers['x-auth-verifier'];

      if (!HEX_64_RE.test(roomHash) || !HEX_64_RE.test(String(authVerifier || ''))) {
        return res.status(401).json({ error: 'Authorisation required.' });
      }

      const room = await dataStore.findRoomByHash(roomHash);
      if (!room || !timingSafeEqualHex(room.authVerifier, String(authVerifier))) {
        return res.status(401).json({ error: 'Unauthorised access.' });
      }

      const messages = await dataStore.getMessagesByRoomHash(roomHash);
      return res.json({ messages });
    } catch (err) {
      console.error('[ROOMS] Messages error:', err);
      return res.status(500).json({ error: 'Unable to load messages.' });
    }
  });

  // DELETE /api/rooms/:roomHash — Delete room & wipe all ciphertexts immediately
  router.delete('/:roomHash', async (req, res) => {
    try {
      const { roomHash } = req.params;
      const authVerifier = req.headers['x-auth-verifier'];

      if (!HEX_64_RE.test(roomHash) || !HEX_64_RE.test(String(authVerifier || ''))) {
        return res.status(401).json({ error: 'Unauthorised.' });
      }

      const room = await dataStore.findRoomByHash(roomHash);
      if (!room || !timingSafeEqualHex(room.authVerifier, String(authVerifier))) {
        return res.status(401).json({ error: 'Unauthorised.' });
      }

      await dataStore.deleteRoomByHash(roomHash);
      io.to(roomHash).emit('room:burned', {
        reason: 'This chat has been deleted.',
      });
      io.in(roomHash).socketsLeave(roomHash);
      roomRegistry.clearRoom(roomHash);

      return res.json({ burned: true });
    } catch (err) {
      console.error('[ROOMS] Delete error:', err);
      return res.status(500).json({ error: 'Unable to delete chat.' });
    }
  });

  return router;
}
