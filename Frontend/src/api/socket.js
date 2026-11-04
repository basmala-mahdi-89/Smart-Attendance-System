import { io } from 'socket.io-client'; // ⚡ لاحظ -client هنا

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin; // ⚡ في الإنتاج يقرأ من متغير VITE_SOCKET_URL

let socket = null;

export function connectSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      path: '/socket.io',
      transports: ['polling', 'websocket']
    });

    socket.on('connect', () => console.log('🔌 Socket Connected:', socket.id));
    socket.on('disconnect', () => console.log('❌ Socket Disconnected'));
  }
  return socket;
}

export function getSocket() { return socket; }
export function disconnectSocket() {
  if (socket) { socket.disconnect(); socket = null; }
}