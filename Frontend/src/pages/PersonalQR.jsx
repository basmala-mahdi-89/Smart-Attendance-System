import { useEffect, useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import DashboardLayout from '../components/layout/DashboardLayout';
import Button from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import { Badge, Loader } from '../components/ui/Feedback';
import { ProgressBar } from '../components/ui/Motion';
import { useLanguage } from '../context/LanguageContext';

function base32Decode(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let index = 0;
  const buffer = new Uint8Array(Math.ceil((base32.length * 5) / 8));
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
  const counter = Math.floor(epoch / 30);
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setUint32(4, counter, false);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, buffer);
  const hash = new Uint8Array(signature);

  const offset = hash[hash.length - 1] & 0xf;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

export default function PersonalQR() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { lang } = useLanguage();
  const [secret, setSecret] = useState('');
  const [studentId, setStudentId] = useState('');
  const [token, setToken] = useState('');
  const [qrData, setQrData] = useState('');
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(30);
  const counterRef = useRef(-1);

  useEffect(() => {
    const loadSecret = async () => {
      try {
        let storedSecret = localStorage.getItem('student_totp_secret');
        let storedId = localStorage.getItem('student_totp_id') || (user?.id ? user.id.toString() : '');

        if (!storedSecret) {
          const { data } = await client.get('/students/me/personal-qr');
          storedSecret = data.totp_secret;
          localStorage.setItem('student_totp_secret', storedSecret);
        }
        if (!storedId && user?.id) {
          storedId = user.id.toString();
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
    if (user) loadSecret();
  }, [user]);

  useEffect(() => {
    if (!secret || !studentId) return;

    let cancelled = false;

    const tick = async () => {
      const epoch = Math.floor(Date.now() / 1000);
      const counter = Math.floor(epoch / 30);
      const remaining = 30 - (epoch % 30);

      setTimeLeft(remaining);

      if (counter === counterRef.current) return;
      counterRef.current = counter;

      const otp = await generateTOTP(secret);
      if (cancelled) return;
      setToken(otp);
      setQrData(JSON.stringify({ type: 'student_personal', student_id: String(studentId), otp }));
    };

    tick();
    const id = setInterval(tick, 1000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [secret, studentId]);

  const nav = [
    { key: 'dashboard', label: 'Overview', icon: 'home', to: '/student', section: 'Student workspace' },
    { key: 'personal-qr', label: 'My Personal QR', icon: 'qr' },
    { key: 'scan', label: 'Scan Session QR', icon: 'scan', to: '/student/scan' },
    { key: 'signout', label: 'Sign out', icon: 'logout', onClick: logout, section: 'Account' },
  ];

  return (
    <DashboardLayout
      user={user}
      role="student"
      nav={nav}
      activeKey="personal-qr"
      title={{ en: 'My personal QR', ar: 'رمزي الشخصي' }}
      crumb={{ en: 'Student · Identity', ar: 'الطالب · الهوية' }}
      onLogout={logout}
      actions={
        <Button variant="secondary" size="sm" icon="arrow-left" onClick={() => navigate('/student')}>
          {lang === 'ar' ? 'لوحة التحكم' : 'Dashboard'}
        </Button>
      }
    >
      <div className="page-head">
        <div className="page-head__text">
          <h1>{lang === 'ar' ? 'هويتك للحضور دون اتصال' : 'Your offline attendance identity'}</h1>
          <p>{lang === 'ar' ? 'اعرض هذا الرمز للدكتور أو المهندس عند استخدام الكاميرا.' : 'Show this code to the doctor or engineer when the camera scanner is in use.'}</p>
        </div>
        <div className="page-head__actions">
          <Badge variant="success" dot>
            {lang === 'ar' ? 'مرتبطة بالجهاز · تتجدد كل 30 ثانية' : 'Device-bound · refreshes every 30s'}
          </Badge>
        </div>
      </div>

      {loading ? (
        <Loader label={lang === 'ar' ? 'جارٍ تجهيز رمزك الآمن…' : 'Preparing your secure QR…'} />
      ) : (
        <div className="center-page">
          <section className="qr-card anim-scale">
            <h1>{lang === 'ar' ? 'رمزي الشخصي' : 'My personal QR'}</h1>
            <p className="qr-card__name">{lang === 'ar' && user?.full_name_ar ? user?.full_name_ar : user?.full_name}</p>

            <div className="qr-card__frame">
              {qrData ? (
                <QRCodeSVG value={qrData} size={248} />
              ) : (
                <div style={{ width: 248, height: 248 }} />
              )}
            </div>

            <div className="totp">
              <div className="totp__label">{lang === 'ar' ? 'رمز TOTP · 30 ثانية' : 'TOTP code · 30 seconds'}</div>
              <div className="totp__code">{token || '••••••'}</div>
              <div className="totp__meta">{lang === 'ar' ? `يتجدد خلال ${timeLeft} ثانية` : `Refreshes in ${timeLeft} seconds`}</div>
              <ProgressBar
                value={(timeLeft / 30) * 100}
                tone={timeLeft <= 5 ? 'warning' : 'blue'}
                showLabel
                label={`${timeLeft}s`}
              />
            </div>

            <div className="qr-card__hint">
              <Icon name="shield-check" size={17} />
              <span>
                {lang === 'ar'
                  ? 'هذا الرمز مرتبط بحسابك وجهازك. مشاركته مع طالب آخر سيُعلَّم كحضور وسيط.'
                  : 'This code is tied to your account and device. Sharing it with another student will be flagged as proxy attendance.'}
              </span>
            </div>

            <Button
              variant="secondary"
              block
              icon="scan"
              style={{ marginTop: 16 }}
              onClick={() => navigate('/student/scan')}
            >
              {lang === 'ar' ? 'امسح رمز جلسة بدلًا من ذلك' : 'Scan a session QR instead'}
            </Button>
          </section>
        </div>
      )}
    </DashboardLayout>
  );
}
