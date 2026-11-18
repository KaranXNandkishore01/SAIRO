import { io } from 'socket.io-client';

const SOCKET_URL = (import.meta.env.VITE_SERVER_URL || '').replace(/\/+$/, '') || undefined;

export function createChatSocket() {
  return io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });
}
