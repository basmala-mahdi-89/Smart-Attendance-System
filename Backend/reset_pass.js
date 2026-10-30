const pool = require('./src/config/db');
const bcrypt = require('bcryptjs');

async function resetPassword() {
  // ⚠️ حط هنا الرقم القومي بتاع الشخص اللي عايز تدخل بحسابه
  const nationalId = '40000000000001'; 
  const newPassword = 'Engineer@12345';

  try {
    const hash = await bcrypt.hash(newPassword, 10);
    
    // بنجرب نحدث في جدول الـ Staff الأول (دكتور، مهندس، عميد، رئيس قسم)
    let res = await pool.query(
      `UPDATE staff SET password_hash = $1 WHERE national_id = $2 RETURNING full_name, role`,
      [hash, nationalId]
    );

    // لو ملقاش في الـ Staff، بنجرب في الـ Students
    if (res.rows.length === 0) {
      res = await pool.query(
        `UPDATE students SET password_hash = $1 WHERE national_id = $2 RETURNING full_name, status`,
        [hash, nationalId]
      );
    }

    if (res.rows.length > 0) {
      console.log('✅ Password reset successful for:', res.rows[0]);
      console.log('🔑 New Password is:', newPassword);
      console.log('🆔 National ID is:', nationalId);
    } else {
      console.log('❌ User not found with this National ID.');
    }

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

resetPassword();