import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io('http://127.0.0.1:4000', { path: '/socket.io' });
  }
  return socket;
}
