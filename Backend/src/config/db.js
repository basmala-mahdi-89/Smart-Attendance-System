const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Test connection on startup
pool.connect()
  .then((client) => {
    console.log('✅ Connected to Neon PostgreSQL');
    client.release(); // نرجع الاتصال للـ Pool
  })
  .catch((err) => console.error('❌ DB Connection Error:', err.message));


pool.on('error', (err) => {
  console.error('⚠️ Unexpected error on idle database client:', err.message);
  
});

module.exports = pool;