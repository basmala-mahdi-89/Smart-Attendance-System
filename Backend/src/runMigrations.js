// ⚡ يطبّق ملفات الـ migrations بالترتيب عند تشغيل السيرفر (idempotent: يتخطى الموجود بالفعل)
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const MIGRATION_DIR = path.join(__dirname, 'migrations');

// ⚡ أكواد أخطاء PostgreSQL اللي معناها "موجود بالفعل" — نتجاهلها ونكمل
const ALREADY_EXISTS = new Set([
  '42P05', // duplicate prepared statement
  '42P06', // duplicate schema
  '42P07', // duplicate table
  '42710', // duplicate object (constraint, etc.)
  '42701', // duplicate column
  '42712', // duplicate alias
  '42723', // duplicate function
]);

async function runMigrations() {
  if (!process.env.DATABASE_URL) {
    console.log('⏭️ No DATABASE_URL set — skipping migrations');
    return;
  }

  const files = fs
    .readdirSync(MIGRATION_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  if (files.length === 0) return;

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(MIGRATION_DIR, file), 'utf8');
      try {
        await pool.query(sql);
        console.log(`✅ Migration applied: ${file}`);
      } catch (err) {
        if (ALREADY_EXISTS.has(err.code)) {
          console.log(`⏭️ Migration skipped (already applied): ${file}`);
        } else {
          throw err;
        }
      }
    }
    console.log('🎉 All migrations processed');
  } finally {
    await pool.end();
  }
}

module.exports = { runMigrations };

// ⚡ لما يتشغل مباشرة (node src/runMigrations.js) ينفذ فوراً
if (require.main === module) {
  runMigrations().catch((err) => {
    console.error('❌ Migration failed:', err.message);
    process.exitCode = 1;
  });
}
