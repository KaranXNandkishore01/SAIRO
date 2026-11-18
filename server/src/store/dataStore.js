import crypto from 'crypto';
import Room from '../models/Room.js';
import Message from '../models/Message.js';
import { isMongoConnected } from '../config/db.js';

// In-memory fallback collections (used only if MongoDB is unavailable locally)
const memRoomsByHash = new Map();
const memRoomsByPublicId = new Map();
const memMessagesByRoomHash = new Map();

function purgeExpiredMemory() {
  const now = Date.now();
  for (const [hash, room] of memRoomsByHash.entries()) {
    if (room.expiresAt.getTime() <= now) {
      memRoomsByHash.delete(hash);
      memRoomsByPublicId.delete(room.publicId);
      memMessagesByRoomHash.delete(hash);
    }
  }
}

// Run periodic cleanup for in-memory fallback
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
  async createRoom({ roomHash, authVerifier, salt, maxParticipants, burnWhenEmpty, expiresAt }) {
    const publicId = generatePublicId();

    if (isMongoConnected()) {
      // Remove any expired room with the same roomHash that MongoDB's 60s TTL sweep hasn't deleted yet
      await Room.deleteOne({ roomHash, expiresAt: { $lte: new Date() } });

      const doc = await Room.create({
        publicId,
        roomHash,
        authVerifier,
        salt,
        maxParticipants,
        burnWhenEmpty,
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
      burnWhenEmpty,
      expiresAt,
      createdAt: new Date(),
    };
    memRoomsByHash.set(roomHash, room);
    memRoomsByPublicId.set(publicId, room);
    memMessagesByRoomHash.set(roomHash, []);
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

  async createMessage({ roomHash, iv, ciphertext, senderSessionId, expiresAt }) {
    if (isMongoConnected()) {
      const doc = await Message.create({
        roomHash,
        iv,
        ciphertext,
        senderSessionId,
        expiresAt,
      });
      return doc.toObject();
    }

    purgeExpiredMemory();
    const msg = {
      _id: crypto.randomUUID(),
      roomHash,
      iv,
      ciphertext,
      senderSessionId,
      expiresAt,
      createdAt: new Date(),
    };
    const list = memMessagesByRoomHash.get(roomHash) || [];
    list.push(msg);
    // Cap in-memory history per room at 500 messages
    if (list.length > 500) list.shift();
    memMessagesByRoomHash.set(roomHash, list);
    return msg;
  },

  async getMessagesByRoomHash(roomHash, limit = 200) {
    if (isMongoConnected()) {
      const msgs = await Message.find({
        roomHash,
        expiresAt: { $gt: new Date() },
      })
        .sort({ createdAt: 1 })
        .limit(limit)
        .select('_id iv ciphertext senderSessionId createdAt')
        .lean();
      return msgs;
    }

    purgeExpiredMemory();
    const list = memMessagesByRoomHash.get(roomHash) || [];
    return list.slice(-limit).map(({ _id, iv, ciphertext, senderSessionId, createdAt }) => ({
      _id,
      iv,
      ciphertext,
      senderSessionId,
      createdAt,
    }));
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
    memMessagesByRoomHash.delete(roomHash);
    return true;
  },
};
