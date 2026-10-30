import { useEffect, useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import { connectSocket, disconnectSocket, getSocket } from '../api/socket';
import { useNavigate } from 'react-router-dom';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function DoctorDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liveUpdates, setLiveUpdates] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [qrToken, setQrToken] = useState('');
  const qrIntervalRef = useRef(null);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [attendanceList, setAttendanceList] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentTerm, setCurrentTerm] = useState('1');
  
  const [selectedMajor, setSelectedMajor] = useState('all');
  const [selectedGrade, setSelectedGrade] = useState('all');

  const [showScanner, setShowScanner] = useState(false);
  const [scanResult, setScanResult] = useState(null);
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

  const loadAttendanceList = async (sessionId) => {
    try {
      const { data } = await client.get(`/doctor/sessions/${sessionId}/attendance-list`);
      setAttendanceList(data);
    } catch (err) { console.error(err); }
  };

  const removeAttendance = async (attendanceId) => {
    if (!activeSession) return;
    if (!window.confirm('Remove this attendance record?')) return;
    try {
      await client.delete(`/doctor/sessions/${activeSession.id}/attendance/${attendanceId}`);
      loadAttendanceList(activeSession.id);
    } catch (err) { alert(err.response?.data?.message || 'Failed to remove attendance'); }
  };

  useEffect(() => {
    if (!showScanner) return;
    const timeout = setTimeout(() => {
      const scanner = new Html5QrcodeScanner("doctor-reader", { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 }, false);
      scanner.render(
        async (decodedText) => {
          scanner.clear().catch((e) => console.error(e));
          setShowScanner(false);
          try {
            const res = await client.post(`/doctor/sessions/${activeSession.id}/scan-student-qr`, { qr_data: decodedText });
            setScanResult({ success: true, message: res.data.message, student: res.data.student });
            setTimeout(() => setScanResult(null), 3000);
          } catch (err) {
            setScanResult({ success: false, message: err.response?.data?.message || 'Scan failed' });
            setTimeout(() => setScanResult(null), 3000);
          }
        },
        () => {}
      );
    }, 200);
    return () => { clearTimeout(timeout); };
  }, [showScanner, activeSession]);

  useEffect(() => {
    let mounted = true;
    const loadInitialData = async () => {
      try {
        const [coursesRes, sessionData, historyRes] = await Promise.all([
          client.get('/doctor/courses'),
          client.get('/doctor/active-session'),
          client.get('/doctor/sessions/history')
        ]);
        if (mounted) {
          setCourses(coursesRes.data.courses);
          setCurrentTerm(coursesRes.data.current_term);
          setSessionHistory(historyRes.data);
        }
        if (sessionData.data.session && mounted) {
          setActiveSession(sessionData.data.session);
          startQrRefresh(sessionData.data.session.id);
          loadAttendanceList(sessionData.data.session.id);
          const socket = getSocket();
          if (socket) socket.emit('join-session', sessionData.data.session.id);
        }
      } catch (err) { console.error('Error loading initial data:', err); } finally { if (mounted) setLoading(false); }
    };
    loadInitialData();

    const socket = connectSocket();
    const handleUpdate = (data) => {
      setLiveUpdates(prev => [data, ...prev].slice(0, 20));
      setAttendanceList(prev => {
        if (prev.some(item => item.student_id === data.student_id)) return prev;
        return [{ attendance_id: data.attendance_id || Date.now(), student_id: data.student_id, full_name: data.full_name, method: data.method, created_at: data.at || new Date().toISOString() }, ...prev];
      });
    };
    const handleRemove = (data) => {
      if (activeSession && data.session_id === activeSession.id) {
        setAttendanceList(prev => prev.filter(item => item.attendance_id !== data.attendance_id));
      }
    };
    socket.on('attendance-update', handleUpdate);
    socket.on('attendance-removed', handleRemove);

    return () => {
      mounted = false;
      socket.off('attendance-update', handleUpdate);
      socket.off('attendance-removed', handleRemove);
      disconnectSocket();
      if (qrIntervalRef.current) clearInterval(qrIntervalRef.current);
    };
  }, []);

  const startSession = async (courseId) => {
    try {
      const { data } = await client.post('/doctor/sessions', { course_id: courseId });
      setActiveSession(data.session);
      setAttendanceList([]); setLiveUpdates([]); setManualResult(null); setScanResult(null);
      const socket = getSocket();
      if (socket) socket.emit('join-session', data.session.id);
      startQrRefresh(data.session.id);
      setActiveTab('dashboard');
    } catch (err) { alert(err.response?.data?.message || 'Failed to start session'); }
  };

  const endSession = async () => {
    if (!activeSession) return;
    setShowScanner(false);
    try {
      await client.post(`/doctor/sessions/${activeSession.id}/end`);
      const socket = getSocket();
      if (socket) socket.emit('leave-session', activeSession.id);
      if (qrIntervalRef.current) clearInterval(qrIntervalRef.current);
      setActiveSession(null); setQrToken(''); setManualResult(null); setScanResult(null); setAttendanceList([]);
    } catch (err) { alert('Failed to end session'); }
  };

  const handleManualAdd = async (e) => {
    e.preventDefault(); setManualResult(null);
    try {
      const { data } = await client.post(`/doctor/sessions/${activeSession.id}/manual-add`, { short_id: shortId });
      setManualResult({ success: true, message: data.message, student: data.attendance.full_name });
      setShortId(''); loadAttendanceList(activeSession.id);
    } catch (err) { setManualResult({ success: false, message: err.response?.data?.message || 'Failed to add manually' }); }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading Doctor Dashboard...</div>;

  const uniqueMajors = [...new Set(courses.map(c => c.major_name))];
  const uniqueGrades = ['1', '2', '3', '4'].filter(grade => courses.some(c => c.academic_year === grade));

  const filteredCourses = courses.filter(c => {
    const matchMajor = selectedMajor === 'all' || c.major_name === selectedMajor;
    const matchGrade = selectedGrade === 'all' || c.academic_year === selectedGrade;
    return matchMajor && matchGrade;
  });

  // ⚡ حساب الإحصائيات بناءً على الفلترة
  const dynamicStats = {
    totalCourses: filteredCourses.length,
    totalSessions: filteredCourses.reduce((sum, c) => sum + parseInt(c.total_sessions || 0), 0),
    completedSessions: filteredCourses.reduce((sum, c) => sum + parseInt(c.completed_sessions || 0), 0),
    activeSessions: filteredCourses.reduce((sum, c) => sum + parseInt(c.active_sessions || 0), 0),
    uniqueStudents: filteredCourses.reduce((sum, c) => sum + parseInt(c.unique_students_attended || 0), 0)
  };

  const styles = {
    container: { padding: '30px', fontFamily: 'Segoe UI, sans-serif', backgroundColor: '#f4f7f6', minHeight: '100vh' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', background: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', flexWrap: 'wrap', gap: '10px' },
    headerLeft: { display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' },
    headerRight: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
    tabs: { display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' },
    tabBtn: (isActive) => ({ padding: '10px 20px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', backgroundColor: isActive ? '#007bff' : '#e2e8f0', color: isActive ? '#fff' : '#333' }),
    cardsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '30px' },
    card: { background: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', textAlign: 'center', borderTop: '4px solid #007bff' },
    cardTitle: { fontSize: '14px', color: '#666', margin: 0, textTransform: 'uppercase' },
    cardValue: { fontSize: '32px', fontWeight: 'bold', color: '#2c3e50', margin: '10px 0 0 0' },
    tableContainer: { background: '#fff', borderRadius: '10px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', overflowX: 'auto', marginBottom: '30px' },
    table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
    th: { padding: '12px 15px', borderBottom: '2px solid #e2e8f0', color: '#4a5568', fontWeight: '600', backgroundColor: '#f8fafc' },
    td: { padding: '12px 15px', borderBottom: '1px solid #e2e8f0', color: '#2d3748' },
    btnPrimary: { padding: '10px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: '#38a169', color: 'white', fontWeight: 'bold' },
    btnBlue: { padding: '10px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: '#3182ce', color: 'white', fontWeight: 'bold' },
    btnPurple: { padding: '10px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: '#805ad5', color: 'white', fontWeight: 'bold' },
    btnRed: { padding: '10px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: '#e53e3e', color: 'white', fontWeight: 'bold' },
    btnSmall: { padding: '5px 10px', borderRadius: '4px', border: 'none', cursor: 'pointer', color: 'white', fontSize: '12px', marginRight: '5px', fontWeight: 'bold' },
    input: { padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0', fontSize: '16px' },
    select: { padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0', fontSize: '15px', minWidth: '150px', marginRight: '10px' },
    badge: (active) => ({ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold', backgroundColor: active ? '#c6f6d5' : '#fed7d7', color: active ? '#22543d' : '#822727' }),
    termBadge: { background: '#ebf8ff', color: '#2b6cb0', padding: '6px 12px', borderRadius: '20px', fontWeight: 'bold', fontSize: '14px', border: '1px solid #90cdf4' }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div>
            <h1 style={{ margin: 0, color: '#2c3e50' }}>Doctor Dashboard</h1>
            <p style={{ margin: '5px 0 0 0', color: '#718096' }}>Welcome, <b>{user?.full_name}</b> ({user?.role})</p>
          </div>
          <div style={styles.termBadge}>
            📅 Active Term: {currentTerm === '2' ? '2nd Term' : '1st Term'}
          </div>
        </div>
        <div style={styles.headerRight}>
          {user?.role === 'head' && (
            <button onClick={() => navigate('/head')} style={styles.btnPurple}>Head Management</button>
          )}
          <button onClick={() => navigate('/doctor/reports')} style={styles.btnBlue}>Reports</button>
          <button onClick={logout} style={styles.btnRed}>Logout</button>
        </div>
      </header>

      <div style={styles.tabs}>
        <button style={styles.tabBtn(activeTab === 'dashboard')} onClick={() => setActiveTab('dashboard')}>Dashboard</button>
        <button style={styles.tabBtn(activeTab === 'courses')} onClick={() => setActiveTab('courses')}>My Courses</button>
        <button style={styles.tabBtn(activeTab === 'history')} onClick={() => setActiveTab('history')}>Session History</button>
      </div>

      {activeTab === 'dashboard' && (
        <>
          {/* ⚡ الفلاتر */}
          <div style={{ marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <select style={styles.select} value={selectedMajor} onChange={(e) => setSelectedMajor(e.target.value)}>
              <option value="all">All Majors</option>
              {uniqueMajors.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select style={styles.select} value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)}>
              <option value="all">All Grades</option>
              {uniqueGrades.map(g => <option key={g} value={g}>Year {g}</option>)}
            </select>
          </div>

          {/* ⚡ الإحصائيات الديناميكية */}
          <div style={styles.cardsGrid}>
            <div style={styles.card}><p style={styles.cardTitle}>Courses (Filtered)</p><p style={styles.cardValue}>{dynamicStats.totalCourses}</p></div>
            <div style={styles.card}><p style={styles.cardTitle}>Total Sessions</p><p style={styles.cardValue}>{dynamicStats.totalSessions}</p></div>
            <div style={styles.card}><p style={styles.cardTitle}>Completed</p><p style={styles.cardValue}>{dynamicStats.completedSessions}</p></div>
            <div style={styles.card}><p style={styles.cardTitle}>Active</p><p style={styles.cardValue}>{dynamicStats.activeSessions}</p></div>
            <div style={styles.card}><p style={styles.cardTitle}>Unique Students</p><p style={styles.cardValue}>{dynamicStats.uniqueStudents}</p></div>
          </div>

          {activeSession && (
            <div style={{ background: '#fff', borderRadius: '10px', padding: '25px', marginBottom: '30px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', border: '2px solid #38a169' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                <h2 style={{ margin: 0, color: '#2c3e50' }}>🟢 Active Session #{activeSession.id} - {activeSession.course_code}</h2>
                <span style={styles.badge(true)}>ACTIVE</span>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '25px' }}>
                {qrToken && (
                  <div style={{ textAlign: 'center', background: '#f8fafc', padding: '20px', borderRadius: '8px' }}>
                    <h3 style={{ marginTop: 0 }}>Session QR Code</h3>
                    <div style={{ background: 'white', padding: '15px', display: 'inline-block', borderRadius: '10px' }}>
                      <QRCodeSVG value={qrToken} size={220} />
                    </div>
                    <p style={{ fontSize: '13px', color: '#718096', marginTop: '10px' }}>Refreshing every 5 seconds</p>
                  </div>
                )}

                <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', border: '2px solid #805ad5' }}>
                  <h3 style={{ marginTop: 0, color: '#553c9a' }}>📱 Scan Student's Personal QR</h3>
                  {!showScanner ? (
                    <button onClick={() => setShowScanner(true)} style={{ ...styles.btnPurple, marginTop: '15px' }}>Start Camera Scanner</button>
                  ) : (
                    <div style={{ marginTop: '15px' }}>
                      <div id="doctor-reader" style={{ width: '100%', borderRadius: '8px', overflow: 'hidden' }}></div>
                      <button onClick={() => setShowScanner(false)} style={{ ...styles.btnRed, marginTop: '10px', width: '100%' }}>Stop Scanner</button>
                    </div>
                  )}
                  {scanResult && (
                    <div style={{ marginTop: '12px', padding: '12px', background: scanResult.success ? '#c6f6d5' : '#fed7d7', borderRadius: '6px', color: scanResult.success ? '#22543d' : '#822727' }}>
                      {scanResult.success ? '✅' : '❌'} {scanResult.message}
                    </div>
                  )}
                </div>

                <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px' }}>
                  <h3 style={{ marginTop: 0 }}>Manual Attendance</h3>
                  <form onSubmit={handleManualAdd} style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                    <input type="text" placeholder="12345" value={shortId} onChange={(e) => setShortId(e.target.value.replace(/\D/g, ''))} maxLength={5} style={{ ...styles.input, flex: 1, textAlign: 'center', fontSize: '20px' }} />
                    <button type="submit" style={styles.btnPrimary}>Add</button>
                  </form>
                  {manualResult && (
                    <div style={{ padding: '12px', background: manualResult.success ? '#c6f6d5' : '#fed7d7', borderRadius: '6px' }}>
                      {manualResult.success ? '✅' : '❌'} {manualResult.message}
                    </div>
                  )}
                </div>
              </div>
              <button onClick={endSession} style={{ ...styles.btnRed, marginTop: '25px' }}>End Session</button>
            </div>
          )}

          {!activeSession && (
            <div style={styles.tableContainer}>
              <h2 style={{ marginTop: 0, color: '#2c3e50' }}>Start New Session</h2>
              <table style={styles.table}>
                <thead>
                  <tr><th style={styles.th}>Course Code</th><th style={styles.th}>Course Name</th><th style={styles.th}>Major</th><th style={styles.th}>Year / Term</th><th style={styles.th}>Students</th><th style={styles.th}>Action</th></tr>
                </thead>
                <tbody>
                  {filteredCourses.length === 0 ? (
                    <tr><td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: 'gray' }}>No courses found.</td></tr>
                  ) : (
                    filteredCourses.map(c => (
                      <tr key={c.id}>
                        <td style={styles.td}><b>{c.course_code}</b></td>
                        <td style={styles.td}>{c.course_name}</td>
                        <td style={styles.td}>{c.major_name}</td>
                        <td style={styles.td}>Year {c.academic_year} - Term {c.term || '1'}</td>
                        <td style={styles.td}>{c.student_count}</td>
                        <td style={styles.td}><button onClick={() => startSession(c.id)} style={styles.btnPrimary}>Start Session</button></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div style={styles.tableContainer}>
            <h2 style={{ marginTop: 0, color: '#2c3e50' }}>⚡ Live Attendance</h2>
            {liveUpdates.length === 0 ? (
              <p style={{ color: '#718096' }}>No live updates yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: '8px' }}>
                {liveUpdates.map((u, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 15px', background: '#ebf8ff', borderRadius: '6px', borderLeft: '4px solid #3182ce' }}>
                    <span>👤 <b>{u.full_name}</b> marked present via <b>{u.method}</b></span>
                    <span style={{ color: '#718096', fontSize: '13px' }}>{new Date(u.at).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'courses' && (
        <div style={styles.tableContainer}>
          <h2 style={{ marginTop: 0, color: '#2c3e50' }}>My Courses</h2>
          <table style={styles.table}>
            <thead>
              <tr><th style={styles.th}>Course</th><th style={styles.th}>Major</th><th style={styles.th}>Year / Term</th><th style={styles.th}>Students</th><th style={styles.th}>Engineers</th><th style={styles.th}>Role</th></tr>
            </thead>
            <tbody>
              {courses.map(c => (
                <tr key={c.id}>
                  <td style={styles.td}><b>{c.course_code}</b> - {c.course_name}</td>
                  <td style={styles.td}>{c.major_name}</td>
                  <td style={styles.td}>Year {c.academic_year} - Term {c.term || '1'}</td>
                  <td style={styles.td}>{c.student_count}</td>
                  <td style={styles.td}>{c.engineers?.join(', ') || 'None'}</td>
                  <td style={styles.td}><span style={{ textTransform: 'capitalize' }}>{c.role_in_course}</span> {c.is_primary && '(Primary)'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'history' && (
        <div style={styles.tableContainer}>
          <h2 style={{ marginTop: 0, color: '#2c3e50' }}>Session History</h2>
          <table style={styles.table}>
            <thead>
              <tr><th style={styles.th}>Session ID</th><th style={styles.th}>Course</th><th style={styles.th}>Date</th><th style={styles.th}>Start Time</th><th style={styles.th}>End Time</th><th style={styles.th}>Type</th><th style={styles.th}>Attendance</th><th style={styles.th}>Status</th></tr>
            </thead>
            <tbody>
              {sessionHistory.map(s => (
                <tr key={s.id}>
                  <td style={styles.td}>#{s.id}</td>
                  <td style={styles.td}><b>{s.course_code}</b> - {s.course_name}</td>
                  <td style={styles.td}>{s.session_date}</td>
                  <td style={styles.td}>{s.start_time ? new Date(s.start_time).toLocaleTimeString() : '-'}</td>
                  <td style={styles.td}>{s.end_time ? new Date(s.end_time).toLocaleTimeString() : '-'}</td>
                  <td style={styles.td}><span style={{ textTransform: 'capitalize' }}>{s.type}</span></td>
                  <td style={styles.td}>{s.attendance_count} / {s.enrolled_count}</td>
                  <td style={styles.td}><span style={styles.badge(s.is_active)}>{s.is_active ? 'Active' : 'Completed'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}