import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import DashboardLayout from '../components/layout/DashboardLayout';
import Button from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import { Input, Select, Textarea } from '../components/ui/Field';
import { Alert, Badge, EmptyState, Loader, StatCard } from '../components/ui/Feedback';
import { AnimatedNumber, ProgressBar } from '../components/ui/Motion';

const statusVariant = (status) =>
  status === 'active' ? 'success' : status === 'pending' ? 'warning' : 'danger';

const roleIcon = (role) =>
  role === 'head' ? 'building' : role === 'doctor' ? 'graduation-cap' : 'settings';

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
    target: 'all',
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
        client.get('/dean/active-sessions'),
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
    } catch (err) {
      alert('Failed to cancel');
    }
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
    if (e) e.preventDefault();
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
        warning_type: broadcastForm.warning_type,
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
    try {
      const res = await client.get('/dean/reports/attendance-overview');
      setAttendanceOverview(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadHighRiskStudents = async () => {
    try {
      const res = await client.get(`/dean/reports/high-risk-students?threshold=${highRiskThreshold}`);
      setHighRiskStudents(res.data.students || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadStaffActivity = async () => {
    try {
      const res = await client.get('/dean/reports/staff-activity');
      setStaffActivity(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadActiveSessions = async () => {
    try {
      const res = await client.get('/dean/active-sessions');
      setActiveSessions(res.data);
    } catch (err) {
      console.error(err);
    }
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
    try {
      const res = await client.get('/dean/analytics');
      setAnalytics(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const res = await client.get('/dean/audit-logs?limit=50');
      setAuditLogs(res.data.logs || []);
      setAuditTotal(res.data.total || 0);
    } catch (err) {
      console.error(err);
    }
  };

  const goTo = (key) => {
    setActiveTab(key);
    if (key === 'reports') {
      loadAttendanceOverview();
      loadHighRiskStudents();
      loadStaffActivity();
    }
    if (key === 'sessions') loadActiveSessions();
    if (key === 'analytics') loadAnalytics();
    if (key === 'audit') loadAuditLogs();
  };

  const nav = [
    { key: 'overview', label: 'Institution Overview', icon: 'home', section: 'Institution' },
    { key: 'majors', label: 'Majors', icon: 'building' },
    { key: 'broadcast', label: 'Broadcast Warning', icon: 'send' },
    { key: 'invitations', label: 'Pending Invitations', icon: 'mail', section: 'People' },
    { key: 'staff', label: 'Manage Staff', icon: 'users' },
    { key: 'students', label: 'Manage Students', icon: 'graduation-cap' },
    { key: 'reports', label: 'Reports', icon: 'chart', section: 'Insights' },
    { key: 'sessions', label: 'Live Sessions', icon: 'activity' },
    { key: 'analytics', label: 'Analytics', icon: 'trending-up' },
    { key: 'audit', label: 'Audit Logs', icon: 'shield' },
    { key: 'signout', label: 'Sign out', icon: 'logout', onClick: logout, section: 'Account' },
  ].map((item) =>
    ['overview', 'majors', 'broadcast', 'invitations', 'staff', 'students', 'reports', 'sessions', 'analytics', 'audit'].includes(item.key)
      ? { ...item, onClick: () => goTo(item.key) }
      : item
  );

  if (loading) {
    return (
      <DashboardLayout
        user={user}
        role="dean"
        nav={nav}
        activeKey={activeTab}
        title="Dean console"
        crumb="Dean"
        onLogout={logout}
      >
        <Loader label="Loading institution data…" />
      </DashboardLayout>
    );
  }

  if (!data) {
    return (
      <DashboardLayout
        user={user}
        role="dean"
        nav={nav}
        activeKey={activeTab}
        title="Dean console"
        crumb="Dean"
        onLogout={logout}
      >
        <Alert variant="error">Failed to load data. Please refresh the page.</Alert>
      </DashboardLayout>
    );
  }

  const matchMajor = (name) => selectedMajor === 'all' || name === selectedMajor;
  const matchYear = (year) => selectedGrade === 'all' || String(year) === String(selectedGrade);
  const matchRole = (role) => filterRole === 'all' || role === filterRole;

  const filteredStudents = (data.students || []).filter((s) => matchMajor(s.major_name) && matchYear(s.academic_year));
  const filteredStaff = (data.staff || []).filter((s) => matchMajor(s.major_name) && matchRole(s.role));
  const filteredInvitations = invitations.filter((inv) => matchMajor(inv.major_name) && matchRole(inv.role));
  const filteredCourses = (data.courses || []).filter((c) => matchMajor(c.major_name) && matchYear(c.academic_year));
  const filteredSessions = activeSessions.filter((s) => matchMajor(s.major_name) && matchYear(s.academic_year));
  const filteredAttendanceOverview = attendanceOverview.filter((a) => matchMajor(a.major_name));
  const filteredHighRisk = highRiskStudents.filter((s) => matchMajor(s.major_name) && matchYear(s.academic_year));
  const filteredStaffActivity = staffActivity.filter((st) => matchMajor(st.major_name) && matchRole(st.role));
  const filteredMostAbsent = (analytics?.most_absent_students || []).filter(
    (s) => matchMajor(s.major_name) && matchYear(s.academic_year)
  );
  const filteredCourseCompletion = (analytics?.course_completion || []).filter(
    (c) => matchMajor(c.major_name) && matchYear(c.academic_year)
  );

  const filteredStats = {
    total_students: filteredStudents.length,
    total_courses: filteredCourses.length,
    total_doctors: filteredStaff.filter((s) => s.role === 'doctor').length,
    total_engineers: filteredStaff.filter((s) => s.role === 'engineer').length,
    active_sessions: filteredSessions.length,
  };

  const showFilters = ['overview', 'invitations', 'staff', 'students', 'reports', 'sessions', 'analytics'].includes(activeTab);
  const showYearFilter = ['overview', 'students', 'reports', 'sessions', 'analytics'].includes(activeTab);
  const showRoleFilter = ['invitations', 'staff', 'reports'].includes(activeTab);

  const titles = {
    overview: 'Institution overview',
    invitations: 'Pending invitations',
    staff: 'Manage staff',
    students: 'Manage students',
    majors: 'Majors',
    broadcast: 'Broadcast warning',
    reports: 'Institution reports',
    sessions: 'Live sessions',
    analytics: 'Analytics',
    audit: 'Audit logs',
  };

  const overallAttendance =
    filteredAttendanceOverview.length > 0
      ? Math.round(
          filteredAttendanceOverview.reduce((sum, a) => sum + Number(a.attendance_rate || 0), 0) /
            filteredAttendanceOverview.length
        )
      : null;

  return (
    <DashboardLayout
      user={user}
      role="dean"
      nav={nav}
      activeKey={activeTab}
      title={titles[activeTab] || 'Dean console'}
      crumb="Dean"
      onLogout={logout}
      actions={
        <>
          <Badge variant="neutral">{majors.length} major(s)</Badge>
          <span className="chip chip--live">
            <span className="dot-pulse" /> {filteredStats.active_sessions} live
          </span>
        </>
      }
    >
      {showFilters && (
        <div className="toolbar" style={{ marginBottom: 20 }}>
          <Select aria-label="Filter major" icon="building" value={selectedMajor} onChange={(e) => setSelectedMajor(e.target.value)}>
            <option value="all">All majors</option>
            {(data.majorsList || []).map((m) => (
              <option key={m.id} value={m.name}>
                {m.name}
              </option>
            ))}
          </Select>
          {showYearFilter && (
            <Select aria-label="Filter year" icon="graduation-cap" value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)}>
              <option value="all">All years</option>
              <option value="1">Year 1</option>
              <option value="2">Year 2</option>
              <option value="3">Year 3</option>
              <option value="4">Year 4</option>
            </Select>
          )}
          {showRoleFilter && (
            <Select aria-label="Filter role" icon="users" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
              <option value="all">All roles</option>
              <option value="head">Heads</option>
              <option value="doctor">Doctors</option>
              <option value="engineer">Engineers</option>
            </Select>
          )}
        </div>
      )}

      {activeTab === 'overview' && (
        <div className="stack">
          <section className="hero anim-up">
            <span className="hero__eyebrow">
              <Icon name="shield-check" size={14} /> Dean console · institution-wide
            </span>
            <h2>Good day, {user?.full_name?.split(' ')[0] || 'Dean'}.</h2>
            <p>
              Monitor every major, keep staff accounts healthy and step in the moment a session
              needs your attention.
            </p>
            <div className="hero__stats">
              <div className="hero__stat">
                <span>Students</span>
                <strong>
                  <AnimatedNumber value={filteredStats.total_students} />
                </strong>
              </div>
              <div className="hero__stat">
                <span>Courses</span>
                <strong>
                  <AnimatedNumber value={filteredStats.total_courses} />
                </strong>
              </div>
              <div className="hero__stat">
                <span>Live sessions</span>
                <strong>
                  <AnimatedNumber value={filteredStats.active_sessions} />
                </strong>
              </div>
              <div className="hero__stat">
                <span>Attendance</span>
                <strong>{overallAttendance !== null ? `${overallAttendance}%` : '—'}</strong>
              </div>
            </div>
          </section>

          <div className="kpi-grid stagger">
            <StatCard
              icon="graduation-cap"
              label="Students"
              value={<AnimatedNumber value={filteredStats.total_students} />}
              meta="Across all majors"
              tone="navy"
            />
            <StatCard
              icon="book"
              label="Courses"
              value={<AnimatedNumber value={filteredStats.total_courses} />}
              meta="All terms"
              tone="blue"
            />
            <StatCard
              icon="user-check"
              label="Doctors"
              value={<AnimatedNumber value={filteredStats.total_doctors} />}
              meta={`${filteredStats.total_engineers} engineers`}
              tone="teal"
            />
            <StatCard
              icon="building"
              label="Majors"
              value={<AnimatedNumber value={majors.length} />}
              meta="Institution structure"
              tone="olive"
            />
            <StatCard
              icon="activity"
              label="Active sessions"
              value={<AnimatedNumber value={filteredStats.active_sessions} />}
              meta="Running right now"
              tone={filteredStats.active_sessions > 0 ? 'warn' : 'default'}
            />
          </div>

          <div className="grid-2">
            <div className="card">
              <div className="data-bar">
                <div>
                  <h2>Quick actions</h2>
                  <p>The tasks deans reach for most.</p>
                </div>
              </div>
              <div className="card__body grid-2" style={{ gap: 10 }}>
                <Button variant="secondary" icon="plus" onClick={() => goTo('majors')}>
                  Manage majors
                </Button>
                <Button variant="secondary" icon="user-plus" onClick={() => goTo('invitations')}>
                  Invitations
                </Button>
                <Button variant="secondary" icon="chart" onClick={() => goTo('reports')}>
                  Institution reports
                </Button>
                <Button variant="secondary" icon="send" onClick={() => goTo('broadcast')}>
                  Broadcast warning
                </Button>
              </div>
            </div>

            <div className="card">
              <div className="data-bar">
                <div>
                  <h2>Live sessions</h2>
                  <p>Force-close anything that should not be running.</p>
                </div>
                <Button variant="soft" size="sm" icon="refresh" onClick={loadActiveSessions}>
                  Refresh
                </Button>
              </div>
              <div className="card__body">
                {filteredSessions.length === 0 ? (
                  <EmptyState icon="activity" title="No active sessions" description="Sessions started by doctors appear here." />
                ) : (
                  <div className="stack" style={{ gap: 10 }}>
                    {filteredSessions.slice(0, 4).map((s) => (
                      <div key={s.id} className="row-between" style={{ gap: 12 }}>
                        <div className="row" style={{ gap: 10, minWidth: 0 }}>
                          <span className="feed__avatar feed__avatar--light">
                            <Icon name="play" size={13} />
                          </span>
                          <div style={{ minWidth: 0 }}>
                            <b style={{ fontSize: '0.86rem' }}>{s.course_code}</b>
                            <span className="muted-cell" style={{ display: 'block', fontSize: '0.74rem' }}>
                              {s.major_name} · {s.created_by_name}
                            </span>
                          </div>
                        </div>
                        <Badge variant="success" dot>
                          {s.attendance_count}/{s.enrolled_count}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'invitations' && (
        <div className="card">
          <div className="data-bar">
            <div>
              <h2>Pending invitations</h2>
              <p>{filteredInvitations.length} invitation(s) waiting for acceptance.</p>
            </div>
            <Badge variant="warning">{filteredInvitations.length} pending</Badge>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Major</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvitations.map((inv) => (
                  <tr key={inv.id}>
                    <td className="strong">{inv.full_name}</td>
                    <td className="muted-cell">{inv.email}</td>
                    <td>
                      <Badge variant="blue">{inv.role}</Badge>
                    </td>
                    <td className="muted-cell">{inv.major_name || '—'}</td>
                    <td>
                      <Button variant="ghost" size="sm" icon="x" onClick={() => cancelInvite(inv.id)}>
                        Cancel
                      </Button>
                    </td>
                  </tr>
                ))}
                {filteredInvitations.length === 0 && (
                  <tr>
                    <td colSpan="5">
                      <EmptyState icon="mail" title="No pending invitations" description="Newly sent invitations appear here." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'staff' && (
        <div className="card">
          <div className="data-bar">
            <div>
              <h2>Manage staff</h2>
              <p>{filteredStaff.length} staff account(s) in this selection.</p>
            </div>
            <Badge variant="blue">{filteredStaff.length} staff</Badge>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Major</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((s) => {
                  const currentStatus = s.status || 'active';
                  return (
                    <tr key={s.id}>
                      <td>
                        <div className="person">
                          <span className="avatar" style={{ width: 32, height: 32 }}>
                            <Icon name={roleIcon(s.role)} size={15} />
                          </span>
                          <b>{s.full_name}</b>
                        </div>
                      </td>
                      <td>
                        <Badge variant="blue">{s.role}</Badge>
                      </td>
                      <td className="muted-cell">{s.major_name || '—'}</td>
                      <td>
                        <Badge variant={statusVariant(currentStatus)} dot>
                          {currentStatus}
                        </Badge>
                      </td>
                      <td>
                        <div className="row" style={{ gap: 6 }}>
                          {currentStatus === 'active' ? (
                            <Button variant="soft" size="sm" icon="lock" onClick={() => handleUserAction('staff', s.id, 'block')}>
                              Block
                            </Button>
                          ) : (
                            <Button variant="success" size="sm" icon="check" onClick={() => handleUserAction('staff', s.id, 'unblock')}>
                              Unblock
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            icon="trash"
                            aria-label={`Delete ${s.full_name}`}
                            onClick={() => handleUserAction('staff', s.id, 'delete')}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredStaff.length === 0 && (
                  <tr>
                    <td colSpan="5">
                      <EmptyState icon="users" title="No staff found" description="Adjust the filters above." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'students' && (
        <div className="card">
          <div className="data-bar">
            <div>
              <h2>Manage students</h2>
              <p>{filteredStudents.length} student account(s) in this selection.</p>
            </div>
            <Badge variant="blue">{filteredStudents.length} students</Badge>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Major</th>
                  <th>Year</th>
                  <th>Status</th>
                  <th style={{ minWidth: 130 }}>Attendance</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s) => {
                  const pct = Number(s.percentage) || 0;
                  return (
                    <tr key={s.id}>
                      <td className="strong">{s.full_name}</td>
                      <td className="muted-cell">{s.major_name}</td>
                      <td className="nowrap">Year {s.academic_year}</td>
                      <td>
                        <Badge variant={statusVariant(s.status)} dot>
                          {s.status}
                        </Badge>
                      </td>
                      <td>
                        <div className="row" style={{ gap: 9 }}>
                          <span style={{ flex: 1, minWidth: 60 }}>
                            <ProgressBar value={pct} tone={pct >= 75 ? 'success' : 'danger'} />
                          </span>
                          <span className={`percent ${pct >= 75 ? 'percent--good' : 'percent--bad'}`}>{pct}%</span>
                        </div>
                      </td>
                      <td>
                        <div className="row" style={{ gap: 6 }}>
                          {s.status === 'active' && (
                            <Button variant="soft" size="sm" icon="lock" onClick={() => handleUserAction('student', s.id, 'block')}>
                              Block
                            </Button>
                          )}
                          {s.status === 'banned' && (
                            <Button variant="success" size="sm" icon="check" onClick={() => handleUserAction('student', s.id, 'unblock')}>
                              Unblock
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            icon="trash"
                            aria-label={`Delete ${s.full_name}`}
                            onClick={() => handleUserAction('student', s.id, 'delete')}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan="6">
                      <EmptyState icon="graduation-cap" title="No students found" description="Adjust the filters above." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'majors' && (
        <div className="stack">
          <section className="form-card form-card--narrow" style={{ maxWidth: '100%' }}>
            <h2>Add a major</h2>
            <p>Majors group courses, staff and students under a head of department.</p>
            <form onSubmit={addMajor} className="toolbar" style={{ alignItems: 'flex-end' }}>
              <div className="grow" style={{ minWidth: 220 }}>
                <Input
                  label="Major name"
                  icon="building"
                  placeholder="Computer Science"
                  value={majorForm.name}
                  onChange={(e) => setMajorForm({ name: e.target.value })}
                />
              </div>
              <Button type="submit" icon="plus">
                Add major
              </Button>
            </form>
          </section>

          <div className="card">
            <div className="data-bar">
              <div>
                <h2>Majors</h2>
                <p>{majors.length} major(s) configured.</p>
              </div>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Head of department</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {majors.map((m) => (
                    <tr key={m.id}>
                      <td className="muted-cell">#{m.id}</td>
                      <td>
                        {editingMajor && editingMajor.id === m.id ? (
                          <input
                            className="input"
                            value={editingMajor.name}
                            onChange={(e) => setEditingMajor({ ...editingMajor, name: e.target.value })}
                            aria-label="Major name"
                          />
                        ) : (
                          <b>{m.name}</b>
                        )}
                      </td>
                      <td className="muted-cell">{m.head_name || '—'}</td>
                      <td>
                        {editingMajor && editingMajor.id === m.id ? (
                          <div className="row" style={{ gap: 6 }}>
                            <Button variant="success" size="sm" icon="check" onClick={updateMajor}>
                              Save
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => setEditingMajor(null)}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="row" style={{ gap: 6 }}>
                            <Button
                              variant="secondary"
                              size="sm"
                              icon="edit"
                              onClick={() => setEditingMajor({ id: m.id, name: m.name })}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              icon="trash"
                              aria-label={`Delete ${m.name}`}
                              onClick={() => deleteMajor(m.id)}
                            />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {majors.length === 0 && (
                    <tr>
                      <td colSpan="4">
                        <EmptyState icon="building" title="No majors yet" description="Add the first major using the form above." />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'broadcast' && (
        <section className="form-card" style={{ maxWidth: 720 }}>
          <h2>Broadcast a warning</h2>
          <p>Delivered instantly as an in-app notification to the selected students.</p>
          <form onSubmit={sendBroadcast} className="stack" style={{ gap: 16 }}>
            <Input
              label="Subject"
              icon="file-text"
              placeholder="Attendance warning"
              value={broadcastForm.subject}
              onChange={(e) => setBroadcastForm({ ...broadcastForm, subject: e.target.value })}
            />
            <div className="form-grid">
              <Select
                label="Warning type"
                value={broadcastForm.warning_type}
                onChange={(e) => setBroadcastForm({ ...broadcastForm, warning_type: e.target.value })}
              >
                <option value="general">General</option>
                <option value="academic">Academic</option>
                <option value="disciplinary">Disciplinary</option>
              </Select>
              <Select
                label="Target"
                value={broadcastForm.target}
                onChange={(e) => setBroadcastForm({ ...broadcastForm, target: e.target.value })}
              >
                <option value="all">All active students</option>
                <option value="major">By major</option>
                <option value="year">By major &amp; year</option>
              </Select>
            </div>
            {(broadcastForm.target === 'major' || broadcastForm.target === 'year') && (
              <Select
                label="Major"
                icon="building"
                value={broadcastForm.major_id}
                onChange={(e) => setBroadcastForm({ ...broadcastForm, major_id: e.target.value })}
              >
                <option value="">Select major</option>
                {majors.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            )}
            {broadcastForm.target === 'year' && (
              <Select
                label="Academic year"
                icon="graduation-cap"
                value={broadcastForm.academic_year}
                onChange={(e) => setBroadcastForm({ ...broadcastForm, academic_year: e.target.value })}
              >
                <option value="">Select year</option>
                <option value="1">Year 1</option>
                <option value="2">Year 2</option>
                <option value="3">Year 3</option>
                <option value="4">Year 4</option>
              </Select>
            )}
            <Textarea
              label="Message"
              placeholder="Write the warning message…"
              value={broadcastForm.message}
              onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
            />
            <Button type="submit" variant="accent" icon="send" style={{ alignSelf: 'flex-start' }}>
              Send broadcast
            </Button>
          </form>
        </section>
      )}

      {activeTab === 'reports' && (
        <div className="stack">
          <div className="card">
            <div className="data-bar">
              <div>
                <h2>Attendance overview by major</h2>
                <p>How each major is performing this term.</p>
              </div>
              <Button variant="soft" size="sm" icon="refresh" onClick={loadAttendanceOverview}>
                Refresh
              </Button>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Major</th>
                    <th>Students</th>
                    <th>Courses</th>
                    <th>Sessions conducted</th>
                    <th style={{ minWidth: 160 }}>Attendance rate</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAttendanceOverview.map((a) => {
                    const rate = Number(a.attendance_rate) || 0;
                    return (
                      <tr key={a.id}>
                        <td className="strong">{a.major_name}</td>
                        <td className="num">{a.total_students}</td>
                        <td className="num">{a.total_courses}</td>
                        <td className="num">{a.total_sessions_conducted}</td>
                        <td>
                          <div className="row" style={{ gap: 9 }}>
                            <span style={{ flex: 1, minWidth: 70 }}>
                              <ProgressBar value={rate} tone={rate >= 75 ? 'success' : 'warning'} />
                            </span>
                            <span className={`percent ${rate >= 75 ? 'percent--good' : 'percent--bad'}`}>{rate}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredAttendanceOverview.length === 0 && (
                    <tr>
                      <td colSpan="5">
                        <EmptyState icon="chart" title="No overview data" description="Attendance data appears once sessions are recorded." />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="data-bar">
              <div>
                <h2>High risk students</h2>
                <p>Students whose attendance falls below the threshold.</p>
              </div>
              <div className="data-bar__actions">
                <span className="muted" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                  Below
                </span>
                <input
                  className="input"
                  type="number"
                  aria-label="High risk threshold"
                  style={{ width: 82 }}
                  value={highRiskThreshold}
                  onChange={(e) => setHighRiskThreshold(e.target.value)}
                />
                <span className="muted" style={{ fontWeight: 700 }}>
                  %
                </span>
                <Button variant="secondary" size="sm" icon="refresh" onClick={loadHighRiskStudents}>
                  Apply
                </Button>
              </div>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Major</th>
                    <th>Year</th>
                    <th>Total</th>
                    <th>Attended</th>
                    <th style={{ minWidth: 140 }}>Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHighRisk.map((s) => {
                    const pct = Number(s.attendance_percentage) || 0;
                    return (
                      <tr key={s.id}>
                        <td className="strong">{s.full_name}</td>
                        <td className="muted-cell">{s.major_name}</td>
                        <td className="nowrap">Year {s.academic_year}</td>
                        <td className="num">{s.total_sessions}</td>
                        <td className="num">{s.attended_sessions}</td>
                        <td>
                          <div className="row" style={{ gap: 9 }}>
                            <span style={{ flex: 1, minWidth: 60 }}>
                              <ProgressBar value={pct} tone="danger" />
                            </span>
                            <span className="percent percent--bad">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredHighRisk.length === 0 && (
                    <tr>
                      <td colSpan="6">
                        <EmptyState icon="shield-check" title="No students below the threshold" description="Everyone is above the current limit." />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="data-bar">
              <div>
                <h2>Staff activity</h2>
                <p>Who opened sessions and how they were attended.</p>
              </div>
              <Button variant="soft" size="sm" icon="refresh" onClick={loadStaffActivity}>
                Refresh
              </Button>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Staff</th>
                    <th>Role</th>
                    <th>Major</th>
                    <th>Courses</th>
                    <th>Sessions</th>
                    <th>Completed</th>
                    <th>Active</th>
                    <th>Avg / session</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaffActivity.map((st) => (
                    <tr key={st.id}>
                      <td className="strong">{st.full_name}</td>
                      <td>
                        <Badge variant="blue">{st.role}</Badge>
                      </td>
                      <td className="muted-cell">{st.major_name || '—'}</td>
                      <td className="num">{st.courses_assigned}</td>
                      <td className="num">{st.sessions_created}</td>
                      <td className="num">{st.sessions_completed}</td>
                      <td className="num">{st.sessions_active}</td>
                      <td className="num">{st.avg_attendance_per_session}</td>
                    </tr>
                  ))}
                  {filteredStaffActivity.length === 0 && (
                    <tr>
                      <td colSpan="8">
                        <EmptyState icon="users" title="No staff activity" description="Activity appears after the first session." />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'sessions' && (
        <div className="card">
          <div className="data-bar">
            <div>
              <h2>Live active sessions</h2>
              <p>{filteredSessions.length} session(s) running across the institution.</p>
            </div>
            <Button variant="secondary" size="sm" icon="refresh" onClick={loadActiveSessions}>
              Refresh
            </Button>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Major</th>
                  <th>Year</th>
                  <th>Created by</th>
                  <th>Role</th>
                  <th>Attendance</th>
                  <th>Started</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <span className="strong">{s.course_code}</span>
                      <span className="muted-cell"> — {s.course_name}</span>
                    </td>
                    <td className="muted-cell">{s.major_name}</td>
                    <td className="nowrap">Year {s.academic_year}</td>
                    <td className="muted-cell">{s.created_by_name}</td>
                    <td>
                      <Badge variant="neutral">{s.created_by_role}</Badge>
                    </td>
                    <td>
                      <Badge variant="success">
                        {s.attendance_count}/{s.enrolled_count}
                      </Badge>
                    </td>
                    <td className="muted-cell nowrap">{new Date(s.start_time).toLocaleString()}</td>
                    <td>
                      <Button variant="danger" size="sm" icon="stop" onClick={() => forceCloseSession(s.id)}>
                        Force close
                      </Button>
                    </td>
                  </tr>
                ))}
                {filteredSessions.length === 0 && (
                  <tr>
                    <td colSpan="8">
                      <EmptyState icon="activity" title="No active sessions" description="Everything is idle right now." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="stack">
          {!analytics ? (
            <Loader label="Building analytics…" />
          ) : (
            <>
              <div className="card">
                <div className="data-bar">
                  <div>
                    <h2>Attendance trend · last 14 days</h2>
                    <p>Sessions opened and attendance records created.</p>
                  </div>
                  <Button variant="soft" size="sm" icon="refresh" onClick={loadAnalytics}>
                    Refresh
                  </Button>
                </div>
                <div className="table-wrap">
                  <table className="table table--compact">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Sessions</th>
                        <th>Attendance records</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.attendance_trend.map((t, idx) => (
                        <tr key={idx}>
                          <td className="nowrap">{t.date}</td>
                          <td className="num">{t.sessions_count}</td>
                          <td className="num">{t.attendance_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card">
                <div className="data-bar">
                  <div>
                    <h2>Most absent students</h2>
                    <p>The highest absence percentages across the institution.</p>
                  </div>
                  <Badge variant="danger">{filteredMostAbsent.length} students</Badge>
                </div>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Major</th>
                        <th>Year</th>
                        <th>Total</th>
                        <th>Attended</th>
                        <th>Absent</th>
                        <th>Absence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMostAbsent.map((s) => (
                        <tr key={s.id}>
                          <td className="strong">{s.full_name}</td>
                          <td className="muted-cell">{s.major_name}</td>
                          <td className="nowrap">Year {s.academic_year}</td>
                          <td className="num">{s.total_sessions}</td>
                          <td className="num">{s.attended_sessions}</td>
                          <td className="num">{s.absent_count}</td>
                          <td className="percent percent--bad">{s.absence_percentage}%</td>
                        </tr>
                      ))}
                      {filteredMostAbsent.length === 0 && (
                        <tr>
                          <td colSpan="7">
                            <EmptyState icon="shield-check" title="No absence data" description="Try changing the filters." />
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card">
                <div className="data-bar">
                  <div>
                    <h2>Course completion</h2>
                    <p>Average attendance per session for each course.</p>
                  </div>
                </div>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Course</th>
                        <th>Major</th>
                        <th>Year</th>
                        <th>Enrolled</th>
                        <th>Sessions held</th>
                        <th>Avg attendance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCourseCompletion.map((c) => (
                        <tr key={c.id}>
                          <td>
                            <span className="strong">{c.course_code}</span>
                            <span className="muted-cell"> — {c.course_name}</span>
                          </td>
                          <td className="muted-cell">{c.major_name}</td>
                          <td className="nowrap">Year {c.academic_year}</td>
                          <td className="num">{c.enrolled_students}</td>
                          <td className="num">{c.total_sessions_held}</td>
                          <td className="num">{c.avg_attendance_per_session}</td>
                        </tr>
                      ))}
                      {filteredCourseCompletion.length === 0 && (
                        <tr>
                          <td colSpan="6">
                            <EmptyState icon="book" title="No course data" description="Try changing the filters." />
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="card">
          <div className="data-bar">
            <div>
              <h2>Audit logs</h2>
              <p>Security-relevant actions across the platform.</p>
            </div>
            <div className="data-bar__actions">
              <Badge variant="neutral">{auditTotal} total</Badge>
              <Button variant="secondary" size="sm" icon="refresh" onClick={loadAuditLogs}>
                Refresh
              </Button>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table table--compact">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Target type</th>
                  <th>Target ID</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="muted-cell nowrap">{new Date(log.created_at).toLocaleString()}</td>
                    <td>{log.actor_name || '—'}</td>
                    <td>
                      <Badge variant="blue">{log.action}</Badge>
                    </td>
                    <td className="muted-cell">{log.target_type || '—'}</td>
                    <td className="muted-cell">{log.target_id || '—'}</td>
                    <td className="muted-cell mono">{log.ip_address || '—'}</td>
                  </tr>
                ))}
                {auditLogs.length === 0 && (
                  <tr>
                    <td colSpan="6">
                      <EmptyState icon="shield" title="No audit logs" description="Actions will be recorded here as they happen." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
