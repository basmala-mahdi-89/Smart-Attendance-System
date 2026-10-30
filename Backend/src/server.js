const express = require('express');
const cors = require('cors');
const http = require('http');
const os = require('os');
const { initSocket } = require('./config/socket');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: true, // ⚡ بيسمح لأي IP محلي أو تونيل إنه يتصل
  credentials: true
}));
app.use(express.json());

// Routes
const authRoutes = require('./routes/authRoutes');
const deanRoutes = require('./routes/deanRoutes');
const invitationsRoutes = require('./routes/invitationsRoutes');
const headRoutes = require('./routes/headRoutes');
const studentRoutes = require('./routes/studentRoutes');
const doctorRoutes = require('./routes/doctorRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/dean', deanRoutes);
app.use('/api/invitations', invitationsRoutes);
app.use('/api/head', headRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/doctor', doctorRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Smart Attendance System API is running 🚀' });
});

const io = initSocket(server);
app.set('io', io);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔌 Socket.IO ready`);
  
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`📱 Network: https://${iface.address}:5173`); // ⚡ كتبنا https عشان الكاميرا
      }
    }
  }
});

require('./config/db');