// ⚡ الـ Express app في ملف مستقل — يستخدمه السيرفر المحلي (server.js)
// وفي نفس الوقت هو الـ entry للـ Vercel Serverless (api/index.js)
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

app.set('trust proxy', 1); // ⚡ مهم للنشر خلف Proxies زي Vercel

app.use(cors({
  origin: true, // ⚡ بيسمح لأي origin — مناسب للنشر والمحلي
  credentials: true
}));
app.use(express.json());

// ⚡ خدمة الفرونت-إند المبني (dist) من نفس السيرفر — للـ deployment بمنصة واحدة
const distDir = path.join(__dirname, '../../Frontend/dist');
app.use(express.static(distDir));

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
  const indexPath = path.join(distDir, 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath); // ⚡ في الإنتاج: افتح التطبيق
  res.json({ message: 'Smart Attendance System API is running 🚀' });
});

// ⚡ SPA fallback: أي مسار مش /api يرجع للتطبيق (React Router deep links)
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
  const indexPath = path.join(distDir, 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  next();
});

module.exports = app;
