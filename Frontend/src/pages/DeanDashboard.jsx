import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';

export default function DeanDashboard() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [selectedMajor, setSelectedMajor] = useState('all');
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [filterRole, setFilterRole] = useState('all');

  const [invitations, setInvitations] = useState([]);

  const [majors, setMajors] = useState([]);
  const [majorForm, setMajorForm] = useState({ name: '' });
  const [editingMajor, setEditingMajor] = useState(null);

  const [broadcastForm, setBroadcastForm] = useState({
    subject: '',
    message: '',
    warning_type: 'general',
    major_id: '',
    academic_year: '',
    target: 'all'
  });

  const [attendanceOverview, setAttendanceOverview] = useState([]);
  const [highRiskStudents, setHighRiskStudents] = useState([]);
  const [highRiskThreshold, setHighRiskThreshold] = useState(75);
  const [staffActivity, setStaffActivity] = useState([]);

  const [activeSessions, setActiveSessions] = useState([]);

  const [analytics, setAnalytics] = useState(null);

  const [auditLogs, setAuditLogs] = useState([]);
  const [auditTotal, setAuditTotal] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [dashRes, majorsRes, invitesRes, sessionsRes] = await Promise.all([
        client.get('/dean/dashboard-data'),
        client.get('/dean/majors'),
        client.get('/dean/invitations'),
        client.get('/dean/active-sessions')
      ]);
      setData({ ...dashRes.data, majorsList: majorsRes.data });
      setInvitations(invitesRes.data);
      setMajors(majorsRes.data);
      setActiveSessions(Array.isArray(sessionsRes.data) ? sessionsRes.data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUserAction = async (type, id, action) => {
    if (action === 'delete' && !window.confirm('Are you sure you want to permanently delete this user?')) return;
    try {
      if (action === 'delete') {
        await client.delete(`/dean/users/${type}/${id}`);
      } else {
        const newStatus = action === 'block' ? 'banned' : 'active';
        await client.put(`/dean/users/${type}/${id}/status`, { status: newStatus });
      }
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Action failed');
    }
  };

  const cancelInvite = async (id) => {
    if (!window.confirm('Cancel this invitation?')) return;
    try {
      await client.delete(`/dean/invitations/${id}`);
      loadData();
    } catch (err) { alert('Failed to cancel'); }
  };

  const addMajor = async (e) => {
    e.preventDefault();
    if (!majorForm.name.trim()) return alert('Major name is required');
    try {
      await client.post('/dean/majors', { name: majorForm.name });
      setMajorForm({ name: '' });
      loadData();
      alert('Major added successfully');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add major');
    }
  };

  const updateMajor = async (e) => {
    e.preventDefault();
    if (!editingMajor || !editingMajor.name.trim()) return alert('Major name is required');
    try {
      await client.put(`/dean/majors/${editingMajor.id}`, { name: editingMajor.name });
      setEditingMajor(null);
      loadData();
      alert('Major updated successfully');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update major');
    }
  };

  const deleteMajor = async (id) => {
    if (!window.confirm('Are you sure you want to delete this major?')) return;
    try {
      await client.delete(`/dean/majors/${id}`);
      loadData();
      alert('Major deleted successfully');
    } catch (err) {
      const d = err.response?.data;
      if (d?.details) {
        alert(`${d.message}\nStudents: ${d.details.students}, Courses: ${d.details.courses}, Staff: ${d.details.staff}`);
      } else {
        alert(d?.message || 'Failed to delete major');
      }
    }
  };

  const sendBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastForm.subject.trim() || !broadcastForm.message.trim()) {
      return alert('Subject and message are required');
    }
    try {
      const payload = {
        subject: broadcastForm.subject,
        message: broadcastForm.message,
        warning_type: broadcastForm.warning_type
      };
      if (broadcastForm.target === 'major' && broadcastForm.major_id) payload.major_id = parseInt(broadcastForm.major_id);
      if (broadcastForm.target === 'year' && broadcastForm.major_id && broadcastForm.academic_year) {
        payload.major_id = parseInt(broadcastForm.major_id);
        payload.academic_year = broadcastForm.academic_year;
      }
      const res = await client.post('/dean/broadcast-warning', payload);
      alert(res.data.message);
      setBroadcastForm({ subject: '', message: '', warning_type: 'general', major_id: '', academic_year: '', target: 'all' });
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send broadcast');
    }
  };

  const loadAttendanceOverview = async () => {
    try { const res = await client.get('/dean/reports/attendance-overview'); setAttendanceOverview(res.data); } catch (err) { console.error(err); }
  };

  const loadHighRiskStudents = async () => {
    try { const res = await client.get(`/dean/reports/high-risk-students?threshold=${highRiskThreshold}`); setHighRiskStudents(res.data.students || []); } catch (err) { console.error(err); }
  };

  const loadStaffActivity = async () => {
    try { const res = await client.get('/dean/reports/staff-activity'); setStaffActivity(res.data); } catch (err) { console.error(err); }
  };

  const loadActiveSessions = async () => {
    try { const res = await client.get('/dean/active-sessions'); setActiveSessions(res.data); } catch (err) { console.error(err); }
  };

  const forceCloseSession = async (id) => {
    if (!window.confirm('Are you sure you want to force close this session?')) return;
    try {
      await client.post(`/dean/sessions/${id}/force-close`);
      loadActiveSessions();
      loadData();
      alert('Session force-closed successfully');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to close session');
    }
  };

  const loadAnalytics = async () => {
    try { const res = await client.get('/dean/analytics'); setAnalytics(res.data); } catch (err) { console.error(err); }
  };

  const loadAuditLogs = async () => {
    try { const res = await client.get('/dean/audit-logs?limit=50'); setAuditLogs(res.data.logs || []); setAuditTotal(res.data.total || 0); } catch (err) { console.error(err); }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading Dean Dashboard...</div>;
  if (!data) return <div style={{ padding: '40px', textAlign: 'center', color: 'red' }}>Failed to load data.</div>;

  const matchMajor = (name) => selectedMajor === 'all' || name === selectedMajor;
  const matchYear = (year) => selectedGrade === 'all' || String(year) === String(selectedGrade);
  const matchRole = (role) => filterRole === 'all' || role === filterRole;

  const filteredStudents = (data.students || []).filter(s =>
    matchMajor(s.major_name) && matchYear(s.academic_year)
  );
  const filteredStaff = (data.staff || []).filter(s =>
    matchMajor(s.major_name) && matchRole(s.role)
  );
  const filteredInvitations = invitations.filter(inv =>
    matchMajor(inv.major_name) && matchRole(inv.role)
  );
  const filteredCourses = (data.courses || []).filter(c =>
    matchMajor(c.major_name) && matchYear(c.academic_year)
  );
  const filteredSessions = activeSessions.filter(s =>
    matchMajor(s.major_name) && matchYear(s.academic_year)
  );
  const filteredAttendanceOverview = attendanceOverview.filter(a =>
    matchMajor(a.major_name)
  );
  const filteredHighRisk = highRiskStudents.filter(s =>
    matchMajor(s.major_name) && matchYear(s.academic_year)
  );
  const filteredStaffActivity = staffActivity.filter(st =>
    matchMajor(st.major_name) && matchRole(st.role)
  );
  const filteredMostAbsent = (analytics?.most_absent_students || []).filter(s =>
    matchMajor(s.major_name) && matchYear(s.academic_year)
  );
  const filteredCourseCompletion = (analytics?.course_completion || []).filter(c =>
    matchMajor(c.major_name) && matchYear(c.academic_year)
  );

  const filteredStats = {
    total_students: filteredStudents.length,
    total_courses: filteredCourses.length,
    total_doctors: filteredStaff.filter(s => s.role === 'doctor').length,
    total_engineers: filteredStaff.filter(s => s.role === 'engineer').length,
    active_sessions: filteredSessions.length
  };

  const showFilters = ['overview', 'invitations', 'staff', 'students', 'reports', 'sessions', 'analytics'].includes(activeTab);
  const showYearFilter = ['overview', 'students', 'reports', 'sessions', 'analytics'].includes(activeTab);
  const showRoleFilter = ['invitations', 'staff', 'reports'].includes(activeTab);

  const styles = {
    container: { padding: '30px', fontFamily: 'Segoe UI, sans-serif', backgroundColor: '#f4f7f6', minHeight: '100vh' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', background: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' },
    tabs: { display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' },
    tabBtn: (isActive) => ({ padding: '10px 20px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '15px', backgroundColor: isActive ? '#007bff' : '#e2e8f0', color: isActive ? '#fff' : '#333' }),
    cardsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' },
    card: { background: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', textAlign: 'center', borderTop: '4px solid #007bff' },
    cardTitle: { fontSize: '14px', color: '#666', margin: 0, textTransform: 'uppercase' },
    cardValue: { fontSize: '32px', fontWeight: 'bold', color: '#2c3e50', margin: '10px 0 0 0' },
    tableContainer: { background: '#fff', borderRadius: '10px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', overflowX: 'auto', marginBottom: '30px' },
    table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
    th: { padding: '12px 15px', borderBottom: '2px solid #e2e8f0', color: '#4a5568', fontWeight: '600', backgroundColor: '#f8fafc' },
    td: { padding: '12px 15px', borderBottom: '1px solid #e2e8f0', color: '#2d3748' },
    select: { padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0', fontSize: '16px', minWidth: '200px', marginRight: '15px' },
    input: { padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0', fontSize: '15px' },
    textarea: { padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0', fontSize: '15px', width: '100%', minHeight: '100px', fontFamily: 'inherit' },
    badge: (status) => ({
      padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold',
      backgroundColor: status === 'active' ? '#c6f6d5' : status === 'pending' ? '#fefcbf' : '#fed7d7',
      color: status === 'active' ? '#22543d' : status === 'pending' ? '#744210' : '#822727'
    }),
    btnSmall: { padding: '5px 10px', borderRadius: '4px', border: 'none', cursor: 'pointer', color: 'white', fontSize: '12px', marginRight: '5px', fontWeight: 'bold' }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div>
          <h1 style={{ margin: 0, color: '#2c3e50' }}>Dean's Dashboard</h1>
          <p style={{ margin: '5px 0 0 0', color: '#718096' }}>Welcome back, <b>{user?.full_name}</b></p>
        </div>
        <button onClick={logout} style={{ ...styles.btnSmall, background: '#e53e3e', padding: '10px 20px', fontSize: '15px' }}>Logout</button>
      </header>

      <div style={styles.tabs}>
        <button style={styles.tabBtn(activeTab === 'overview')} onClick={() => setActiveTab('overview')}>Overview</button>
        <button style={styles.tabBtn(activeTab === 'invitations')} onClick={() => setActiveTab('invitations')}>Pending Invitations</button>
        <button style={styles.tabBtn(activeTab === 'staff')} onClick={() => setActiveTab('staff')}>Manage Staff</button>
        <button style={styles.tabBtn(activeTab === 'students')} onClick={() => setActiveTab('students')}>Manage Students</button>
        <button style={styles.tabBtn(activeTab === 'majors')} onClick={() => setActiveTab('majors')}>Majors</button>
        <button style={styles.tabBtn(activeTab === 'broadcast')} onClick={() => setActiveTab('broadcast')}>Broadcast Warning</button>
        <button style={styles.tabBtn(activeTab === 'reports')} onClick={() => { setActiveTab('reports'); loadAttendanceOverview(); loadHighRiskStudents(); loadStaffActivity(); }}>Reports</button>
        <button style={styles.tabBtn(activeTab === 'sessions')} onClick={() => { setActiveTab('sessions'); loadActiveSessions(); }}>Live Sessions</button>
        <button style={styles.tabBtn(activeTab === 'analytics')} onClick={() => { setActiveTab('analytics'); loadAnalytics(); }}>Analytics</button>
        <button style={styles.tabBtn(activeTab === 'audit')} onClick={() => { setActiveTab('audit'); loadAuditLogs(); }}>Audit Logs</button>
      </div>

      {showFilters && (
        <div style={{ marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          <select style={styles.select} value={selectedMajor} onChange={(e) => setSelectedMajor(e.target.value)}>
            <option value="all">All Majors</option>
            {(data.majorsList || []).map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
          </select>
          {showYearFilter && (
            <select style={styles.select} value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)}>
              <option value="all">All Years</option>
              <option value="1">Year 1</option>
              <option value="2">Year 2</option>
              <option value="3">Year 3</option>
              <option value="4">Year 4</option>
            </select>
          )}
          {showRoleFilter && (
            <select style={styles.select} value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
              <option value="all">All Roles</option>
              <option value="head">Heads</option>
              <option value="doctor">Doctors</option>
              <option value="engineer">Engineers</option>
            </select>
          )}
        </div>
      )}

      {activeTab === 'overview' && (
        <>
          <div style={styles.cardsGrid}>
            <div style={styles.card}><p style={styles.cardTitle}>Students</p><p style={styles.cardValue}>{filteredStats.total_students}</p></div>
            <div style={styles.card}><p style={styles.cardTitle}>Courses</p><p style={styles.cardValue}>{filteredStats.total_courses}</p></div>
            <div style={styles.card}><p style={styles.cardTitle}>Doctors</p><p style={styles.cardValue}>{filteredStats.total_doctors}</p></div>
            <div style={styles.card}><p style={styles.cardTitle}>Engineers</p><p style={styles.cardValue}>{filteredStats.total_engineers}</p></div>
            <div style={styles.card}><p style={styles.cardTitle}>Active Sessions</p><p style={styles.cardValue}>{filteredStats.active_sessions}</p></div>
          </div>
        </>
      )}

      {activeTab === 'invitations' && (
        <div style={styles.tableContainer}>
          <h2 style={{ marginTop: 0, color: '#2c3e50' }}>Pending Invitations ({filteredInvitations.length})</h2>
          <table style={styles.table}>
            <thead>
              <tr><th style={styles.th}>Name</th><th style={styles.th}>Email</th><th style={styles.th}>Role</th><th style={styles.th}>Major</th><th style={styles.th}>Action</th></tr>
            </thead>
            <tbody>
              {filteredInvitations.map(inv => (
                <tr key={inv.id}>
                  <td style={styles.td}>{inv.full_name}</td>
                  <td style={styles.td}>{inv.email}</td>
                  <td style={styles.td}><span style={{ textTransform: 'capitalize' }}>{inv.role}</span></td>
                  <td style={styles.td}>{inv.major_name || '-'}</td>
                  <td style={styles.td}>
                    <button onClick={() => cancelInvite(inv.id)} style={{ ...styles.btnSmall, background: '#e53e3e' }}>Cancel</button>
                  </td>
                </tr>
              ))}
              {filteredInvitations.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center' }}>No pending invitations.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'staff' && (
        <div style={styles.tableContainer}>
          <h2 style={{ marginTop: 0, color: '#2c3e50' }}>Manage Staff ({filteredStaff.length})</h2>
          <table style={styles.table}>
            <thead>
              <tr><th style={styles.th}>Name</th><th style={styles.th}>Role</th><th style={styles.th}>Major</th><th style={styles.th}>Status</th><th style={styles.th}>Actions</th></tr>
            </thead>
            <tbody>
              {filteredStaff.map(s => {
                const currentStatus = s.status || 'active';
                return (
                  <tr key={s.id}>
                    <td style={styles.td}><b>{s.full_name}</b></td>
                    <td style={styles.td}><span style={{ textTransform: 'capitalize' }}>{s.role}</span></td>
                    <td style={styles.td}>{s.major_name || '-'}</td>
                    <td style={styles.td}><span style={styles.badge(currentStatus)}>{currentStatus}</span></td>
                    <td style={styles.td}>
                      {currentStatus === 'active' 
                        ? <button onClick={() => handleUserAction('staff', s.id, 'block')} style={{ ...styles.btnSmall, background: '#ecc94b', color: 'black' }}>Block</button>
                        : <button onClick={() => handleUserAction('staff', s.id, 'unblock')} style={{ ...styles.btnSmall, background: '#38a169' }}>Unblock</button>
                      }
                      <button onClick={() => handleUserAction('staff', s.id, 'delete')} style={{ ...styles.btnSmall, background: '#e53e3e' }}>Delete</button>
                    </td>
                  </tr>
                );
              })}
              {filteredStaff.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center' }}>No staff found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'students' && (
        <div style={styles.tableContainer}>
          <h2 style={{ margin: 0, color: '#2c3e50', marginBottom: '20px' }}>Manage Students ({filteredStudents.length})</h2>
          <table style={styles.table}>
            <thead>
              <tr><th style={styles.th}>Name</th><th style={styles.th}>Major</th><th style={styles.th}>Year</th><th style={styles.th}>Status</th><th style={styles.th}>Attendance %</th><th style={styles.th}>Actions</th></tr>
            </thead>
            <tbody>
              {filteredStudents.map(s => (
                <tr key={s.id}>
                  <td style={styles.td}><b>{s.full_name}</b></td>
                  <td style={styles.td}>{s.major_name}</td>
                  <td style={styles.td}>Year {s.academic_year}</td>
                  <td style={styles.td}><span style={styles.badge(s.status)}>{s.status}</span></td>
                  <td style={styles.td}>{s.percentage}%</td>
                  <td style={styles.td}>
                    {s.status === 'active' && <button onClick={() => handleUserAction('student', s.id, 'block')} style={{ ...styles.btnSmall, background: '#ecc94b', color: 'black' }}>Block</button>}
                    {s.status === 'banned' && <button onClick={() => handleUserAction('student', s.id, 'unblock')} style={{ ...styles.btnSmall, background: '#38a169' }}>Unblock</button>}
                    <button onClick={() => handleUserAction('student', s.id, 'delete')} style={{ ...styles.btnSmall, background: '#e53e3e' }}>Delete</button>
                  </td>
                </tr>
              ))}
              {filteredStudents.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center' }}>No students found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'majors' && (
        <div style={styles.tableContainer}>
          <h2 style={{ marginTop: 0, color: '#2c3e50' }}>Manage Majors</h2>
          <form onSubmit={addMajor} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <input style={styles.input} placeholder="Major name" value={majorForm.name} onChange={(e) => setMajorForm({ name: e.target.value })} />
            <button type="submit" style={{ ...styles.btnSmall, background: '#38a169', padding: '10px 20px', fontSize: '14px' }}>Add Major</button>
          </form>
          <table style={styles.table}>
            <thead>
              <tr><th style={styles.th}>ID</th><th style={styles.th}>Name</th><th style={styles.th}>Head</th><th style={styles.th}>Actions</th></tr>
            </thead>
            <tbody>
              {majors.map(m => (
                <tr key={m.id}>
                  <td style={styles.td}>{m.id}</td>
                  <td style={styles.td}>
                    {editingMajor && editingMajor.id === m.id ? (
                      <input style={styles.input} value={editingMajor.name} onChange={(e) => setEditingMajor({ ...editingMajor, name: e.target.value })} />
                    ) : (<b>{m.name}</b>)}
                  </td>
                  <td style={styles.td}>{m.head_name || '-'}</td>
                  <td style={styles.td}>
                    {editingMajor && editingMajor.id === m.id ? (
                      <>
                        <button onClick={updateMajor} style={{ ...styles.btnSmall, background: '#38a169' }}>Save</button>
                        <button onClick={() => setEditingMajor(null)} style={{ ...styles.btnSmall, background: '#718096' }}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setEditingMajor({ id: m.id, name: m.name })} style={{ ...styles.btnSmall, background: '#3182ce' }}>Edit</button>
                        <button onClick={() => deleteMajor(m.id)} style={{ ...styles.btnSmall, background: '#e53e3e' }}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'broadcast' && (
        <div style={styles.tableContainer}>
          <h2 style={{ marginTop: 0, color: '#2c3e50' }}>Broadcast Warning to Students</h2>
          <form onSubmit={sendBroadcast}>
            <div style={{ display: 'grid', gap: '15px' }}>
              <input style={styles.input} placeholder="Subject" value={broadcastForm.subject} onChange={(e) => setBroadcastForm({ ...broadcastForm, subject: e.target.value })} />
              <select style={styles.select} value={broadcastForm.warning_type} onChange={(e) => setBroadcastForm({ ...broadcastForm, warning_type: e.target.value })}>
                <option value="general">General</option>
                <option value="academic">Academic</option>
                <option value="disciplinary">Disciplinary</option>
              </select>
              <select style={styles.select} value={broadcastForm.target} onChange={(e) => setBroadcastForm({ ...broadcastForm, target: e.target.value })}>
                <option value="all">All Active Students</option>
                <option value="major">By Major</option>
                <option value="year">By Major & Year</option>
              </select>
              {(broadcastForm.target === 'major' || broadcastForm.target === 'year') && (
                <select style={styles.select} value={broadcastForm.major_id} onChange={(e) => setBroadcastForm({ ...broadcastForm, major_id: e.target.value })}>
                  <option value="">Select Major</option>
                  {majors.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              )}
              {broadcastForm.target === 'year' && (
                <select style={styles.select} value={broadcastForm.academic_year} onChange={(e) => setBroadcastForm({ ...broadcastForm, academic_year: e.target.value })}>
                  <option value="">Select Year</option>
                  <option value="1">Year 1</option><option value="2">Year 2</option><option value="3">Year 3</option><option value="4">Year 4</option>
                </select>
              )}
              <textarea style={styles.textarea} placeholder="Message" value={broadcastForm.message} onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })} />
              <button type="submit" style={{ ...styles.btnSmall, background: '#d97706', padding: '10px 20px', fontSize: '14px', alignSelf: 'flex-start' }}>Send Broadcast</button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'reports' && (
        <div>
          <div style={styles.tableContainer}>
            <h2 style={{ marginTop: 0, color: '#2c3e50' }}>Attendance Overview by Major</h2>
            <table style={styles.table}>
              <thead>
                <tr><th style={styles.th}>Major</th><th style={styles.th}>Students</th><th style={styles.th}>Courses</th><th style={styles.th}>Sessions Conducted</th><th style={styles.th}>Attendance Rate</th></tr>
              </thead>
              <tbody>
                {filteredAttendanceOverview.map(a => (
                  <tr key={a.id}>
                    <td style={styles.td}><b>{a.major_name}</b></td>
                    <td style={styles.td}>{a.total_students}</td>
                    <td style={styles.td}>{a.total_courses}</td>
                    <td style={styles.td}>{a.total_sessions_conducted}</td>
                    <td style={styles.td}>{a.attendance_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={styles.tableContainer}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#2c3e50' }}>High Risk Students</h2>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span>Threshold &lt;</span>
                <input style={{ ...styles.input, width: '80px' }} type="number" value={highRiskThreshold} onChange={(e) => setHighRiskThreshold(e.target.value)} />
                <span>%</span>
                <button onClick={loadHighRiskStudents} style={{ ...styles.btnSmall, background: '#3182ce', padding: '10px 15px', fontSize: '14px' }}>Apply</button>
              </div>
            </div>
            <table style={styles.table}>
              <thead>
                <tr><th style={styles.th}>Name</th><th style={styles.th}>Major</th><th style={styles.th}>Year</th><th style={styles.th}>Total Sessions</th><th style={styles.th}>Attended</th><th style={styles.th}>Attendance %</th></tr>
              </thead>
              <tbody>
                {filteredHighRisk.map(s => (
                  <tr key={s.id}>
                    <td style={styles.td}><b>{s.full_name}</b></td>
                    <td style={styles.td}>{s.major_name}</td>
                    <td style={styles.td}>Year {s.academic_year}</td>
                    <td style={styles.td}>{s.total_sessions}</td>
                    <td style={styles.td}>{s.attended_sessions}</td>
                    <td style={styles.td}><span style={{ color: '#e53e3e', fontWeight: 'bold' }}>{s.attendance_percentage}%</span></td>
                  </tr>
                ))}
                {filteredHighRisk.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center' }}>No high risk students found</td></tr>}
              </tbody>
            </table>
          </div>

          <div style={styles.tableContainer}>
            <h2 style={{ marginTop: 0, color: '#2c3e50' }}>Staff Activity</h2>
            <table style={styles.table}>
              <thead>
                <tr><th style={styles.th}>Staff</th><th style={styles.th}>Role</th><th style={styles.th}>Major</th><th style={styles.th}>Courses</th><th style={styles.th}>Sessions Created</th><th style={styles.th}>Completed</th><th style={styles.th}>Active</th><th style={styles.th}>Avg Attendance/Session</th></tr>
              </thead>
              <tbody>
                {filteredStaffActivity.map(st => (
                  <tr key={st.id}>
                    <td style={styles.td}><b>{st.full_name}</b></td>
                    <td style={styles.td}><span style={{ textTransform: 'capitalize' }}>{st.role}</span></td>
                    <td style={styles.td}>{st.major_name || '-'}</td>
                    <td style={styles.td}>{st.courses_assigned}</td>
                    <td style={styles.td}>{st.sessions_created}</td>
                    <td style={styles.td}>{st.sessions_completed}</td>
                    <td style={styles.td}>{st.sessions_active}</td>
                    <td style={styles.td}>{st.avg_attendance_per_session}</td>
                  </tr>
                ))}
                {filteredStaffActivity.length === 0 && <tr><td colSpan="8" style={{ textAlign: 'center' }}>No staff activity found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'sessions' && (
        <div style={styles.tableContainer}>
          <h2 style={{ marginTop: 0, color: '#2c3e50' }}>Live Active Sessions ({filteredSessions.length})</h2>
          <table style={styles.table}>
            <thead>
              <tr><th style={styles.th}>Course</th><th style={styles.th}>Major</th><th style={styles.th}>Year</th><th style={styles.th}>Created By</th><th style={styles.th}>Role</th><th style={styles.th}>Attendance</th><th style={styles.th}>Start Time</th><th style={styles.th}>Action</th></tr>
            </thead>
            <tbody>
              {filteredSessions.map(s => (
                <tr key={s.id}>
                  <td style={styles.td}><b>{s.course_code}</b> - {s.course_name}</td>
                  <td style={styles.td}>{s.major_name}</td>
                  <td style={styles.td}>Year {s.academic_year}</td>
                  <td style={styles.td}>{s.created_by_name}</td>
                  <td style={styles.td}><span style={{ textTransform: 'capitalize' }}>{s.created_by_role}</span></td>
                  <td style={styles.td}>{s.attendance_count} / {s.enrolled_count}</td>
                  <td style={styles.td}>{new Date(s.start_time).toLocaleString()}</td>
                  <td style={styles.td}>
                    <button onClick={() => forceCloseSession(s.id)} style={{ ...styles.btnSmall, background: '#e53e3e' }}>Force Close</button>
                  </td>
                </tr>
              ))}
              {filteredSessions.length === 0 && <tr><td colSpan="8" style={{ textAlign: 'center' }}>No active sessions</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'analytics' && analytics && (
        <div>
          <div style={styles.tableContainer}>
            <h2 style={{ marginTop: 0, color: '#2c3e50' }}>Attendance Trend (Last 14 Days)</h2>
            <table style={styles.table}>
              <thead>
                <tr><th style={styles.th}>Date</th><th style={styles.th}>Sessions</th><th style={styles.th}>Attendance Records</th></tr>
              </thead>
              <tbody>
                {analytics.attendance_trend.map((t, idx) => (
                  <tr key={idx}>
                    <td style={styles.td}>{t.date}</td>
                    <td style={styles.td}>{t.sessions_count}</td>
                    <td style={styles.td}>{t.attendance_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={styles.tableContainer}>
            <h2 style={{ marginTop: 0, color: '#2c3e50' }}>Most Absent Students (Overall)</h2>
            <table style={styles.table}>
              <thead>
                <tr><th style={styles.th}>Name</th><th style={styles.th}>Major</th><th style={styles.th}>Year</th><th style={styles.th}>Total Sessions</th><th style={styles.th}>Attended</th><th style={styles.th}>Absent</th><th style={styles.th}>Absence %</th></tr>
              </thead>
              <tbody>
                {filteredMostAbsent.map(s => (
                  <tr key={s.id}>
                    <td style={styles.td}><b>{s.full_name}</b></td>
                    <td style={styles.td}>{s.major_name}</td>
                    <td style={styles.td}>Year {s.academic_year}</td>
                    <td style={styles.td}>{s.total_sessions}</td>
                    <td style={styles.td}>{s.attended_sessions}</td>
                    <td style={styles.td}>{s.absent_count}</td>
                    <td style={styles.td}><span style={{ color: '#e53e3e', fontWeight: 'bold' }}>{s.absence_percentage}%</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={styles.tableContainer}>
            <h2 style={{ marginTop: 0, color: '#2c3e50' }}>Course Completion</h2>
            <table style={styles.table}>
              <thead>
                <tr><th style={styles.th}>Course</th><th style={styles.th}>Major</th><th style={styles.th}>Year</th><th style={styles.th}>Enrolled</th><th style={styles.th}>Sessions Held</th><th style={styles.th}>Avg Attendance/Session</th></tr>
              </thead>
              <tbody>
                {filteredCourseCompletion.map(c => (
                  <tr key={c.id}>
                    <td style={styles.td}><b>{c.course_code}</b> - {c.course_name}</td>
                    <td style={styles.td}>{c.major_name}</td>
                    <td style={styles.td}>Year {c.academic_year}</td>
                    <td style={styles.td}>{c.enrolled_students}</td>
                    <td style={styles.td}>{c.total_sessions_held}</td>
                    <td style={styles.td}>{c.avg_attendance_per_session}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'audit' && (
        <div style={styles.tableContainer}>
          <h2 style={{ marginTop: 0, color: '#2c3e50' }}>Audit Logs ({auditTotal})</h2>
          <table style={styles.table}>
            <thead>
              <tr><th style={styles.th}>Date</th><th style={styles.th}>Actor</th><th style={styles.th}>Action</th><th style={styles.th}>Target Type</th><th style={styles.th}>Target ID</th><th style={styles.th}>IP</th></tr>
            </thead>
            <tbody>
              {auditLogs.map(log => (
                <tr key={log.id}>
                  <td style={styles.td}>{new Date(log.created_at).toLocaleString()}</td>
                  <td style={styles.td}>{log.actor_name || '-'}</td>
                  <td style={styles.td}><b>{log.action}</b></td>
                  <td style={styles.td}>{log.target_type || '-'}</td>
                  <td style={styles.td}>{log.target_id || '-'}</td>
                  <td style={styles.td}>{log.ip_address || '-'}</td>
                </tr>
              ))}
              {auditLogs.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center' }}>No audit logs</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
