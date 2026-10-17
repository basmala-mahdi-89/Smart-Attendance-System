const express = require('express');
const cors = require('cors');
const http = require('http');
const { initSocket } = require('./config/socket');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

app.use(cors());
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

// Initialize Socket.IO
initSocket(server);

// Start Server
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔌 Socket.IO ready`);
});

require('./config/db');