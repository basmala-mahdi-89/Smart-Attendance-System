import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import DashboardLayout from '../components/layout/DashboardLayout';
import Button from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import { Alert, Badge } from '../components/ui/Feedback';
import { useLanguage } from '../context/LanguageContext';
import { getDeviceFingerprint } from '../utils/deviceFingerprint';

export default function StudentScan() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { lang } = useLanguage();
  const [result, setResult] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const scannerRef = useRef(null);

  useEffect(() => {
    if (!cameraOn) return undefined;

    let disposed = false;
    let handled = false;
    let scanner = null;

    const start = async () => {
      try {
        scanner = new Html5Qrcode('reader', { verbose: false });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 5, qrbox: { width: 240, height: 240 }, aspectRatio: 1.0 },
          async (decodedText) => {
            if (handled) return;
            handled = true;
            try {
              let payload = null;
              try {
                payload = JSON.parse(decodedText);
              } catch {
                payload = null;
              }
              const res =
                payload && payload.type === 'student_personal'
                  ? await client.post('/students/scan', {
                      qr_data: decodedText,
                      device_fingerprint: getDeviceFingerprint(),
                    })
                  : await client.post('/students/scan', {
                      qr_token: decodedText,
                      device_fingerprint: getDeviceFingerprint(),
                    });
              if (disposed) return;
              setResult({ success: true, message: res.data.message });
              setCameraOn(false);
            } catch (err) {
              if (disposed) return;
              setResult({
                success: false,
                message:
                  err.response?.data?.message ||
                  'تعذّر تسجيل الحضور / Failed to mark attendance',
              });
              handled = false;
            }
          },
          () => {}
        );
        if (disposed) {
          try { await scanner.stop(); } catch { /* not running */ }
          try { scanner.clear(); } catch { /* ignore */ }
        }
      } catch (err) {
        if (disposed) return;
        setCameraError(
          'تعذّر تشغيل الكاميرا / Could not start the camera. اسمح بالوصول للكاميرا من إعدادات المتصفح وتأكد أن الصفحة تعمل عبر HTTPS أو localhost.'
        );
        setCameraOn(false);
      }
    };

    const timer = setTimeout(() => {
      if (!disposed) start();
    }, 0);

    return () => {
      disposed = true;
      clearTimeout(timer);
      const instance = scannerRef.current;
      scannerRef.current = null;
      if (!instance) return;
      // html5-qrcode can throw synchronously when nothing is running — guard everything.
      (async () => {
        try { await instance.stop(); } catch { /* not running */ }
        try { instance.clear(); } catch { /* ignore */ }
      })();
    };
  }, [cameraOn]);

  const openCamera = () => {
    setResult(null);
    setCameraError('');
    setCameraOn(true);
  };

  const closeCamera = () => {
    setCameraOn(false);
  };

  const nav = [
    { key: 'dashboard', label: 'Overview', icon: 'home', to: '/student', section: 'Student workspace' },
    { key: 'scan', label: 'Scan Session QR', icon: 'scan' },
    { key: 'personal-qr', label: 'My Personal QR', icon: 'qr', to: '/student/personal-qr' },
    { key: 'signout', label: 'Sign out', icon: 'logout', onClick: logout, section: 'Account' },
  ];

  return (
    <DashboardLayout
      user={user}
      role="student"
      nav={nav}
      activeKey="scan"
      title={{ en: 'Scan session QR', ar: 'مسح رمز الجلسة' }}
      crumb={{ en: 'Student · Attendance', ar: 'الطالب · الحضور' }}
      onLogout={logout}
      actions={
        <Button variant="secondary" size="sm" icon="arrow-left" onClick={() => navigate('/student')}>
          {lang === 'ar' ? 'لوحة التحكم' : 'Dashboard'}
        </Button>
      }
    >
      <div className="page-head">
        <div className="page-head__text">
          <h1>{lang === 'ar' ? 'امسح رمز الدكتور' : "Scan the doctor's QR"}</h1>
          <p>
            {lang === 'ar'
              ? 'افتح الكاميرا ثم وجّهها نحو الرمز الظاهر في قاعة المحاضرة.'
              : 'Open the camera, then point it at the rotating QR shown in the lecture hall.'}
          </p>
        </div>
        <div className="page-head__actions">
          <Badge variant={cameraOn ? 'success' : 'blue'} dot>
            {cameraOn
              ? lang === 'ar'
                ? 'الكاميرا تعمل · مسح مباشر'
                : 'Camera live · scanning'
              : lang === 'ar'
                ? 'الكاميرا مغلقة'
                : 'Camera closed'}
          </Badge>
        </div>
      </div>

      <div className="center-page">
        <section className="scan-card anim-up">
          <div className={`scanner-shell ${cameraOn ? 'is-live' : 'is-idle'}`}>
            <div id="reader" />
            {!cameraOn && (
              <div className="scanner-idle">
                <span className="scanner-idle__icon">
                  <Icon name="camera" size={26} />
                </span>
                <b>{lang === 'ar' ? 'الكاميرا مغلقة' : 'Camera is off'}</b>
                <span>
                  {lang === 'ar'
                    ? 'اضغط «فتح الكاميرا» لبدء المسح.'
                    : 'Press “Open camera” to start scanning.'}
                </span>
              </div>
            )}
          </div>

          <div className="camera-actions">
            <Button variant="primary" icon="camera" onClick={openCamera} disabled={cameraOn}>
              {lang === 'ar' ? 'فتح الكاميرا' : 'Open camera'}
            </Button>
            <Button variant="secondary" icon="x" onClick={closeCamera} disabled={!cameraOn}>
              {lang === 'ar' ? 'إغلاق الكاميرا' : 'Close camera'}
            </Button>
          </div>

          <div className="stack" style={{ marginTop: 16, gap: 12 }}>
            <div className="row" style={{ gap: 9, fontSize: '0.8rem', color: 'var(--muted)' }}>
              <Icon name="info" size={16} />
              <span>
                {lang === 'ar'
                  ? 'يتجدد الرمز كل 5 ثوانٍ — إذا انتهت صلاحيته، امسح الرمز الجديد.'
                  : 'The QR refreshes every 5 seconds — if it expires, scan the new one.'}
              </span>
            </div>

            {cameraError && <Alert variant="error">{cameraError}</Alert>}

            {result && (
              <div className="stack" style={{ gap: 12 }}>
                <Alert variant={result.success ? 'success' : 'error'}>{result.message}</Alert>
                {result.success && (
                  <Button variant="success" icon="arrow-left" onClick={() => navigate('/student')}>
                    {lang === 'ar' ? 'العودة إلى لوحة التحكم' : 'Back to dashboard'}
                  </Button>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
