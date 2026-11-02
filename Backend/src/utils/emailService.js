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

exports.sendInvitationEmail = async (to, full_name, role, token, frontendUrl) => {
  const baseUrl = frontendUrl || process.env.FRONTEND_URL;
  const acceptUrl = `${baseUrl}/invite/${token}`;
  const greeting = full_name && full_name !== 'New User' ? full_name : to;

  const mailOptions = {
    from: `"Smart Attendance" <${process.env.EMAIL_USER}>`,
    to,
    subject: `Invitation to join Smart Attendance System as ${role}`,
    html: `
      <h2>Hello ${greeting},</h2>
      <p>You have been invited to join <b>Smart Attendance System</b> as a <b>${role}</b>.</p>
      <p>Click the link below to accept the invitation and set your password:</p>
      <a href="${acceptUrl}" style="background:#007bff;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;display:inline-block;">
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
    await transporter.sendMail(mailOptions);
    console.log('✅ Email sent to', to);
  } catch (err) {
    console.error('❌ Email send error:', err.message);
    throw err;
  }
};

// ============================
// Send Approval Email to Student
// ============================
exports.sendApprovalEmail = async (to, full_name) => {
  const mailOptions = {
    from: `"Smart Attendance" <${process.env.EMAIL_USER}>`,
    to,
    subject: `Account Approved - Smart Attendance System`,
    html: `
      <h2>Hello ${full_name},</h2>
      <p>Great news! Your account has been <b>approved</b> by the Head of Department.</p>
      <p>You can now login to the system using your National ID and Password.</p>
      <p>Please note: For security reasons, your account will be bound to the first device you log in from.</p>
      <br/>
      <p>Regards,<br/>Smart Attendance Team</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ Approval Email sent to', to);
  } catch (err) {
    console.error('❌ Email send error:', err.message);
    throw err;
  }
};