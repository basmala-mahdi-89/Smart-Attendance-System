const http = require('http');
const os = require('os');
const { initSocket } = require('./config/socket');
const { runMigrations } = require('./runMigrations');
const app = require('./app');

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

(async () => {
  try {
    await runMigrations(); // ⚡ ينشئ الجداول تلقائياً في قاعدة الريلوي أول مرة
  } catch (err) {
    console.error('⚠️ Migration error:', err.message);
  }

  // ⚡ Socket.IO شغال بس على السيرفر الحقيقي (المحلي/Render/Render) — على Vercel مش بيشتغل
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
})();

require('./config/db');
