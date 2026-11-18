import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { Server as SocketIOServer } from 'socket.io';
import { connectDatabase, isMongoConnected } from './config/db.js';
import { dataStore } from './store/dataStore.js';
import { createRoomRouter } from './routes/rooms.js';
import { createRoomRegistry, registerChatSocket } from './socket/chatSocket.js';

const PORT = Number(process.env.PORT) || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '';
const IS_PROD = process.env.NODE_ENV === 'production';

const app = express();
// Trust first reverse proxy (Render, Railway, Nginx) so rate limiter sees real client IPs
app.set('trust proxy', 1);

const server = http.createServer(app);

const defaultOrigins = ['http://localhost:5173', 'https://thesairo.vercel.app'];
const envOrigins = CLIENT_ORIGIN.split(',')
  .map((s) => s.trim().replace(/^["']|["']$/g, '').replace(/\/+$/, ''))
  .filter(Boolean);
const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

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
  return callback(null, false);
};

const corsOptions = {
  origin: corsOriginHandler,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-auth-verifier'],
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
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '100kb' }));

app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'SAIRO E2EE Chat API',
    health: '/api/health',
  });
});

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
  await dataStore.purgeLegacyMessages();
  server.listen(PORT, () => {
    console.log(`[SAIRO SERVER] Listening on http://localhost:${PORT}`);
    console.log(`[SAIRO SERVER] Allowed client origins: ${allowedOrigins.join(', ')}`);
  });
}

bootstrap();
