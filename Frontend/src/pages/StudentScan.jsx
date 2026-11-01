import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import DashboardLayout from '../components/layout/DashboardLayout';
import Button from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import { Alert, Badge } from '../components/ui/Feedback';

export default function StudentScan() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [result, setResult] = useState(null);
  const scannerRef = useRef(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      'reader',
      { fps: 5, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
      false
    );
    let scanned = false;
    scanner.render(
      async (decodedText) => {
        if (scanned) return;
        scanned = true;
        try {
          const res = await client.post('/students/scan', { qr_token: decodedText });
          setResult({ success: true, message: res.data.message });
          scanner.clear().catch(() => {});
        } catch (err) {
          setResult({
            success: false,
            message: err.response?.data?.message || 'Failed to mark attendance',
          });
          scanned = false;
        }
      },
      (error) => {}
    );
    scannerRef.current = scanner;

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
      }
    };
  }, []);

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
      title="Scan session QR"
      crumb="Student · Attendance"
      onLogout={logout}
      actions={
        <Button variant="secondary" size="sm" icon="arrow-left" onClick={() => navigate('/student')}>
          Dashboard
        </Button>
      }
    >
      <div className="page-head">
        <div className="page-head__text">
          <h1>Scan the doctor's QR</h1>
          <p>Point your camera at the rotating QR shown in the lecture hall.</p>
        </div>
        <div className="page-head__actions">
          <Badge variant="blue" dot>
            Camera · live scanning
          </Badge>
        </div>
      </div>

      <div className="center-page">
        <section className="scan-card anim-up">
          <div className="scanner-shell">
            <div id="reader" />
          </div>

          <div className="stack" style={{ marginTop: 16, gap: 12 }}>
            <div className="row" style={{ gap: 9, fontSize: '0.8rem', color: 'var(--muted)' }}>
              <Icon name="info" size={16} />
              <span>The QR refreshes every 5 seconds — if it expires, scan the new one.</span>
            </div>

            {result && (
              <div className="stack" style={{ gap: 12 }}>
                <Alert variant={result.success ? 'success' : 'error'}>{result.message}</Alert>
                {result.success && (
                  <Button variant="success" icon="arrow-left" onClick={() => navigate('/student')}>
                    Back to dashboard
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
