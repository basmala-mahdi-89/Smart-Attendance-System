import client from './client';

export const login = async (national_id, password, device_fingerprint = null) => {
  const body = { national_id, password };
  if (device_fingerprint) body.device_fingerprint = device_fingerprint;

  const { data } = await client.post('/auth/login', body);
  return data;
};

export const getMe = async () => {
  const { data } = await client.get('/auth/me');
  return data;
};