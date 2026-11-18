import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Server as SocketIOServer } from 'socket.io';
import { connectDatabase, isMongoConnected } from './config/db.js';
import { createRoomRouter } from './routes/rooms.js';
import { createRoomRegistry, registerChatSocket } from './socket/chatSocket.js';

const PORT = Number(process.env.PORT) || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const IS_PROD = process.env.NODE_ENV === 'production';

const app = express();
// Trust first reverse proxy (Render, Railway, Nginx) so rate limiter sees real client IPs
app.set('trust proxy', 1);

const server = http.createServer(app);

const allowedOrigins = CLIENT_ORIGIN.split(',')
  .map((s) => s.trim().replace(/\/+$/, ''))
  .filter(Boolean);

function isOriginAllowed(origin) {
  if (!origin) return true; // Same-origin or server-to-server requests
  const clean = origin.replace(/\/+$/, '');
  if (allowedOrigins.includes('*') || allowedOrigins.includes(clean)) return true;
  if (!IS_PROD && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(clean)) {
    return true;
  }
  return false;
}

const corsOriginHandler = (origin, callback) => {
  if (isOriginAllowed(origin)) {
    return callback(null, true);
  }
  return callback(new Error(`CORS blocked for origin: ${origin}`));
};

const io = new SocketIOServer(server, {
  cors: {
    origin: corsOriginHandler,
    methods: ['GET', 'POST', 'DELETE'],
  },
  maxHttpBufferSize: 1e5, // 100KB max packet
});

const roomRegistry = createRoomRegistry();

app.use(helmet());
app.use(
  cors({
    origin: corsOriginHandler,
  })
);
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'sairo-e2ee-chat',
    storage: isMongoConnected() ? 'mongodb' : 'memory-fallback',
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/rooms', createRoomRouter(io, roomRegistry));

registerChatSocket(io, roomRegistry);

async function bootstrap() {
  await connectDatabase();
  server.listen(PORT, () => {
    console.log(`[SAIRO SERVER] Listening on http://localhost:${PORT}`);
    console.log(`[SAIRO SERVER] Allowed client origins: ${allowedOrigins.join(', ')}`);
  });
}

bootstrap();
