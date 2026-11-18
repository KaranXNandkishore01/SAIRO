import { io } from 'socket.io-client';

const SOCKET_URL = (import.meta.env.VITE_SERVER_URL || '').replace(/\/+$/, '') || undefined;

export function createChatSocket() {
  return io(SOCKET_URL, {
    transports: ['polling', 'websocket'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 15,
    reconnectionDelay: 1000,
    timeout: 15000,
  });
}
