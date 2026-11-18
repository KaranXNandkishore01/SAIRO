import mongoose from 'mongoose';

let mongoConnected = false;

export function isMongoConnected() {
  return mongoConnected && mongoose.connection.readyState === 1;
}

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sairo_e2ee_chat';

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 3000,
    });
    mongoConnected = true;
    console.log(`[SAIRO DB] Connected to MongoDB (${uri})`);

    mongoose.connection.on('disconnected', () => {
      mongoConnected = false;
      console.warn('[SAIRO DB] MongoDB disconnected.');
    });

    mongoose.connection.on('reconnected', () => {
      mongoConnected = true;
      console.log('[SAIRO DB] MongoDB reconnected.');
    });
  } catch (err) {
    mongoConnected = false;
    console.warn(
      `[SAIRO DB] MongoDB not reachable at ${uri} (${err.message}).\n` +
        `[SAIRO DB] Running with ephemeral in-memory store fallback so you can test immediately.\n` +
        `[SAIRO DB] Start MongoDB or set MONGODB_URI in server/.env for persistent MongoDB storage.`
    );
  }
}
