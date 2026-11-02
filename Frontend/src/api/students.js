import client from './client';

// ============================
// Auth & Registration
// ============================
export const register = async (studentData) => {
  const { data } = await client.post('/students/register', studentData);
  return data;
};

export const verifyEmail = async (token) => {
  const { data } = await client.get(`/students/verify-email/${token}`);
  return data;
};

export const verifyOTP = async (national_id, otp) => {
  const { data } = await client.post('/students/verify-otp', { national_id, otp });
  return data;
};

// ============================
// Student Profile & Dashboard
// ============================
export const getMyProfile = async () => {
  const { data } = await client.get('/students/me');
  return data;
};

export const getMyCourses = async () => {
  const { data } = await client.get('/students/me/courses');
  return data;
};

export const getMyAttendance = async () => {
  const { data } = await client.get('/students/me/attendance');
  return data;
};

export const getMyWarnings = async () => {
  const { data } = await client.get('/students/me/warnings');
  return data;
};

// ============================
// QR & Attendance
// ============================
export const getMyPersonalQR = async () => {
  const { data } = await client.get('/students/me/personal-qr');
  return data;
};

export const scanQR = async (qr_token, device_fingerprint) => {
  const { data } = await client.post('/students/scan', { qr_token, device_fingerprint });
  return data;
};

// ============================
// Invitations (للـ Head والدكاترة)
// ============================
export const getInvitation = async (token) => {
  const { data } = await client.get(`/invitations/${token}`);
  return data;
};

export const acceptInvitation = async (token, payload) => {
  const { data } = await client.post(`/invitations/${token}/accept`, payload);
  return data;
};