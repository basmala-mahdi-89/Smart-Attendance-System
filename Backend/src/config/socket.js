const { Server } = require('socket.io');

let io = null;

function initSocket(server) {
  io = new Server(server, {
cors: {
  origin: ['http://localhost:5173', 'http://10.63.109.109:5173'],
  methods: ['GET', 'POST'],
  credentials: true
}
  });

  io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);

    socket.on('join-session', (sessionId) => {
      socket.join(`session-${sessionId}`);
      console.log(`✅ ${socket.id} joined session-${sessionId}`);
    });

    socket.on('leave-session', (sessionId) => {
      socket.leave(`session-${sessionId}`);
      console.log(`👋 ${socket.id} left session-${sessionId}`);
    });

    socket.on('disconnect', () => {
      console.log('❌ Client disconnected:', socket.id);
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
}

module.exports = { initSocket, getIO };