import { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

export default function StudentScan() {
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const scannerRef = useRef(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner('reader', { fps: 5, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 }, false);
    let scanned = false;
    scanner.render(async (decodedText) => {
      if (scanned) return;
      scanned = true;
      try {
        const res = await client.post('/students/scan', { qr_token: decodedText });
        setResult({ success: true, message: res.data.message });
        scanner.clear().catch(() => {});
      } catch (err) {
        setResult({ success: false, message: err.response?.data?.message || 'Failed to mark attendance' });
        scanned = false;
      }
    }, (error) => {});
    scannerRef.current = scanner;

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => {});
      }
    };
  }, []);

  return (
    <div style={{ padding: '30px', fontFamily: 'Segoe UI, sans-serif', backgroundColor: '#f4f7f6', minHeight: '100vh', textAlign: 'center' }}>
      <div style={{ maxWidth: '500px', margin: '0 auto', background: '#fff', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
        <button onClick={() => navigate('/student')} style={{ marginBottom: '20px', padding: '8px 16px', border: 'none', borderRadius: '6px', cursor: 'pointer', background: '#e2e8f0', fontWeight: '600' }}>← Back to Dashboard</button>
        <h1 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>Scan Doctor QR</h1>
        <p style={{ color: '#718096', marginBottom: '25px' }}>Scan the QR code shown by your doctor to mark attendance</p>
        
        <div id="reader" style={{ width: '100%' }}></div>
        
        {result && (
          <div style={{ marginTop: '20px', padding: '15px', borderRadius: '8px', backgroundColor: result.success ? '#c6f6d5' : '#fed7d7', color: result.success ? '#22543d' : '#822727' }}>
            <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{result.success ? '✅' : '❌'} {result.message}</div>
            {result.success && (
              <button onClick={() => navigate('/student')} style={{ marginTop: '15px', padding: '10px 25px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: '#38a169', color: 'white', fontWeight: 'bold' }}>Back to Dashboard</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
