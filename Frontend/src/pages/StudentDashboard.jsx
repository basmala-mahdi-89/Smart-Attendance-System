import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import * as studentApi from '../api/students';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function StudentDashboard() {
  const { logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [courses, setCourses] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // حالة الكاميرا
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState('');
  const scannerRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      try {
        const [p, c, w] = await Promise.all([
          studentApi.getMyProfile(),
          studentApi.getMyCourses(),
          studentApi.getMyWarnings()
        ]);
        if (mounted) {
          setProfile(p);
          setCourses(c);
          setWarnings(w);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadData();

    return () => {
      mounted = false;
      if (scannerRef.current) scannerRef.current.clear().catch(() => {});
    };
  }, []);

  // ⚡ دالة فتح الكاميرا لمسح QR المحاضرة
  const startScan = () => {
    setScanning(true);
    setScanResult(null);
    setScanError('');
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner('qr-reader', { fps: 10, qrbox: { width: 250, height: 250 } }, false);
      scanner.render(
        async (decodedText) => {
          scanner.clear();
          setScanning(false);
          await handleScan(decodedText);
        },
        () => {}
      );
      scannerRef.current = scanner;
    }, 100);
  };

  const handleScan = async (qrToken) => {
    try {
      let deviceFp = localStorage.getItem('device_fingerprint');
      if (!deviceFp) {
        deviceFp = 'device-' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('device_fingerprint', deviceFp);
      }
      const result = await studentApi.scanQR(qrToken, deviceFp);
      setScanResult(result);
      
      // تحديث الكورسات عشان النسبة تتحدث
      const c = await studentApi.getMyCourses();
      setCourses(c);
    } catch (err) {
      setScanError(err.response?.data?.message || 'Scan failed');
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading...</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1>Student Dashboard</h1>
          <p>Welcome, {profile?.full_name}</p>
        </div>
        <button onClick={logout} style={{ padding: '10px', cursor: 'pointer' }}>Logout</button>
      </header>

      {/* زرار المسح */}
      <div style={{ marginBottom: '20px' }}>
        {!scanning ? (
          <button onClick={startScan} style={{ padding: '15px 30px', background: 'blue', color: 'white', fontSize: '16px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
            📷 Scan Doctor's QR
          </button>
        ) : (
          <div style={{ border: '2px solid blue', padding: '20px', marginBottom: '20px', borderRadius: '8px' }}>
            <h3>Scanning...</h3>
            <div id="qr-reader" style={{ width: '100%', maxWidth: '500px', margin: '0 auto' }}></div>
            <button onClick={() => { if (scannerRef.current) scannerRef.current.clear(); setScanning(false); }} style={{ marginTop: '10px', padding: '10px', background: 'red', color: 'white', border: 'none', borderRadius: '5px' }}>
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* رسائل النجاح والخطأ */}
      {scanResult && (
        <div style={{ background: '#d4edda', padding: '15px', marginBottom: '20px', borderRadius: '5px', border: '1px solid green' }}>
          <p style={{ margin: 0 }}>✅ <b>{scanResult.message}</b></p>
        </div>
      )}
      {scanError && (
        <div style={{ background: '#f8d7da', padding: '15px', marginBottom: '20px', borderRadius: '5px', border: '1px solid red' }}>
          <p style={{ margin: 0 }}>❌ {scanError}</p>
        </div>
      )}

      {/* بيانات الطالب */}
      <section style={{ marginBottom: '30px' }}>
        <h2>My Profile</h2>
        <p>National ID: {profile?.national_id}</p>
        <p>Major: {profile?.major_name}</p>
        <p>Academic Year: {profile?.academic_year}</p>
      </section>

      {/* الكورسات */}
      <section style={{ marginBottom: '30px' }}>
        <h2>My Courses ({courses.length})</h2>
        {courses.map(c => (
          <div key={c.id} style={{ border: '1px solid #ccc', padding: '15px', margin: '10px 0', borderRadius: '5px', background: '#f9f9f9' }}>
            <h3>{c.course_code} - {c.course_name}</h3>
            <p>Attended: <b>{c.attended_sessions}</b> / {c.total_sessions} sessions</p>
          </div>
        ))}
      </section>

      {/* الإنذارات */}
      <section>
        <h2>Warnings ({warnings.length})</h2>
        {warnings.length === 0 ? (
          <p>No warnings. Keep it up! 🌟</p>
        ) : (
          warnings.map(w => (
            <div key={w.id} style={{ border: '1px solid #ccc', padding: '10px', margin: '5px 0', borderRadius: '5px', background: '#fff3cd' }}>
              <p style={{ margin: 0 }}>⚠️ Level {w.level} Warning - {w.course_code}</p>
              <p style={{ margin: '5px 0 0 0', fontSize: '14px' }}>Absence: {w.absence_percentage}%</p>
            </div>
          ))
        )}
      </section>
    </div>
  );
}