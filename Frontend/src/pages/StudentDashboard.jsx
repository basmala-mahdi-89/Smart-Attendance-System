import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [currentTerm, setCurrentTerm] = useState('1');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // ⚡ State لاختيار الكورس
  const [selectedCourseId, setSelectedCourseId] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [coursesRes, attendanceRes, warningsRes] = await Promise.all([
        client.get('/students/me/courses'),
        client.get('/students/me/attendance'),
        client.get('/students/me/warnings')
      ]);
      setCourses(coursesRes.data.courses);
      setCurrentTerm(coursesRes.data.current_term);
      setAttendance(attendanceRes.data);
      setWarnings(warningsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;

  // ⚡ فلترة البيانات بناءً على الكورس المختار
  const filteredCourses = selectedCourseId === 'all' 
    ? courses 
    : courses.filter(c => c.id === parseInt(selectedCourseId));

  const filteredWarnings = selectedCourseId === 'all'
    ? warnings
    : warnings.filter(w => w.course_id === parseInt(selectedCourseId));

  // ⚡ حساب الإحصائيات للكورس المختار
  const displayAttended = filteredCourses.reduce((sum, c) => sum + parseInt(c.attended_sessions || 0), 0);
  const displayTotalSessions = filteredCourses.reduce((sum, c) => sum + parseInt(c.total_sessions || 0), 0);
  const displayWarningsCount = filteredWarnings.length;

  const styles = {
    container: { padding: '30px', fontFamily: 'Segoe UI, sans-serif', backgroundColor: '#f4f7f6', minHeight: '100vh' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', background: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', flexWrap: 'wrap', gap: '10px' },
    headerLeft: { display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' },
    headerRight: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
    tabs: { display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' },
    tabBtn: (isActive) => ({ padding: '10px 20px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', backgroundColor: isActive ? '#007bff' : '#e2e8f0', color: isActive ? '#fff' : '#333' }),
    cardsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' },
    card: { background: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', borderTop: '4px solid #007bff' },
    tableContainer: { background: '#fff', borderRadius: '10px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', overflowX: 'auto', marginBottom: '30px' },
    table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
    th: { padding: '12px 15px', borderBottom: '2px solid #e2e8f0', color: '#4a5568', fontWeight: '600', backgroundColor: '#f8fafc' },
    td: { padding: '12px 15px', borderBottom: '1px solid #e2e8f0', color: '#2d3748' },
    btnPrimary: { padding: '10px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: '#38a169', color: 'white', fontWeight: 'bold' },
    btnBlue: { padding: '10px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: '#3182ce', color: 'white', fontWeight: 'bold' },
    btnRed: { padding: '10px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: '#e53e3e', color: 'white', fontWeight: 'bold' },
    termBadge: { background: '#ebf8ff', color: '#2b6cb0', padding: '6px 12px', borderRadius: '20px', fontWeight: 'bold', fontSize: '14px', border: '1px solid #90cdf4' },
    select: { padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0', fontSize: '16px', minWidth: '300px', marginBottom: '20px' }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div>
            <h1 style={{ margin: 0, color: '#2c3e50' }}>Student Dashboard</h1>
            <p style={{ margin: '5px 0 0 0', color: '#718096' }}>Welcome, <b>{user?.full_name}</b></p>
          </div>
          <div style={styles.termBadge}>
            📅 Active Term: {currentTerm === '2' ? '2nd Term' : '1st Term'}
          </div>
        </div>
        <div style={styles.headerRight}>
          <button onClick={() => navigate('/student/scan')} style={styles.btnBlue}>Scan Doctor QR</button>
          <button onClick={() => navigate('/student/personal-qr')} style={styles.btnBlue}>My Personal QR</button>
          <button onClick={logout} style={styles.btnRed}>Logout</button>
        </div>
      </header>

      <div style={styles.tabs}>
        <button style={styles.tabBtn(activeTab === 'dashboard')} onClick={() => setActiveTab('dashboard')}>Dashboard</button>
        <button style={styles.tabBtn(activeTab === 'courses')} onClick={() => setActiveTab('courses')}>My Courses</button>
        <button style={styles.tabBtn(activeTab === 'attendance')} onClick={() => setActiveTab('attendance')}>Attendance History</button>
        <button style={styles.tabBtn(activeTab === 'warnings')} onClick={() => setActiveTab('warnings')}>Warnings ({warnings.length})</button>
      </div>

      {/* ⚡ القائمة المنسدلة لاختيار الكورس */}
      <div>
        <select 
          style={styles.select} 
          value={selectedCourseId} 
          onChange={(e) => setSelectedCourseId(e.target.value)}
        >
          <option value="all">📚 All Courses</option>
          {courses.map(c => (
            <option key={c.id} value={c.id}>
              {c.course_code} - {c.course_name}
            </option>
          ))}
        </select>
      </div>

      {activeTab === 'dashboard' && (
        <div style={styles.cardsGrid}>
          <div style={styles.card}><h3 style={{ margin: 0, color: '#3182ce' }}>Courses Selected</h3><p style={{ fontSize: '36px', fontWeight: 'bold', margin: '10px 0' }}>{filteredCourses.length}</p></div>
          <div style={styles.card}><h3 style={{ margin: 0, color: '#38a169' }}>Sessions Attended</h3><p style={{ fontSize: '36px', fontWeight: 'bold', margin: '10px 0' }}>{displayAttended}</p></div>
          <div style={styles.card}><h3 style={{ margin: 0, color: '#dd6b20' }}>Total Sessions</h3><p style={{ fontSize: '36px', fontWeight: 'bold', margin: '10px 0' }}>{displayTotalSessions}</p></div>
          <div style={styles.card}><h3 style={{ margin: 0, color: '#805ad5' }}>Warnings</h3><p style={{ fontSize: '36px', fontWeight: 'bold', margin: '10px 0' }}>{displayWarningsCount}</p></div>
        </div>
      )}

      {activeTab === 'courses' && (
        <div style={styles.tableContainer}>
          <h2 style={{ marginTop: 0, color: '#2c3e50' }}>My Courses</h2>
          <table style={styles.table}>
            <thead>
              <tr><th style={styles.th}>Course Code</th><th style={styles.th}>Course Name</th><th style={styles.th}>Major</th><th style={styles.th}>Year / Term</th><th style={styles.th}>Total Sessions</th><th style={styles.th}>Attended</th><th style={styles.th}>Attendance %</th></tr>
            </thead>
            <tbody>
              {filteredCourses.map(c => {
                const pct = c.total_sessions > 0 ? Math.round((c.attended_sessions / c.total_sessions) * 100) : 0;
                return (
                  <tr key={c.id}>
                    <td style={styles.td}><b>{c.course_code}</b></td>
                    <td style={styles.td}>{c.course_name}</td>
                    <td style={styles.td}>{c.major_name}</td>
                    <td style={styles.td}>Year {c.academic_year} - Term {c.term || '1'}</td>
                    <td style={styles.td}>{c.total_sessions}</td>
                    <td style={styles.td}>{c.attended_sessions}</td>
                    <td style={styles.td}><span style={{ color: pct >= 75 ? '#38a169' : '#e53e3e', fontWeight: 'bold' }}>{pct}%</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'attendance' && (
        <div style={styles.tableContainer}>
          <h2 style={{ marginTop: 0, color: '#2c3e50' }}>Attendance History</h2>
          <table style={styles.table}>
            <thead>
              <tr><th style={styles.th}>Course</th><th style={styles.th}>Session Date</th><th style={styles.th}>Method</th><th style={styles.th}>Time</th></tr>
            </thead>
            <tbody>
              {attendance.map(a => (
                <tr key={a.id}>
                  <td style={styles.td}><b>{a.course_code}</b> - {a.course_name}</td>
                  <td style={styles.td}>{a.session_date}</td>
                  <td style={styles.td}><span style={{ textTransform: 'capitalize' }}>{a.method.replace('_', ' ')}</span></td>
                  <td style={styles.td}>{new Date(a.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'warnings' && (
        <div style={styles.tableContainer}>
          <h2 style={{ marginTop: 0, color: '#2c3e50' }}>My Warnings</h2>
          {filteredWarnings.length === 0 ? (
            <p style={{ color: '#718096' }}>No warnings for this selection 🌟</p>
          ) : (
            <div style={{ display: 'grid', gap: '15px' }}>
              {filteredWarnings.map(w => (
                <div key={w.id} style={{ padding: '15px', border: '2px solid #e53e3e', borderRadius: '8px', backgroundColor: '#fed7d7' }}>
                  <h3 style={{ margin: 0, color: '#822727' }}>Warning Level {w.level}</h3>
                  <p style={{ margin: '10px 0' }}><b>{w.course_code}</b> - {w.course_name}</p>
                  <p style={{ margin: '5px 0' }}>Absence: <b>{parseFloat(w.absence_percentage).toFixed(1)}%</b> (Max Allowed: {w.max_allowed}%)</p>
                  <p style={{ fontSize: '13px', color: '#822727' }}>{new Date(w.sent_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}