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
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
      }
    };
  }, []);

  const startScan = () => {
    setScanning(true);
    setScanResult(null);
    setScanError('');

    setTimeout(() => {
      const scanner = new Html5QrcodeScanner(
        'qr-reader',
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );

      scanner.render(
        async (decodedText) => {
          scanner.clear();
          setScanning(false);
          await handleScan(decodedText);
        },
        (error) => {
          // silent
        }
      );

      scannerRef.current = scanner;
    }, 100);
  };

  const handleScan = async (qrToken) => {
    try {
      // Get device fingerprint from localStorage or generate
      let deviceFp = localStorage.getItem('device_fingerprint');
      if (!deviceFp) {
        deviceFp = 'device-' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('device_fingerprint', deviceFp);
      }

      const result = await studentApi.scanQR(qrToken, deviceFp);
      setScanResult(result);
      // Refresh courses
      const c = await studentApi.getMyCourses();
      setCourses(c);
    } catch (err) {
      setScanError(err.response?.data?.message || 'Scan failed');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <header>
        <h1>Student Dashboard</h1>
        <p>Welcome, {profile?.full_name}</p>
        <button onClick={logout}>Logout</button>
      </header>

      {/* Scan QR */}
      <section style={{ border: '2px solid blue', padding: '15px', margin: '15px 0', background: '#f0f8ff' }}>
        <h2>📷 Scan QR Code</h2>

        {!scanning && (
          <button onClick={startScan} style={{ background: 'blue', color: 'white', padding: '15px 30px', fontSize: '16px' }}>
            📷 Open Camera
          </button>
        )}

        {scanning && (
          <div>
            <div id="qr-reader" style={{ width: '100%', maxWidth: '500px', margin: '0 auto' }}></div>
            <button 
              onClick={() => {
                if (scannerRef.current) scannerRef.current.clear();
                setScanning(false);
              }}
              style={{ background: 'red', color: 'white', padding: '10px', marginTop: '10px' }}
            >
              Cancel
            </button>
          </div>
        )}

        {scanResult && (
          <div style={{ background: '#d4edda', padding: '15px', marginTop: '15px', borderRadius: '5px' }}>
            <p>✅ <b>{scanResult.message}</b></p>
            <p>Attendance ID: {scanResult.attendance.id}</p>
          </div>
        )}

        {scanError && (
          <div style={{ background: '#f8d7da', padding: '15px', marginTop: '15px', borderRadius: '5px' }}>
            <p>❌ {scanError}</p>
          </div>
        )}
      </section>

      <section>
        <h2>My Profile</h2>
        <p>National ID: {profile?.national_id}</p>
        <p>Email: {profile?.email}</p>
        <p>Major: {profile?.major_name}</p>
        <p>Academic Year: {profile?.academic_year}</p>
      </section>

      <section>
        <h2>My Courses ({courses.length})</h2>
        {courses.map(c => (
          <div key={c.id} style={{ border: '1px solid #ccc', padding: '10px', margin: '5px 0' }}>
            <h3>{c.course_code} - {c.course_name}</h3>
            <p>Attended: {c.attended_sessions} / {c.total_sessions}</p>
          </div>
        ))}
      </section>

      <section>
        <h2>Warnings ({warnings.length})</h2>
        {warnings.map(w => (
          <div key={w.id} style={{ border: '1px solid #ccc', padding: '10px', margin: '5px 0' }}>
            <p>Level {w.level} - {w.course_code}</p>
            <p>Absence: {w.absence_percentage}%</p>
          </div>
        ))}
      </section>
    </div>
  );
}