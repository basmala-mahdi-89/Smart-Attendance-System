const pool = require('../config/db');
const bcrypt = require('bcryptjs');

async function seed() {
  try {
    console.log('🌱 Seeding database...');

    const password = await bcrypt.hash('Dean@12345', 10);

    await pool.query(
      `INSERT INTO staff (national_id, full_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, 'dean')
       ON CONFLICT (email) DO NOTHING`,
      ['30708221203485', 'Basmala Mahdi', 'basmala.mahdi.89@gmail.com', password]
    );

    console.log('✅ Dean created');
    console.log('📧 Email: basmala.mahdi.89@gmail.com');
    console.log('🔑 Password: Dean@12345');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
}

seed();