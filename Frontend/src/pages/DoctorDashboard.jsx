import { useEffect, useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import { connectSocket, disconnectSocket, getSocket } from '../api/socket';
import { useNavigate } from 'react-router-dom'; // ⚠️ شيلنا Link عشان مش مستخدم

export default function DoctorDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liveUpdates, setLiveUpdates] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [qrToken, setQrToken] = useState('');
  const [ setQrExpires] = useState(null);
  
  const qrIntervalRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    const loadCourses = async () => {
      try {
        const { data } = await client.get('/doctor/courses');
        if (mounted) setCourses(data);
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadCourses();

    const socket = connectSocket();

    const handleUpdate = (data) => {
      console.log('⚡ Live update:', data);
      setLiveUpdates(prev => [data, ...prev].slice(0, 20));
    };

    socket.on('attendance-update', handleUpdate);

    return () => {
      mounted = false;
      socket.off('attendance-update', handleUpdate);
      disconnectSocket();
      if (qrIntervalRef.current) clearInterval(qrIntervalRef.current);
    };
  }, []);

  // Generate QR every 5 seconds
  const startQrRefresh = (sessionId) => {
    const fetchQR = async () => {
      try {
        const { data } = await client.get(`/doctor/sessions/${sessionId}/qr`);
        setQrToken(data.token);
        setQrExpires(data.expires_at);
      } catch (err) {
        console.error('QR fetch error:', err);
      }
    };

    fetchQR(); // first call
    qrIntervalRef.current = setInterval(fetchQR, 5000);
  };

  const startSession = async (courseId) => {
    try {
      const { data } = await client.post('/doctor/sessions', { course_id: courseId });
      setActiveSession(data.session);

      const socket = getSocket();
      if (socket) {
        socket.emit('join-session', data.session.id);
        console.log('Joined session:', data.session.id);
      }

      // Start QR refresh
      startQrRefresh(data.session.id);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to start session');
    }
  };

  const endSession = async () => {
    if (!activeSession) return;
    try {
      await client.post(`/doctor/sessions/${activeSession.id}/end`);

      const socket = getSocket();
      if (socket) {
        socket.emit('leave-session', activeSession.id);
      }

      if (qrIntervalRef.current) {
        clearInterval(qrIntervalRef.current);
        qrIntervalRef.current = null;
      }

      setActiveSession(null);
      setQrToken('');
      setQrExpires(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to end session');
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <header style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
        <h1>Doctor Dashboard</h1>
        <p>Welcome, {user?.full_name} ({user?.role})</p>
        
        {/* ⚡ زرار يظهر للـ Head بس عشان يروح للإدارة */}
        {user?.role === 'head' && (
          <button 
            onClick={() => navigate('/head')} 
            style={{ background: 'purple', color: 'white', padding: '10px' }}
          >
            ⚙️ Go to Head Management
          </button>
        )}
        
        <button onClick={logout}>Logout</button>
      </header>

      {activeSession && (
        <section style={{ border: '2px solid green', padding: '20px', margin: '15px 0', background: '#e6ffe6' }}>
          <h2>🟢 Active Session #{activeSession.id}</h2>

          {/* QR Code Display */}
          {qrToken && (
            <div style={{ textAlign: 'center', margin: '20px 0' }}>
              <h3>📱 Scan this QR to mark attendance</h3>
              <div style={{ background: 'white', padding: '20px', display: 'inline-block', borderRadius: '10px' }}>
                <QRCodeSVG value={qrToken} size={300} />
              </div>
              <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
                🔄 Refreshing every 5 seconds
              </p>
              
              
            </div>
          )}

          <button onClick={endSession} style={{ background: 'red', color: 'white', padding: '10px' }}>
            End Session
          </button>
        </section>
      )}

<section>
  <h2>My Courses ({courses.length})</h2>
  {courses.map(c => (
    <div key={c.id} style={{ border: '1px solid #ccc', padding: '15px', margin: '10px 0' }}>
      <h3>{c.course_code} - {c.course_name}</h3>
      <p>Major: {c.major_name} | Year: {c.academic_year}</p>
      <p>Students: {c.student_count}</p>
      
<p>
  Engineers: {c.engineers && c.engineers.length > 0 
    ? c.engineers.map(e => `Eng. ${e}`).join(', ') 
    : 'None'}
</p>

      {!activeSession && (
        <button
          onClick={() => startSession(c.id)}
          style={{ background: 'green', color: 'white', padding: '10px 20px' }}
        >
          ▶ Start Session
        </button>
      )}
    </div>
  ))}
</section>

      <section>
        <h2>⚡ Live Attendance ({liveUpdates.length})</h2>
        {liveUpdates.length === 0 ? (
          <p>No live updates yet.</p>
        ) : (
          liveUpdates.map((u, i) => (
            <div key={i} style={{ border: '1px solid #ccc', padding: '10px', margin: '5px 0', background: '#f0f8ff' }}>
              <p>👤 <b>{u.full_name}</b></p>
              <p>Method: {u.method} | Session: {u.session_id}</p>
              <p>Time: {new Date(u.at).toLocaleTimeString()}</p>
            </div>
          ))
        )}
      </section>
    </div>
  );
}