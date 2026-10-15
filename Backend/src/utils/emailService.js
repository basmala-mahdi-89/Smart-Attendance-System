const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Verify transporter on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Email transporter error:', error.message);
  } else {
    console.log('✅ Email transporter ready');
  }
});

exports.sendInvitationEmail = async (to, full_name, role, token) => {
  const acceptUrl = `${process.env.FRONTEND_URL}/invite/${token}`;
  console.log('📧 Preparing email...');
  console.log('   To:', to);
  console.log('   Link:', acceptUrl);

  const mailOptions = {
    from: `"Smart Attendance" <${process.env.EMAIL_USER}>`,
    to,
    subject: `Invitation to join Smart Attendance System as ${role}`,
    html: `
      <h2>Hello ${full_name},</h2>
      <p>You have been invited to join <b>Smart Attendance System</b> as a <b>${role}</b>.</p>
      <p>Click the link below to accept the invitation and set your password:</p>
      <a href="${acceptUrl}" style="background:#007bff;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;">
        Accept Invitation
      </a>
      <p>Or copy this link:</p>
      <p>${acceptUrl}</p>
      <p>This link expires in 7 days.</p>
      <br/>
      <p>Regards,<br/>Smart Attendance Team</p>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent:', info.messageId);
  } catch (err) {
    console.error('❌ Send email error:', err.message);
    throw err;
  }
};