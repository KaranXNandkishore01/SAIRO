import express from 'express';
import { dataStore, timingSafeEqualHex } from '../store/dataStore.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';

const HEX_64_RE = /^[a-f0-9]{64}$/i;
const HEX_32_RE = /^[a-f0-9]{32}$/i;

export function createRoomRouter(io, roomRegistry) {
  const router = express.Router();

  const authLimiter = createRateLimiter({
    windowMs: 60_000,
    max: 25,
    message: 'Too many attempts. Please wait a minute and try again.',
  });

  const createLimiter = createRateLimiter({
    windowMs: 60_000,
    max: 15,
    message: 'Room creation limit reached. Please wait a moment.',
  });

  // POST /api/rooms — Create a zero-knowledge encrypted room
  router.post('/', createLimiter, async (req, res) => {
    try {
      const {
        roomHash,
        authVerifier,
        salt,
        ttlMinutes = 1440,
        maxParticipants = 10,
        burnWhenEmpty = false,
      } = req.body || {};

      if (!HEX_64_RE.test(roomHash) || !HEX_64_RE.test(authVerifier) || !HEX_32_RE.test(salt)) {
        return res.status(400).json({ error: 'Invalid cryptographic room parameters.' });
      }

      const clampedTtl = Math.min(Math.max(Number(ttlMinutes) || 1440, 15), 10080); // 15m to 7d
      const clampedMax = Math.min(Math.max(Number(maxParticipants) || 10, 2), 25);
      const expiresAt = new Date(Date.now() + clampedTtl * 60 * 1000);

      const existing = await dataStore.findRoomByHash(roomHash);
      if (existing) {
        return res.status(409).json({
          error: 'A room with this exact secret passcode already exists. Choose a more unique passcode or switch to Join.',
        });
      }

      const room = await dataStore.createRoom({
        roomHash,
        authVerifier,
        salt,
        maxParticipants: clampedMax,
        burnWhenEmpty: Boolean(burnWhenEmpty),
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
        return res.status(409).json({
          error: 'A room with this exact secret passcode already exists. Please try another passcode.',
        });
      }
      console.error('[ROOMS] Create error:', err);
      return res.status(500).json({ error: 'Unable to create encrypted room right now.' });
    }
  });

  // POST /api/rooms/join — Join directly by entering the secret passcode
  router.post('/join', authLimiter, async (req, res) => {
    try {
      const { roomHash, authVerifier } = req.body || {};

      if (!HEX_64_RE.test(roomHash) || !HEX_64_RE.test(authVerifier)) {
        return res.status(400).json({ error: 'Invalid passcode proof.' });
      }

      const room = await dataStore.findRoomByHash(roomHash);
      if (!room || !timingSafeEqualHex(room.authVerifier, authVerifier)) {
        return res.status(404).json({
          error: 'No active encrypted room matches that secret passcode.',
        });
      }

      const activeCount = roomRegistry.getParticipantCount(room.roomHash);
      if (activeCount >= room.maxParticipants) {
        return res.status(403).json({
          error: 'This room has reached its maximum participant capacity.',
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
          error: 'This encrypted room does not exist or has vanished.',
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
      return res.status(500).json({ error: 'Unable to check room status.' });
    }
  });

  // POST /api/rooms/:publicId/verify — Unlock a specific room link with its secret passcode
  router.post('/:publicId/verify', authLimiter, async (req, res) => {
    try {
      const { publicId } = req.params;
      const { roomHash, authVerifier } = req.body || {};

      if (!HEX_64_RE.test(roomHash) || !HEX_64_RE.test(authVerifier)) {
        return res.status(400).json({ error: 'Invalid passcode proof.' });
      }

      const room = await dataStore.findRoomByPublicId(publicId);
      if (!room) {
        return res.status(404).json({ error: 'This encrypted room no longer exists.' });
      }

      const hashMatches = timingSafeEqualHex(room.roomHash, roomHash);
      const verifierMatches = timingSafeEqualHex(room.authVerifier, authVerifier);

      if (!hashMatches || !verifierMatches) {
        return res.status(401).json({
          error: 'Incorrect secret passcode for this room.',
        });
      }

      const activeCount = roomRegistry.getParticipantCount(room.roomHash);
      if (activeCount >= room.maxParticipants) {
        return res.status(403).json({
          error: 'This room has reached its maximum participant capacity.',
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
        return res.status(401).json({ error: 'Missing or invalid room authorization.' });
      }

      const room = await dataStore.findRoomByHash(roomHash);
      if (!room || !timingSafeEqualHex(room.authVerifier, String(authVerifier))) {
        return res.status(401).json({ error: 'Unauthorized room access.' });
      }

      const messages = await dataStore.getMessagesByRoomHash(roomHash);
      return res.json({ messages });
    } catch (err) {
      console.error('[ROOMS] Messages error:', err);
      return res.status(500).json({ error: 'Unable to load encrypted messages.' });
    }
  });

  // DELETE /api/rooms/:roomHash — Burn room & wipe all ciphertexts immediately
  router.delete('/:roomHash', async (req, res) => {
    try {
      const { roomHash } = req.params;
      const authVerifier = req.headers['x-auth-verifier'];

      if (!HEX_64_RE.test(roomHash) || !HEX_64_RE.test(String(authVerifier || ''))) {
        return res.status(401).json({ error: 'Unauthorized.' });
      }

      const room = await dataStore.findRoomByHash(roomHash);
      if (!room || !timingSafeEqualHex(room.authVerifier, String(authVerifier))) {
        return res.status(401).json({ error: 'Unauthorized.' });
      }

      await dataStore.deleteRoomByHash(roomHash);
      io.to(roomHash).emit('room:burned', {
        reason: 'A participant dissolved this room and wiped all encrypted messages.',
      });
      io.in(roomHash).socketsLeave(roomHash);
      roomRegistry.clearRoom(roomHash);

      return res.json({ burned: true });
    } catch (err) {
      console.error('[ROOMS] Burn error:', err);
      return res.status(500).json({ error: 'Unable to burn room.' });
    }
  });

  return router;
}
