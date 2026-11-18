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

const app = express();
const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: CLIENT_ORIGIN.split(',').map((s) => s.trim()),
    methods: ['GET', 'POST', 'DELETE'],
  },
  maxHttpBufferSize: 1e5, // 100KB max packet
});

const roomRegistry = createRoomRegistry();

app.use(helmet());
app.use(
  cors({
    origin: CLIENT_ORIGIN.split(',').map((s) => s.trim()),
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
    console.log(`[SAIRO SERVER] Allowed client origin: ${CLIENT_ORIGIN}`);
  });
}

bootstrap();
