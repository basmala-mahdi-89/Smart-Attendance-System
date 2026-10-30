import { useEffect, useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import { connectSocket, disconnectSocket, getSocket } from '../api/socket';
import { useNavigate } from 'react-router-dom';

export default function EngineerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liveUpdates, setLiveUpdates] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [qrToken, setQrToken] = useState('');
  const qrIntervalRef = useRef(null);
  const [currentTerm, setCurrentTerm] = useState('1');

  // ⚡ States للفلترة
  const [selectedMajor, setSelectedMajor] = useState('all');
  const [selectedGrade, setSelectedGrade] = useState('all');

  const [shortId, setShortId] = useState('');
  const [manualResult, setManualResult] = useState(null);

  const startQrRefresh = (sessionId) => {
    const fetchQR = async () => {
      try {
        const { data } = await client.get(`/doctor/sessions/${sessionId}/qr`);
        setQrToken(data.token);
      } catch (err) { console.error('QR error:', err); }
    };
    fetchQR();
    if (qrIntervalRef.current) clearInterval(qrIntervalRef.current);
    qrIntervalRef.current = setInterval(fetchQR, 5000);
  };

  useEffect(() => {
    let mounted = true;
    
    const loadInitialData = async () => {
      try {
        const { data: coursesData } = await client.get('/doctor/courses');
        if (mounted) {
          setCourses(coursesData.courses);
          setCurrentTerm(coursesData.current_term);
        }

        const { data: sessionData } = await client.get('/doctor/active-session');
        if (sessionData.session && mounted) {
          setActiveSession(sessionData.session);
          startQrRefresh(sessionData.session.id);
          const socket = getSocket();
          if (socket) socket.emit('join-session', sessionData.session.id);
        }
      } catch (err) { console.error(err); } finally { if (mounted) setLoading(false); }
    };
    loadInitialData();

    const socket = connectSocket();
    const handleUpdate = (data) => {
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
    } catch (err) { alert(err.response?.data?.message || 'Failed to start session'); }
  };

  const endSession = async () => {
    if (!activeSession) return;
    try {
      await client.post(`/doctor/sessions/${activeSession.id}/end`);
      const socket = getSocket();
      if (socket) socket.emit('leave-session', activeSession.id);
      if (qrIntervalRef.current) clearInterval(qrIntervalRef.current);
      setActiveSession(null); setQrToken(''); setManualResult(null);
    } catch (err) { alert('Failed to end session'); }
  };

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

  // ⚡ استخراج التخصصات والفرق المتاحة للمهندس
  const uniqueMajors = [...new Set(courses.map(c => c.major_name))];
  const uniqueGrades = ['1', '2', '3', '4'].filter(grade => courses.some(c => c.academic_year === grade));

  // ⚡ فلترة الكورسات
  const filteredCourses = courses.filter(c => {
    const matchMajor = selectedMajor === 'all' || c.major_name === selectedMajor;
    const matchGrade = selectedGrade === 'all' || c.academic_year === selectedGrade;
    return matchMajor && matchGrade;
  });

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <h1>Engineer Dashboard</h1>
        <p>Welcome, {user?.full_name} (Engineer)</p>
        
        <div style={{ background: '#ebf8ff', color: '#2b6cb0', padding: '6px 12px', borderRadius: '20px', fontWeight: 'bold', fontSize: '14px', border: '1px solid #90cdf4' }}>
          📅 Active Term: {currentTerm === '2' ? '2nd Term' : '1st Term'}
        </div>

        <button onClick={() => navigate('/doctor/reports')} style={{ background: 'teal', color: 'white', padding: '8px', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          📊 Reports
        </button>
        
        <button onClick={logout} style={{ padding: '8px', cursor: 'pointer' }}>Logout</button>
      </header>

      {activeSession && (
        <section style={{ border: '2px solid #007bff', padding: '20px', margin: '15px 0', background: '#e6f2ff', borderRadius: '8px' }}>
          <h2>🔵 Active Section #{activeSession.id} - {activeSession.course_code}</h2>
          
          <div style={{ display: 'flex', gap: '30px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            
            {qrToken && (
              <div style={{ textAlign: 'center' }}>
                <h3>📱 Section QR (For Students)</h3>
                <div style={{ background: 'white', padding: '20px', display: 'inline-block', borderRadius: '10px', boxShadow: '0 0 10px rgba(0,0,0,0.1)' }}>
                  <QRCodeSVG value={qrToken} size={250} />
                </div>
                <p style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>🔄 Refreshing every 5s</p>
              </div>
            )}

            <div style={{ flex: 1, minWidth: '350px', background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 0 10px rgba(0,0,0,0.1)' }}>
              <h3>🛠️ Manual Attendance (Last 5 Digits)</h3>
              <form onSubmit={handleManualAdd} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <input type="text" placeholder="e.g. 12345" value={shortId} onChange={(e) => setShortId(e.target.value.replace(/\D/g, ''))} maxLength={5} style={{ padding: '10px', flex: 1, border: '1px solid #ccc', borderRadius: '5px', fontSize: '18px', textAlign: 'center' }} />
                <button type="submit" style={{ padding: '10px 20px', background: 'green', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>Add</button>
              </form>
              {manualResult && (
                <div style={{ padding: '15px', background: manualResult.success ? '#d4edda' : '#f8d7da', borderRadius: '5px', border: `1px solid ${manualResult.success ? 'green' : 'red'}` }}>
                  <p style={{ margin: 0 }}>{manualResult.success ? '✅' : '❌'} {manualResult.message}</p>
                </div>
              )}
            </div>
          </div>

          <button onClick={endSession} style={{ background: 'red', color: 'white', padding: '10px 20px', marginTop: '20px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
            End Section
          </button>
        </section>
      )}

      {!activeSession && (
        <section>
          <h2>My Courses ({filteredCourses.length})</h2>

          {/* ⚡ الفلاتر */}
          <div style={{ marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <select style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0' }} value={selectedMajor} onChange={(e) => setSelectedMajor(e.target.value)}>
              <option value="all">All Majors</option>
              {uniqueMajors.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0' }} value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)}>
              <option value="all">All Grades</option>
              {uniqueGrades.map(g => <option key={g} value={g}>Year {g}</option>)}
            </select>
          </div>

          {filteredCourses.length === 0 ? (
            <p style={{ color: 'gray' }}>No courses found for this selection.</p>
          ) : (
            filteredCourses.map(c => (
              <div key={c.id} style={{ border: '1px solid #ccc', padding: '15px', margin: '10px 0', borderRadius: '5px', background: '#f9f9f9' }}>
                <h3>{c.course_code} - {c.course_name}</h3>
                <p>Major: {c.major_name} | Year: {c.academic_year} - Term {c.term || '1'} | Students: {c.student_count}</p>
                <button onClick={() => startSession(c.id)} style={{ background: 'blue', color: 'white', padding: '10px 20px', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}>
                  ▶ Start Section
                </button>
              </div>
            ))
          )}
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