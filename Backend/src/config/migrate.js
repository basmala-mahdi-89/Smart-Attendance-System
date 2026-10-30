const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function runMigrations() {
  try {
    const migrationsDir = path.join(__dirname, '../migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('⚠️ No migration files found');
      process.exit(0);
    }

    console.log(`📦 Found ${files.length} migration file(s): ${files.join(', ')}`);
    
    for (const file of files) {
      console.log(`🔄 Running ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await pool.query(sql);
      console.log(`✅ ${file} completed`);
    }

    console.log('🎉 All migrations completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

runMigrations();
