const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require('./routes/authRoutes');
const deanRoutes = require('./routes/deanRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/dean', deanRoutes);

app.get('/', (req, res) => {
  res.json({ message: 'Smart Attendance System API is running 🚀' });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

require('./config/db');