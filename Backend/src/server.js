const express = require('express');
const cors = require('cors');
const http = require('http');
const { initSocket } = require('./config/socket');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: ['http://localhost:5173', 'http://10.63.109.109:5173'],
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
app.use('/api/dean', require('./routes/deanRoutes'));
app.use('/api/invitations', invitationsRoutes);
app.use('/api/head', headRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/doctor', doctorRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Smart Attendance System API is running 🚀' });
});

// Initialize Socket.IO
initSocket(server);

// Start Server
const os = require('os');

function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push({ name, address: iface.address });
      }
    }
  }
  return ips;
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔌 Socket.IO ready`);
  console.log(`📱 Available network IPs:`);
  const ips = getLocalIPs();
  ips.forEach(ip => console.log(`   - ${ip.name}: http://${ip.address}:${PORT}`));
});

function getLocalIP() {
  const os = require('os');
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}
require('./config/db');