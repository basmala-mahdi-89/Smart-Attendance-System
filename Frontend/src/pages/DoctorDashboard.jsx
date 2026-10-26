import { useEffect, useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import { connectSocket, disconnectSocket, getSocket } from '../api/socket';
import { useNavigate } from 'react-router-dom';

export default function DoctorDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liveUpdates, setLiveUpdates] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [qrToken, setQrToken] = useState('');
  const qrIntervalRef = useRef(null);

  // Manual Add State (Last 5 digits)
  const [shortId, setShortId] = useState('');
  const [manualResult, setManualResult] = useState(null);

  const startQrRefresh = (sessionId) => {
    const fetchQR = async () => {
      try {
        const { data } = await client.get(`/doctor/sessions/${sessionId}/qr`);
        setQrToken(data.token);
      } catch (err) { 
        console.error('QR error:', err); 
      }
    };
    fetchQR();
    if (qrIntervalRef.current) clearInterval(qrIntervalRef.current);
    qrIntervalRef.current = setInterval(fetchQR, 5000);
  };

  useEffect(() => {
    let mounted = true;
    
    const loadInitialData = async () => {
      try {
        // 1. جلب الكورسات
        const { data: coursesData } = await client.get('/doctor/courses');
        if (mounted) setCourses(coursesData);

        // 2. جلب الـ Session النشطة (لو الدكتور عمل Refresh)
        const { data: sessionData } = await client.get('/doctor/active-session');
        
        if (sessionData.session && mounted) {
          setActiveSession(sessionData.session);
          startQrRefresh(sessionData.session.id);
          
          const socket = getSocket();
          if (socket) socket.emit('join-session', sessionData.session.id);
        }
      } catch (err) {
        console.error('Error loading initial data:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadInitialData();

    // إعداد الـ Socket
    const socket = connectSocket();
    const handleUpdate = (data) => {
      console.log('⚡ Live Update Received:', data);
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

  const startSession = async (courseId) => {
    try {
      const { data } = await client.post('/doctor/sessions', { course_id: courseId });
      setActiveSession(data.session);
      
      const socket = getSocket();
      if (socket) socket.emit('join-session', data.session.id);
      
      startQrRefresh(data.session.id);
      setManualResult(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to start session');
    }
  };

  const endSession = async () => {
    if (!activeSession) return;
    try {
      await client.post(`/doctor/sessions/${activeSession.id}/end`);
      
      const socket = getSocket();
      if (socket) socket.emit('leave-session', activeSession.id);
      
      if (qrIntervalRef.current) clearInterval(qrIntervalRef.current);
      
      setActiveSession(null);
      setQrToken('');
      setManualResult(null);
    } catch (err) { 
      alert('Failed to end session'); 
    }
  };

  // ⚡ الإضافة اليدوية بآخر 5 أرقام
  const handleManualAdd = async (e) => {
    e.preventDefault();
    setManualResult(null);
    try {
      const { data } = await client.post(`/doctor/sessions/${activeSession.id}/manual-add`, { short_id: shortId });
      setManualResult({ success: true, message: data.message, student: data.attendance.full_name });
      setShortId('');
    } catch (err) {
      setManualResult({ success: false, message: err.response?.data?.message || 'Failed to add manually' });
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading...</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
        <h1>Doctor Dashboard</h1>
        <p>Welcome, {user?.full_name} ({user?.role})</p>
        
        {user?.role === 'head' && (
          <button onClick={() => navigate('/head')} style={{ background: 'purple', color: 'white', padding: '8px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            ⚙️ Head Management
          </button>
        )}
        
        <button onClick={() => navigate('/doctor/reports')} style={{ background: 'teal', color: 'white', padding: '8px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          📊 Reports
        </button>
        
        <button onClick={logout} style={{ padding: '8px', cursor: 'pointer' }}>Logout</button>
      </header>

      {activeSession && (
        <section style={{ border: '2px solid green', padding: '20px', margin: '15px 0', background: '#e6ffe6', borderRadius: '8px' }}>
          <h2>🟢 Active Session #{activeSession.id} - {activeSession.course_code}</h2>
          
          <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            
            {/* عرض QR المحاضرة للطلاب */}
            {qrToken && (
              <div style={{ textAlign: 'center' }}>
                <h3>📱 Session QR (For Students)</h3>
                <div style={{ background: 'white', padding: '20px', display: 'inline-block', borderRadius: '10px', boxShadow: '0 0 10px rgba(0,0,0,0.1)' }}>
                  <QRCodeSVG value={qrToken} size={250} />
                </div>
                <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>🔄 Refreshing every 5s</p>
              </div>
            )}

            {/* الإضافة اليدوية */}
            <div style={{ flex: 1, minWidth: '350px', background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 0 10px rgba(0,0,0,0.1)' }}>
              <h3>🛠️ Manual Attendance (Last 5 Digits)</h3>
              <p style={{ fontSize: '14px', color: 'gray', marginBottom: '15px' }}>Enter the last 5 digits of the student's National ID.</p>
              
              <form onSubmit={handleManualAdd} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <input 
                  type="text" 
                  placeholder="e.g. 12345" 
                  value={shortId} 
                  onChange={(e) => setShortId(e.target.value.replace(/\D/g, ''))}
                  maxLength={5}
                  style={{ padding: '10px', flex: 1, border: '1px solid #ccc', borderRadius: '5px', fontSize: '18px', letterSpacing: '3px', textAlign: 'center' }} 
                />
                <button type="submit" style={{ padding: '10px 20px', background: 'green', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Add
                </button>
              </form>

              {manualResult && (
                <div style={{ padding: '15px', background: manualResult.success ? '#d4edda' : '#f8d7da', borderRadius: '5px', border: `1px solid ${manualResult.success ? 'green' : 'red'}` }}>
                  <p style={{ margin: 0 }}>{manualResult.success ? '✅' : '❌'} {manualResult.message}</p>
                  {manualResult.student && <p style={{ margin: '5px 0 0 0' }}><b>Student:</b> {manualResult.student}</p>}
                </div>
              )}
            </div>
          </div>

          <button onClick={endSession} style={{ background: 'red', color: 'white', padding: '10px 20px', marginTop: '20px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
            End Session
          </button>
        </section>
      )}

      {!activeSession && (
        <section>
          <h2>My Courses ({courses.length})</h2>
          {courses.map(c => (
            <div key={c.id} style={{ border: '1px solid #ccc', padding: '15px', margin: '10px 0', borderRadius: '5px', background: '#f9f9f9' }}>
              <h3>{c.course_code} - {c.course_name}</h3>
              <p>Major: {c.major_name} | Year: {c.academic_year} | Students: {c.student_count}</p>
              <button onClick={() => startSession(c.id)} style={{ background: 'green', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
                ▶ Start Session
              </button>
            </div>
          ))}
        </section>
      )}

      <section style={{ marginTop: '30px' }}>
        <h2>⚡ Live Attendance ({liveUpdates.length})</h2>
        {liveUpdates.length === 0 ? (
          <p>No live updates yet.</p>
        ) : (
          liveUpdates.map((u, i) => (
            <div key={i} style={{ border: '1px solid #ccc', padding: '10px', margin: '5px 0', background: '#f0f8ff', borderRadius: '5px' }}>
              <p style={{ margin: 0 }}>👤 <b>{u.full_name}</b> (Method: {u.method})</p>
              <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: 'gray' }}>Time: {new Date(u.at).toLocaleTimeString()}</p>
            </div>
          ))
        )}
      </section>
    </div>
  );
}