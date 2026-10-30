import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

export default function HeadDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('overview');
  const [courses, setCourses] = useState([]);
  const [staff, setStaff] = useState([]);
  const [overview, setOverview] = useState(null);
  const [majorInfo, setMajorInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  // ⚡ States الفلاتر (كلها بتبدأ بـ all عشان تعرض كل حاجة)
  const [filterCourseYear, setFilterCourseYear] = useState('all');
  const [filterCourseTerm, setFilterCourseTerm] = useState('all');
  
  const [filterStudentYear, setFilterStudentYear] = useState('all');
  
  const [filterInviteRole, setFilterInviteRole] = useState('all');
  
  const [filterPerfRole, setFilterPerfRole] = useState('all');
  
  const [filterSessionYear, setFilterSessionYear] = useState('all');

  // States للكورسات
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [courseForm, setCourseForm] = useState({ course_code: '', course_name: '', academic_year: '1', term: '1' });
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningToCourse, setAssigningToCourse] = useState(null);
  const [assignForm, setAssignForm] = useState({ staff_id: '', role_in_course: 'doctor', is_primary: false });

  // States للدعوات والطلبة
  const [inviteForm, setInviteForm] = useState({ full_name: '', email: '', national_id: '', role: 'doctor' });
  const [inviteStatus, setInviteStatus] = useState('');
  const [pendingInvites, setPendingInvites] = useState([]);
  const [allStudents, setAllStudents] = useState([]);
  
  // States للطلبة المعرضين للخطر والإنذارات
  const [riskStudents, setRiskStudents] = useState([]);
  const [riskThreshold, setRiskThreshold] = useState(75);
  const [warningForm, setWarningForm] = useState({ subject: '', message: '', warning_type: 'general', academic_year: '', target: 'all' });

  // States للجلسات والأداء
  const [activeSessions, setActiveSessions] = useState([]);
  const [staffPerf, setStaffPerf] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [coursesRes, staffRes, overviewRes, majorRes] = await Promise.all([
        client.get('/head/courses'),
        client.get('/head/staff'),
        client.get('/head/major/overview'),
        client.get('/head/major/info')
      ]);
      setCourses(coursesRes.data);
      setStaff(staffRes.data);
      setOverview(overviewRes.data);
      setMajorInfo(majorRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleTermChange = async (e) => {
    const newTerm = e.target.value;
    try {
      await client.put('/head/major/current-term', { term: newTerm });
      setMajorInfo({ ...majorInfo, current_term: newTerm });
      alert(`Active term updated to Term ${newTerm}. All doctors and students will now see Term ${newTerm} courses.`);
    } catch (err) {
      alert('Failed to update term');
    }
  };

  // ============================
  // دوال إدارة الكورسات
  // ============================
  const openAddCourseModal = () => {
    setEditingCourse(null);
    setCourseForm({ course_code: '', course_name: '', academic_year: '1', term: majorInfo?.current_term || '1' });
    setShowCourseModal(true);
  };

  const openEditCourseModal = (course) => {
    setEditingCourse(course);
    setCourseForm({
      course_code: course.course_code,
      course_name: course.course_name,
      academic_year: course.academic_year,
      term: course.term || '1'
    });
    setShowCourseModal(true);
  };

  const saveCourse = async (e) => {
    e.preventDefault();
    try {
      if (editingCourse) {
        await client.put(`/head/courses/${editingCourse.id}`, courseForm);
      } else {
        await client.post('/head/courses', courseForm);
      }
      setShowCourseModal(false);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save course');
    }
  };

  const deleteCourse = async (courseId) => {
    if (!window.confirm('Are you sure you want to delete this course?')) return;
    try {
      await client.delete(`/head/courses/${courseId}`);
      loadData();
      alert('Course deleted successfully');
    } catch (err) {
      const d = err.response?.data;
      if (d?.details) {
        alert(`${d.message}\nEnrollments: ${d.details.enrollments}, Sessions: ${d.details.sessions}, Attendance: ${d.details.attendance}`);
      } else {
        alert(d?.message || 'Failed to delete course');
      }
    }
  };

  const openAssignModal = (course, role = 'doctor') => {
    setAssigningToCourse(course);
    setAssignForm({ staff_id: '', role_in_course: role, is_primary: false });
    setShowAssignModal(true);
  };

  const saveAssignment = async (e) => {
    e.preventDefault();
    try {
      await client.post(`/head/courses/${assigningToCourse.id}/staff`, {
        staff_id: parseInt(assignForm.staff_id),
        role_in_course: assignForm.role_in_course,
        is_primary: assignForm.is_primary
      });
      setShowAssignModal(false);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to assign staff');
    }
  };

  const removeStaff = async (courseId, assignmentId) => {
    if (!window.confirm('Remove this staff member from the course?')) return;
    try {
      await client.delete(`/head/courses/${courseId}/staff/${assignmentId}`);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to remove staff');
    }
  };

  // ============================
  // دوال الدعوات والطلبة
  // ============================
  const sendInvite = async (e) => {
    e.preventDefault();
    setInviteStatus('');
    try {
      await client.post('/invitations', inviteForm);
      setInviteStatus(`✅ Invitation sent to ${inviteForm.email}!`);
      setInviteForm({ full_name: '', email: '', national_id: '', role: 'doctor' });
      loadData();
      if (activeTab === 'invitations') loadPendingInvites();
    } catch (err) {
      setInviteStatus(`❌ ${err.response?.data?.message || 'Failed to send invitation'}`);
    }
  };

  const loadPendingInvites = async () => {
    try {
      const res = await client.get('/head/invitations/pending');
      setPendingInvites(res.data);
    } catch (err) { console.error(err); }
  };

  const cancelInvite = async (id) => {
    if (!window.confirm('Cancel this invitation?')) return;
    try {
      await client.delete(`/head/invitations/${id}`);
      loadPendingInvites();
      alert('Invitation cancelled successfully');
    } catch (err) { alert(err.response?.data?.message || 'Failed to cancel invitation'); }
  };

  const loadAllStudents = async () => {
    try {
      const res = await client.get('/head/students');
      setAllStudents(res.data);
    } catch (err) { console.error(err); }
  };

  const toggleStudent = async (studentId, status) => {
    const action = status === 'banned' ? 'block' : 'unblock';
    if (!window.confirm(`Are you sure you want to ${action} this student?`)) return;
    try {
      await client.put(`/head/students/${studentId}/status`, { status });
      loadAllStudents();
      alert(`Student ${action}ed successfully`);
    } catch (err) { alert(err.response?.data?.message || 'Action failed'); }
  };

  // ============================
  // دوال الخطر والإنذارات
  // ============================
  const loadRiskStudents = async () => {
    try {
      const res = await client.get(`/head/students/risk?threshold=${riskThreshold}`);
      setRiskStudents(res.data.students || []);
    } catch (err) { console.error(err); }
  };

  const sendWarning = async (e) => {
    e.preventDefault();
    if (!warningForm.subject.trim() || !warningForm.message.trim()) return alert('Subject and message are required');
    try {
      const payload = {
        subject: warningForm.subject,
        message: warningForm.message,
        warning_type: warningForm.warning_type
      };
      if (warningForm.target === 'year' && warningForm.academic_year) {
        payload.academic_year = warningForm.academic_year;
      }
      const res = await client.post('/head/students/warning', payload);
      alert(res.data.message);
      setWarningForm({ subject: '', message: '', warning_type: 'general', academic_year: '', target: 'all' });
    } catch (err) { alert(err.response?.data?.message || 'Failed to send warning'); }
  };

  // ============================
  // دوال الجلسات والأداء
  // ============================
  const loadActiveSessions = async () => {
    try {
      const res = await client.get('/head/sessions/active');
      setActiveSessions(res.data);
    } catch (err) { console.error(err); }
  };

  const closeSession = async (id) => {
    if (!window.confirm('Are you sure you want to close this session?')) return;
    try {
      await client.post(`/head/sessions/${id}/close`);
      loadActiveSessions();
      alert('Session closed successfully');
    } catch (err) { alert(err.response?.data?.message || 'Failed to close session'); }
  };

  const loadStaffPerf = async () => {
    try {
      const res = await client.get('/head/staff/performance');
      setStaffPerf(res.data);
    } catch (err) { console.error(err); }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading Head Dashboard...</div>;
  if (!overview) return <div style={{ padding: '40px', textAlign: 'center', color: 'red' }}>Failed to load data.</div>;

  const doctors = staff.filter(s => s.role === 'doctor' || s.role === 'head');
  const engineers = staff.filter(s => s.role === 'engineer');

  // ⚡ الفلترة للبيانات بناءً على اختيار "All" أو غيره
  const filteredCourses = courses.filter(c => {
    const matchYear = filterCourseYear === 'all' || c.academic_year === filterCourseYear;
    const matchTerm = filterCourseTerm === 'all' || c.term === filterCourseTerm;
    return matchYear && matchTerm;
  });

  const filteredStudents = allStudents.filter(s => 
    filterStudentYear === 'all' || s.academic_year === filterStudentYear
  );

  const filteredInvites = pendingInvites.filter(inv => 
    filterInviteRole === 'all' || inv.role === filterInviteRole
  );

  const filteredPerf = staffPerf.filter(st => 
    filterPerfRole === 'all' || st.role === filterPerfRole
  );

  const filteredSessions = activeSessions.filter(s => 
    filterSessionYear === 'all' || s.academic_year === filterSessionYear
  );

  const styles = {
    container: { padding: '30px', fontFamily: 'Segoe UI, sans-serif', backgroundColor: '#f4f7f6', minHeight: '100vh' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', background: '#fff', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', flexWrap: 'wrap', gap: '10px' },
    headerLeft: { display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' },
    headerRight: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
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
    select: { padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0', fontSize: '15px', minWidth: '150px', marginRight: '10px' },
    input: { padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0', fontSize: '15px' },
    textarea: { padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0', fontSize: '15px', width: '100%', minHeight: '120px', fontFamily: 'inherit' },
    badge: (status) => ({
      padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold',
      backgroundColor: status === 'active' ? '#c6f6d5' : status === 'pending' ? '#fefcbf' : '#fed7d7',
      color: status === 'active' ? '#22543d' : status === 'pending' ? '#744210' : '#822727'
    }),
    btnSmall: { padding: '5px 10px', borderRadius: '4px', border: 'none', cursor: 'pointer', color: 'white', fontSize: '12px', marginRight: '5px', fontWeight: 'bold' },
    btnPrimary: { padding: '10px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: '#38a169', color: 'white', fontWeight: 'bold' },
    btnBlue: { padding: '10px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: '#3182ce', color: 'white', fontWeight: 'bold' },
    btnOrange: { padding: '10px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: '#dd6b20', color: 'white', fontWeight: 'bold' },
    btnRed: { padding: '10px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer', backgroundColor: '#e53e3e', color: 'white', fontWeight: 'bold' }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div>
            <h1 style={{ margin: 0, color: '#2c3e50' }}>Head of Department Dashboard</h1>
            <p style={{ margin: '5px 0 0 0', color: '#718096' }}>Welcome back, <b>{user?.full_name}</b>{overview?.major?.name ? ` | ${overview.major.name}` : ''}</p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#e2e8f0', padding: '10px 15px', borderRadius: '8px' }}>
            <span style={{ fontWeight: 'bold' }}>Active Term:</span>
            <select 
              value={majorInfo?.current_term || '1'} 
              onChange={handleTermChange}
              style={{ ...styles.select, minWidth: '120px', background: 'white' }}
            >
              <option value="1">1st Term</option>
              <option value="2">2nd Term</option>
            </select>
          </div>

        </div>
        <div style={styles.headerRight}>
          <button onClick={() => navigate('/doctor')} style={styles.btnBlue}>Doctor View</button>
          <button onClick={() => navigate('/head/pending-students')} style={styles.btnOrange}>Pending Students</button>
          <button onClick={logout} style={styles.btnRed}>Logout</button>
        </div>
      </header>

      <div style={styles.tabs}>
        <button style={styles.tabBtn(activeTab === 'overview')} onClick={() => setActiveTab('overview')}>Overview</button>
        <button style={styles.tabBtn(activeTab === 'courses')} onClick={() => setActiveTab('courses')}>Manage Courses</button>
        <button style={styles.tabBtn(activeTab === 'invite')} onClick={() => setActiveTab('invite')}>Invite Staff</button>
        <button style={styles.tabBtn(activeTab === 'invitations')} onClick={() => { setActiveTab('invitations'); loadPendingInvites(); }}>Pending Invitations</button>
        <button style={styles.tabBtn(activeTab === 'students')} onClick={() => { setActiveTab('students'); loadAllStudents(); }}>All Students</button>
        <button style={styles.tabBtn(activeTab === 'risk')} onClick={() => { setActiveTab('risk'); loadRiskStudents(); }}>High Risk Students</button>
        <button style={styles.tabBtn(activeTab === 'warning')} onClick={() => setActiveTab('warning')}>Send Warning</button>
        <button style={styles.tabBtn(activeTab === 'sessions')} onClick={() => { setActiveTab('sessions'); loadActiveSessions(); }}>Active Sessions</button>
        <button style={styles.tabBtn(activeTab === 'performance')} onClick={() => { setActiveTab('performance'); loadStaffPerf(); }}>Staff Performance</button>
      </div>

      {activeTab === 'overview' && overview && (
        <div style={styles.cardsGrid}>
          <div style={styles.card}><p style={styles.cardTitle}>Students</p><p style={styles.cardValue}>{overview.stats.total_students}</p></div>
          <div style={styles.card}><p style={styles.cardTitle}>Courses</p><p style={styles.cardValue}>{overview.stats.total_courses}</p></div>
          <div style={styles.card}><p style={styles.cardTitle}>Sessions</p><p style={styles.cardValue}>{overview.stats.total_sessions}</p></div>
          <div style={styles.card}><p style={styles.cardTitle}>Major</p><p style={{ fontSize: '20px', fontWeight: 'bold', color: '#2c3e50', margin: '10px 0 0 0' }}>{overview.major.name}</p></div>
        </div>
      )}

      {activeTab === 'courses' && (
        <div style={styles.tableContainer}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <h2 style={{ margin: 0, color: '#2c3e50' }}>Manage Courses</h2>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
              <select style={styles.select} value={filterCourseYear} onChange={(e) => setFilterCourseYear(e.target.value)}>
                <option value="all">All Years</option>
                <option value="1">Year 1</option>
                <option value="2">Year 2</option>
                <option value="3">Year 3</option>
                <option value="4">Year 4</option>
              </select>

              <select style={styles.select} value={filterCourseTerm} onChange={(e) => setFilterCourseTerm(e.target.value)}>
                <option value="all">All Terms</option>
                <option value="1">1st Term</option>
                <option value="2">2nd Term</option>
              </select>

              <button onClick={openAddCourseModal} style={styles.btnPrimary}>+ Add Course</button>
            </div>
          </div>

          <table style={styles.table}>
            <thead>
              <tr><th style={styles.th}>Code</th><th style={styles.th}>Name</th><th style={styles.th}>Year</th><th style={styles.th}>Term</th><th style={styles.th}>Students</th><th style={styles.th}>Doctor</th><th style={styles.th}>Engineers</th><th style={styles.th}>Actions</th></tr>
            </thead>
            <tbody>
              {filteredCourses.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '20px', color: 'gray' }}>No courses found.</td></tr>
              ) : (
                filteredCourses.map(c => {
                  const courseDoctor = c.staff?.find(s => s.role_in_course === 'doctor');
                  const courseEngineers = c.staff?.filter(s => s.role_in_course === 'engineer') || [];
                  const isCurrentTerm = c.term === (majorInfo?.current_term || '1');
                  return (
                    <tr key={c.id} style={{ backgroundColor: isCurrentTerm ? '#f0fff4' : '#fff' }}>
                      <td style={styles.td}><b>{c.course_code}</b></td>
                      <td style={styles.td}>{c.course_name}</td>
                      <td style={styles.td}>Year {c.academic_year}</td>
                      <td style={styles.td}>{c.term === '2' ? '2nd Term' : '1st Term'} {isCurrentTerm && <span style={{ color: '#38a169', fontSize: '11px', marginLeft: '5px', fontWeight: 'bold' }}>(Active)</span>}</td>
                      <td style={styles.td}>{c.students}</td>
                      <td style={styles.td}>
                        {courseDoctor ? (
                          <div>
                            <b>Dr. {courseDoctor.full_name}</b> {courseDoctor.is_primary && <span style={{ color: '#38a169' }}>(Primary)</span>}
                            <button onClick={() => removeStaff(c.id, courseDoctor.assignment_id)} style={{ ...styles.btnSmall, background: '#e53e3e', marginLeft: '10px' }}>Remove</button>
                          </div>
                        ) : <button onClick={() => openAssignModal(c, 'doctor')} style={{ ...styles.btnSmall, background: '#3182ce' }}>+ Assign Doctor</button>}
                      </td>
                      <td style={styles.td}>
                        {courseEngineers.map(eng => (
                          <div key={eng.assignment_id} style={{ marginBottom: '5px' }}>
                            <b>Eng. {eng.full_name}</b>
                            <button onClick={() => removeStaff(c.id, eng.assignment_id)} style={{ ...styles.btnSmall, background: '#e53e3e', marginLeft: '10px' }}>Remove</button>
                          </div>
                        ))}
                        <button onClick={() => openAssignModal(c, 'engineer')} style={{ ...styles.btnSmall, background: '#3182ce', marginTop: '5px' }}>+ Assign Engineer</button>
                      </td>
                      <td style={styles.td}>
                        <button onClick={() => openEditCourseModal(c)} style={{ ...styles.btnSmall, background: '#3182ce' }}>Edit</button>
                        <button onClick={() => deleteCourse(c.id)} style={{ ...styles.btnSmall, background: '#e53e3e' }}>Delete</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'invite' && (
        <div style={{ ...styles.tableContainer, maxWidth: '600px' }}>
          <h2 style={{ marginTop: 0, color: '#2c3e50' }}>Invite Doctor / Engineer</h2>
          <form onSubmit={sendInvite} style={{ display: 'grid', gap: '15px' }}>
            <input style={styles.input} placeholder="Full Name" value={inviteForm.full_name} onChange={e => setInviteForm({...inviteForm, full_name: e.target.value})} required />
            <input style={styles.input} type="email" placeholder="Email" value={inviteForm.email} onChange={e => setInviteForm({...inviteForm, email: e.target.value})} required />
            <input style={styles.input} placeholder="National ID (14 digits)" value={inviteForm.national_id} onChange={e => setInviteForm({...inviteForm, national_id: e.target.value})} required />
            <select style={styles.select} value={inviteForm.role} onChange={e => setInviteForm({...inviteForm, role: e.target.value})}>
              <option value="doctor">Doctor</option>
              <option value="engineer">Engineer</option>
            </select>
            <button type="submit" style={styles.btnPrimary}>Send Invitation</button>
          </form>
          {inviteStatus && <p style={{ marginTop: '15px' }}>{inviteStatus}</p>}
        </div>
      )}

      {activeTab === 'invitations' && (
        <div style={styles.tableContainer}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, color: '#2c3e50' }}>Pending Invitations ({filteredInvites.length})</h2>
            <select style={styles.select} value={filterInviteRole} onChange={(e) => setFilterInviteRole(e.target.value)}>
              <option value="all">All Roles</option>
              <option value="doctor">Doctors</option>
              <option value="engineer">Engineers</option>
            </select>
          </div>
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>Name</th><th style={styles.th}>Email</th><th style={styles.th}>Role</th><th style={styles.th}>Action</th></tr></thead>
            <tbody>
              {filteredInvites.map(inv => (
                <tr key={inv.id}>
                  <td style={styles.td}><b>{inv.full_name}</b></td>
                  <td style={styles.td}>{inv.email}</td>
                  <td style={styles.td}>{inv.role}</td>
                  <td style={styles.td}><button onClick={() => cancelInvite(inv.id)} style={{ ...styles.btnSmall, background: '#e53e3e' }}>Cancel</button></td>
                </tr>
              ))}
              {filteredInvites.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: 'gray' }}>No invitations found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'students' && (
        <div style={styles.tableContainer}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, color: '#2c3e50' }}>All Students In Your Major ({filteredStudents.length})</h2>
            <select style={styles.select} value={filterStudentYear} onChange={(e) => setFilterStudentYear(e.target.value)}>
              <option value="all">All Years</option>
              <option value="1">Year 1</option>
              <option value="2">Year 2</option>
              <option value="3">Year 3</option>
              <option value="4">Year 4</option>
            </select>
          </div>
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>Name</th><th style={styles.th}>National ID</th><th style={styles.th}>Year</th><th style={styles.th}>Status</th><th style={styles.th}>Action</th></tr></thead>
            <tbody>
              {filteredStudents.map(s => (
                <tr key={s.id}>
                  <td style={styles.td}><b>{s.full_name}</b></td>
                  <td style={styles.td}>{s.national_id}</td>
                  <td style={styles.td}>Year {s.academic_year}</td>
                  <td style={styles.td}><span style={styles.badge(s.status)}>{s.status}</span></td>
                  <td style={styles.td}>
                    {s.status === 'active' && <button onClick={() => toggleStudent(s.id, 'banned')} style={{ ...styles.btnSmall, background: '#ecc94b', color: 'black' }}>Block</button>}
                    {s.status === 'banned' && <button onClick={() => toggleStudent(s.id, 'active')} style={{ ...styles.btnSmall, background: '#38a169' }}>Unblock</button>}
                  </td>
                </tr>
              ))}
              {filteredStudents.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: 'gray' }}>No students found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'risk' && (
        <div style={styles.tableContainer}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, color: '#2c3e50' }}>High Risk Students</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>Attendance &lt;</span>
              <input style={{ ...styles.input, width: '80px' }} type="number" value={riskThreshold} onChange={(e) => setRiskThreshold(e.target.value)} />
              <span>%</span>
              <button onClick={loadRiskStudents} style={styles.btnBlue}>Apply</button>
            </div>
          </div>
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>Name</th><th style={styles.th}>Year</th><th style={styles.th}>Attended</th><th style={styles.th}>Attendance %</th></tr></thead>
            <tbody>
              {riskStudents.map(s => (
                <tr key={s.id}>
                  <td style={styles.td}><b>{s.full_name}</b></td>
                  <td style={styles.td}>Year {s.academic_year}</td>
                  <td style={styles.td}>{s.attended_sessions} / {s.total_sessions}</td>
                  <td style={styles.td}><span style={{ color: '#e53e3e', fontWeight: 'bold' }}>{s.attendance_percentage}%</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'warning' && (
        <div style={{ ...styles.tableContainer, maxWidth: '700px' }}>
          <h2 style={{ marginTop: 0, color: '#2c3e50' }}>Send Warning To Students</h2>
          <form onSubmit={sendWarning} style={{ display: 'grid', gap: '15px' }}>
            <input style={styles.input} placeholder="Subject" value={warningForm.subject} onChange={e => setWarningForm({...warningForm, subject: e.target.value})} />
            <select style={styles.select} value={warningForm.warning_type} onChange={e => setWarningForm({...warningForm, warning_type: e.target.value})}>
              <option value="general">General</option>
              <option value="academic">Academic</option>
              <option value="disciplinary">Disciplinary</option>
            </select>
            <select style={styles.select} value={warningForm.target} onChange={e => setWarningForm({...warningForm, target: e.target.value})}>
              <option value="all">All Students In Major</option>
              <option value="year">By Year</option>
            </select>
            {warningForm.target === 'year' && (
              <select style={styles.select} value={warningForm.academic_year} onChange={e => setWarningForm({...warningForm, academic_year: e.target.value})}>
                <option value="">Select Year</option>
                <option value="1">Year 1</option><option value="2">Year 2</option><option value="3">Year 3</option><option value="4">Year 4</option>
              </select>
            )}
            <textarea style={styles.textarea} placeholder="Message" value={warningForm.message} onChange={e => setWarningForm({...warningForm, message: e.target.value})} />
            <button type="submit" style={{ ...styles.btnOrange, alignSelf: 'flex-start' }}>Send Warning</button>
          </form>
        </div>
      )}

      {activeTab === 'sessions' && (
        <div style={styles.tableContainer}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, color: '#2c3e50' }}>Active Sessions ({filteredSessions.length})</h2>
            <select style={styles.select} value={filterSessionYear} onChange={(e) => setFilterSessionYear(e.target.value)}>
              <option value="all">All Years</option>
              <option value="1">Year 1</option>
              <option value="2">Year 2</option>
              <option value="3">Year 3</option>
              <option value="4">Year 4</option>
            </select>
          </div>
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>Course</th><th style={styles.th}>Created By</th><th style={styles.th}>Start Time</th><th style={styles.th}>Action</th></tr></thead>
            <tbody>
              {filteredSessions.map(s => (
                <tr key={s.id}>
                  <td style={styles.td}><b>{s.course_code}</b> - {s.course_name}</td>
                  <td style={styles.td}>{s.created_by_name}</td>
                  <td style={styles.td}>{new Date(s.start_time).toLocaleString()}</td>
                  <td style={styles.td}><button onClick={() => closeSession(s.id)} style={{ ...styles.btnSmall, background: '#e53e3e' }}>Close Session</button></td>
                </tr>
              ))}
              {filteredSessions.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: 'gray' }}>No active sessions found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'performance' && (
        <div style={styles.tableContainer}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: 0, color: '#2c3e50' }}>Staff Performance ({filteredPerf.length})</h2>
            <select style={styles.select} value={filterPerfRole} onChange={(e) => setFilterPerfRole(e.target.value)}>
              <option value="all">All Roles</option>
              <option value="doctor">Doctors</option>
              <option value="engineer">Engineers</option>
              <option value="head">Heads</option>
            </select>
          </div>
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>Staff</th><th style={styles.th}>Role</th><th style={styles.th}>Courses</th><th style={styles.th}>Sessions Created</th></tr></thead>
            <tbody>
              {filteredPerf.map(st => (
                <tr key={st.id}>
                  <td style={styles.td}><b>{st.full_name}</b></td>
                  <td style={styles.td}>{st.role}</td>
                  <td style={styles.td}>{st.courses_assigned}</td>
                  <td style={styles.td}>{st.sessions_created}</td>
                </tr>
              ))}
              {filteredPerf.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px', color: 'gray' }}>No staff found.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {showCourseModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '10px', minWidth: '400px' }}>
            <h2>{editingCourse ? 'Edit Course' : 'Add New Course'}</h2>
            <form onSubmit={saveCourse} style={{ display: 'grid', gap: '15px' }}>
              <input style={styles.input} placeholder="Course Code" value={courseForm.course_code} onChange={e => setCourseForm({...courseForm, course_code: e.target.value})} required />
              <input style={styles.input} placeholder="Course Name" value={courseForm.course_name} onChange={e => setCourseForm({...courseForm, course_name: e.target.value})} required />
              <select style={styles.select} value={courseForm.academic_year} onChange={e => setCourseForm({...courseForm, academic_year: e.target.value})}>
                <option value="1">Year 1</option><option value="2">Year 2</option><option value="3">Year 3</option><option value="4">Year 4</option>
              </select>
              <select style={styles.select} value={courseForm.term} onChange={e => setCourseForm({...courseForm, term: e.target.value})}>
                <option value="1">1st Term</option><option value="2">2nd Term</option>
              </select>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" style={{ ...styles.btnPrimary, flex: 1 }}>Save</button>
                <button type="button" onClick={() => setShowCourseModal(false)} style={{ ...styles.btnRed, flex: 1 }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAssignModal && assigningToCourse && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '10px', minWidth: '400px' }}>
            <h2>Assign Staff</h2>
            <p>Course: <b>{assigningToCourse.course_code}</b></p>
            <form onSubmit={saveAssignment} style={{ display: 'grid', gap: '15px' }}>
              <select style={styles.select} value={assignForm.role_in_course} onChange={e => setAssignForm({...assignForm, role_in_course: e.target.value, staff_id: ''})}>
                <option value="doctor">Doctor</option><option value="engineer">Engineer</option>
              </select>
              <select style={styles.select} value={assignForm.staff_id} onChange={e => setAssignForm({...assignForm, staff_id: e.target.value})} required>
                <option value="">-- Choose --</option>
                {assignForm.role_in_course === 'doctor' ? doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.full_name}</option>) : engineers.map(e => <option key={e.id} value={e.id}>Eng. {e.full_name}</option>)}
              </select>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="submit" style={{ ...styles.btnPrimary, flex: 1 }}>Assign</button>
                <button type="button" onClick={() => setShowAssignModal(false)} style={{ ...styles.btnRed, flex: 1 }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}