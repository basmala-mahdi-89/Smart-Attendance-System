const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Uncomment to verify
// transporter.verify((error) => {
//   if (error) console.error('❌ Email error:', error.message);
//   else console.log('✅ Email ready');
// });

exports.sendInvitationEmail = async (to, full_name, role, token) => {
  const acceptUrl = `${process.env.FRONTEND_URL}/invite/${token}`;

  // ══════════════════════════════════════════
  // ⚠️ TEST MODE: Print to console
  // ══════════════════════════════════════════
  console.log('');
  console.log('════════════════════════════════════════════');
  console.log('📧 INVITATION EMAIL (TEST MODE)');
  console.log('════════════════════════════════════════════');
  console.log('   To:   ', to);
  console.log('   Name: ', full_name);
  console.log('   Role: ', role);
  console.log('   ───────────────────────────────────');
  console.log('   🔗 ACCEPT LINK:');
  console.log('   ' + acceptUrl);
  console.log('   ───────────────────────────────────');
  console.log('   🔑 TOKEN:');
  console.log('   ' + token);
  console.log('════════════════════════════════════════════');
  console.log('');

  // ══════════════════════════════════════════
  // ⚠️ Uncomment to actually send email
  // ══════════════════════════════════════════
  /*
  const mailOptions = {
    from: `"Smart Attendance" <${process.env.EMAIL_USER}>`,
    to,
    subject: `Invitation as ${role}`,
    html: `
      <h2>Hello ${full_name},</h2>
      <p>You've been invited as <b>${role}</b>.</p>
      <p><a href="${acceptUrl}">Accept Invitation</a></p>
      <p>Or copy: ${acceptUrl}</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ Email sent to', to);
  } catch (err) {
    console.error('❌ Email send error:', err.message);
  }
  */
};