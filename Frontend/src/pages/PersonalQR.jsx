import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';

function base32Decode(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0, index = 0;
  const buffer = new Uint8Array(Math.ceil(base32.length * 5 / 8));
  for (let i = 0; i < base32.length; i++) {
    const val = alphabet.indexOf(base32[i].toUpperCase());
    if (val === -1) continue;
    value = (value << 5) | val;
    bits += 5;
    if (bits >= 8) {
      buffer[index++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }
  return buffer;
}

async function generateTOTP(secret) {
  const key = base32Decode(secret);
  const epoch = Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / 30); // 30 ثانية
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setUint32(4, counter, false); 
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, buffer);
  const hash = new Uint8Array(signature);
  
  const offset = hash[hash.length - 1] & 0xf;
  const binary = ((hash[offset] & 0x7f) << 24) |
                 ((hash[offset + 1] & 0xff) << 16) |
                 ((hash[offset + 2] & 0xff) << 8) |
                 (hash[offset + 3] & 0xff);
                 
  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

export default function PersonalQR() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [secret, setSecret] = useState('');
  const [studentId, setStudentId] = useState('');
  const [token, setToken] = useState('');
  const [qrData, setQrData] = useState('');
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(30);

  useEffect(() => {
    const loadSecret = async () => {
      try {
        let storedSecret = localStorage.getItem('student_totp_secret');
        let storedId = localStorage.getItem('student_totp_id');
        
        if (!storedSecret || !storedId) {
          const { data } = await client.get('/students/me/personal-qr');
          storedSecret = data.totp_secret;
          storedId = data.student_id.toString();
          localStorage.setItem('student_totp_secret', storedSecret);
          localStorage.setItem('student_totp_id', storedId);
        }
        
        setSecret(storedSecret);
        setStudentId(storedId);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };
    loadSecret();
  }, []);

  useEffect(() => {
    if (!secret || !studentId) return;
    
    const updateOTP = async () => {
      const otp = await generateTOTP(secret);
      setToken(otp);
      setQrData(JSON.stringify({
        type: 'student_personal',
        student_id: studentId,
        otp: otp
      }));
    };

    updateOTP();
    
    const interval = setInterval(() => {
      updateOTP();
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 30));
    }, 1000);

    return () => clearInterval(interval);
  }, [secret, studentId]);

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;

  return (
    <div style={{ padding: '30px', fontFamily: 'Segoe UI, sans-serif', backgroundColor: '#f4f7f6', minHeight: '100vh', textAlign: 'center' }}>
      <div style={{ maxWidth: '420px', margin: '0 auto', background: '#fff', padding: '35px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
        <button onClick={() => navigate('/student')} style={{ marginBottom: '25px', padding: '9px 18px', border: 'none', borderRadius: '6px', cursor: 'pointer', background: '#e2e8f0', fontWeight: '600' }}>← Back</button>
        <h1 style={{ margin: '0 0 8px 0', color: '#2c3e50', fontSize: '28px' }}>My Personal QR</h1>
        <p style={{ color: '#4a5568', marginBottom: '20px', fontWeight: '600' }}>{user?.full_name}</p>
        
        <div style={{ background: 'white', padding: '20px', display: 'inline-block', borderRadius: '12px', border: '4px solid #805ad5' }}>
          {qrData && <QRCodeSVG value={qrData} size={260} />}
        </div>

        <div style={{ marginTop: '25px', padding: '18px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '10px', color: 'white' }}>
          <p style={{ margin: 0, fontSize: '13px' }}>TOTP CODE (30s)</p>
          <p style={{ margin: '8px 0', fontSize: '38px', fontWeight: 'bold', letterSpacing: '12px' }}>{token}</p>
          <p style={{ margin: 0, fontSize: '14px' }}>Refreshes in {timeLeft} seconds</p>
        </div>
      </div>
    </div>
  );
}