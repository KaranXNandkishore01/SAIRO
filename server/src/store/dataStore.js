import crypto from 'crypto';
import Room from '../models/Room.js';
import Message from '../models/Message.js';
import { isMongoConnected } from '../config/db.js';

// In-memory fallback collection (used only if MongoDB is unavailable locally)
const memRoomsByHash = new Map();
const memRoomsByPublicId = new Map();

function purgeExpiredMemory() {
  const now = Date.now();
  for (const [hash, room] of memRoomsByHash.entries()) {
    if (room.expiresAt.getTime() <= now) {
      memRoomsByHash.delete(hash);
      memRoomsByPublicId.delete(room.publicId);
    }
  }
}

setInterval(purgeExpiredMemory, 60 * 1000).unref();

export function timingSafeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function generatePublicId() {
  return crypto.randomBytes(6).toString('base64url');
}

export const dataStore = {
  async purgeLegacyMessages() {
    if (isMongoConnected()) {
      try {
        await Message.deleteMany({});
      } catch (err) {
        console.warn('[SAIRO DB] Could not purge legacy messages:', err.message);
      }
    }
  },

  async createRoom({ roomHash, authVerifier, salt, maxParticipants, burnWhenEmpty = true, expiresAt }) {
    const publicId = generatePublicId();

    if (isMongoConnected()) {
      await Room.deleteOne({ roomHash, expiresAt: { $lte: new Date() } });

      const doc = await Room.create({
        publicId,
        roomHash,
        authVerifier,
        salt,
        maxParticipants,
        burnWhenEmpty: Boolean(burnWhenEmpty),
        expiresAt,
      });
      return doc.toObject();
    }

    purgeExpiredMemory();
    if (memRoomsByHash.has(roomHash)) {
      const err = new Error('Room already exists');
      err.code = 11000;
      throw err;
    }

    const room = {
      _id: crypto.randomUUID(),
      publicId,
      roomHash,
      authVerifier,
      salt,
      maxParticipants,
      burnWhenEmpty: Boolean(burnWhenEmpty),
      expiresAt,
      createdAt: new Date(),
    };
    memRoomsByHash.set(roomHash, room);
    memRoomsByPublicId.set(publicId, room);
    return room;
  },

  async findRoomByHash(roomHash) {
    if (isMongoConnected()) {
      const room = await Room.findOne({
        roomHash,
        expiresAt: { $gt: new Date() },
      }).lean();
      return room;
    }

    purgeExpiredMemory();
    const room = memRoomsByHash.get(roomHash);
    if (!room || room.expiresAt.getTime() <= Date.now()) return null;
    return room;
  },

  async findRoomByPublicId(publicId) {
    if (isMongoConnected()) {
      const room = await Room.findOne({
        publicId,
        expiresAt: { $gt: new Date() },
      }).lean();
      return room;
    }

    purgeExpiredMemory();
    const room = memRoomsByPublicId.get(publicId);
    if (!room || room.expiresAt.getTime() <= Date.now()) return null;
    return room;
  },

  // Live-only mode: messages are never saved to the database
  async getMessagesByRoomHash() {
    return [];
  },

  async deleteRoomByHash(roomHash) {
    if (isMongoConnected()) {
      await Promise.all([
        Room.deleteOne({ roomHash }),
        Message.deleteMany({ roomHash }),
      ]);
      return true;
    }

    const room = memRoomsByHash.get(roomHash);
    if (room) {
      memRoomsByPublicId.delete(room.publicId);
    }
    memRoomsByHash.delete(roomHash);
    return true;
  },
};
