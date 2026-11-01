import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import DashboardLayout from '../components/layout/DashboardLayout';
import Button from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import { Input, Select, Textarea } from '../components/ui/Field';
import { Alert, Badge, EmptyState, Loader, StatCard } from '../components/ui/Feedback';
import { AnimatedNumber, ProgressBar } from '../components/ui/Motion';

const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'ST';

const statusVariant = (status) =>
  status === 'active' ? 'success' : status === 'pending' ? 'warning' : 'danger';

export default function HeadDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('overview');
  const [courses, setCourses] = useState([]);
  const [staff, setStaff] = useState([]);
  const [overview, setOverview] = useState(null);
  const [majorInfo, setMajorInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterCourseYear, setFilterCourseYear] = useState('all');
  const [filterCourseTerm, setFilterCourseTerm] = useState('all');

  const [filterStudentYear, setFilterStudentYear] = useState('all');

  const [filterInviteRole, setFilterInviteRole] = useState('all');

  const [filterPerfRole, setFilterPerfRole] = useState('all');

  const [filterSessionYear, setFilterSessionYear] = useState('all');

  // Course modals
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [courseForm, setCourseForm] = useState({ course_code: '', course_name: '', academic_year: '1', term: '1' });
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningToCourse, setAssigningToCourse] = useState(null);
  const [assignForm, setAssignForm] = useState({ staff_id: '', role_in_course: 'doctor', is_primary: false });

  // Invitations & students
  const [inviteForm, setInviteForm] = useState({ full_name: '', email: '', national_id: '', role: 'doctor' });
  const [inviteStatus, setInviteStatus] = useState('');
  const [pendingInvites, setPendingInvites] = useState([]);
  const [allStudents, setAllStudents] = useState([]);

  // Risk & warnings
  const [riskStudents, setRiskStudents] = useState([]);
  const [riskThreshold, setRiskThreshold] = useState(75);
  const [warningForm, setWarningForm] = useState({ subject: '', message: '', warning_type: 'general', academic_year: '', target: 'all' });

  // Sessions & performance
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
        client.get('/head/major/info'),
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
  // Course management
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
      term: course.term || '1',
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
        is_primary: assignForm.is_primary,
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
  // Invitations & students
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
    } catch (err) {
      console.error(err);
    }
  };

  const cancelInvite = async (id) => {
    if (!window.confirm('Cancel this invitation?')) return;
    try {
      await client.delete(`/head/invitations/${id}`);
      loadPendingInvites();
      alert('Invitation cancelled successfully');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel invitation');
    }
  };

  const loadAllStudents = async () => {
    try {
      const res = await client.get('/head/students');
      setAllStudents(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleStudent = async (studentId, status) => {
    const action = status === 'banned' ? 'block' : 'unblock';
    if (!window.confirm(`Are you sure you want to ${action} this student?`)) return;
    try {
      await client.put(`/head/students/${studentId}/status`, { status });
      loadAllStudents();
      alert(`Student ${action}ed successfully`);
    } catch (err) {
      alert(err.response?.data?.message || 'Action failed');
    }
  };

  // ============================
  // Risk & warnings
  // ============================
  const loadRiskStudents = async () => {
    try {
      const res = await client.get(`/head/students/risk?threshold=${riskThreshold}`);
      setRiskStudents(res.data.students || []);
    } catch (err) {
      console.error(err);
    }
  };

  const sendWarning = async (e) => {
    e.preventDefault();
    if (!warningForm.subject.trim() || !warningForm.message.trim()) {
      return alert('Subject and message are required');
    }
    try {
      const payload = {
        subject: warningForm.subject,
        message: warningForm.message,
        warning_type: warningForm.warning_type,
      };
      if (warningForm.target === 'year' && warningForm.academic_year) {
        payload.academic_year = warningForm.academic_year;
      }
      const res = await client.post('/head/students/warning', payload);
      alert(res.data.message);
      setWarningForm({ subject: '', message: '', warning_type: 'general', academic_year: '', target: 'all' });
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send warning');
    }
  };

  // ============================
  // Sessions & performance
  // ============================
  const loadActiveSessions = async () => {
    try {
      const res = await client.get('/head/sessions/active');
      setActiveSessions(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const closeSession = async (id) => {
    if (!window.confirm('Are you sure you want to close this session?')) return;
    try {
      await client.post(`/head/sessions/${id}/close`);
      loadActiveSessions();
      alert('Session closed successfully');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to close session');
    }
  };

  const loadStaffPerf = async () => {
    try {
      const res = await client.get('/head/staff/performance');
      setStaffPerf(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const doctors = staff.filter((s) => s.role === 'doctor' || s.role === 'head');
  const engineers = staff.filter((s) => s.role === 'engineer');

  const filteredCourses = courses.filter((c) => {
    const matchYear = filterCourseYear === 'all' || c.academic_year === filterCourseYear;
    const matchTerm = filterCourseTerm === 'all' || c.term === filterCourseTerm;
    return matchYear && matchTerm;
  });

  const filteredStudents = allStudents.filter(
    (s) => filterStudentYear === 'all' || s.academic_year === filterStudentYear
  );

  const filteredInvites = pendingInvites.filter(
    (inv) => filterInviteRole === 'all' || inv.role === filterInviteRole
  );

  const filteredPerf = staffPerf.filter(
    (st) => filterPerfRole === 'all' || st.role === filterPerfRole
  );

  const filteredSessions = activeSessions.filter(
    (s) => filterSessionYear === 'all' || s.academic_year === filterSessionYear
  );

  const currentTerm = majorInfo?.current_term || '1';
  const termLabel = currentTerm === '2' ? '2nd Term' : '1st Term';

  const nav = [
    { key: 'overview', label: 'Overview', icon: 'home', section: 'Department' },
    { key: 'courses', label: 'Manage Courses', icon: 'book' },
    { key: 'sessions', label: 'Active Sessions', icon: 'activity' },
    { key: 'performance', label: 'Staff Performance', icon: 'chart', section: 'Staff' },
    { key: 'invite', label: 'Invite Staff', icon: 'user-plus' },
    { key: 'invitations', label: 'Pending Invitations', icon: 'mail' },
    { key: 'students', label: 'All Students', icon: 'users', section: 'Students' },
    { key: 'risk', label: 'High Risk', icon: 'alert' },
    { key: 'warning', label: 'Send Warning', icon: 'send' },
    { key: 'pending-route', label: 'Pending Students', icon: 'user-check', to: '/head/pending-students' },
    { key: 'doctor-route', label: 'Doctor View', icon: 'play', to: '/doctor' },
    { key: 'reports-route', label: 'Reports', icon: 'file-text', to: '/doctor/reports' },
    { key: 'signout', label: 'Sign out', icon: 'logout', onClick: logout, section: 'Account' },
  ].map((item) =>
    ['overview', 'courses', 'sessions', 'performance', 'invite', 'invitations', 'students', 'risk', 'warning'].includes(item.key)
      ? { ...item, onClick: () => setActiveTab(item.key) }
      : item
  );

  if (loading) {
    return (
      <DashboardLayout
        user={user}
        role="head"
        nav={nav}
        activeKey={activeTab}
        title="Head workspace"
        crumb="Head of Department"
        term={termLabel}
        onLogout={logout}
      >
        <Loader label="Loading department data…" />
      </DashboardLayout>
    );
  }

  if (!overview) {
    return (
      <DashboardLayout
        user={user}
        role="head"
        nav={nav}
        activeKey={activeTab}
        title="Head workspace"
        crumb="Head of Department"
        onLogout={logout}
      >
        <Alert variant="error">Failed to load department data. Please refresh the page.</Alert>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      user={user}
      role="head"
      nav={nav}
      activeKey={activeTab}
      title={{
        overview: 'Department overview',
        courses: 'Manage courses',
        invite: 'Invite staff',
        invitations: 'Pending invitations',
        students: 'All students',
        risk: 'High risk students',
        warning: 'Send warning',
        sessions: 'Active sessions',
        performance: 'Staff performance',
      }[activeTab] || 'Head workspace'}
      crumb="Head of Department"
      term={termLabel}
      onLogout={logout}
      actions={
        <>
          <div style={{ minWidth: 132 }}>
            <Select
              aria-label="Active term"
              icon="calendar"
              value={currentTerm}
              onChange={handleTermChange}
            >
              <option value="1">1st Term</option>
              <option value="2">2nd Term</option>
            </Select>
          </div>
          <Button variant="secondary" size="sm" icon="play" onClick={() => navigate('/doctor')}>
            Doctor view
          </Button>
        </>
      }
    >
      {activeTab === 'overview' && (
        <div className="stack">
          <section className="hero anim-up">
            <span className="hero__eyebrow">
              <Icon name="building" size={14} /> {overview.major?.name || 'Department'}
            </span>
            <h2>{termLabel} is in progress.</h2>
            <p>
              Manage courses, staff assignments, student accounts and live sessions from one
              control room.
            </p>
            <div className="hero__stats">
              <div className="hero__stat">
                <span>Students</span>
                <strong>
                  <AnimatedNumber value={overview.stats.total_students} />
                </strong>
              </div>
              <div className="hero__stat">
                <span>Courses</span>
                <strong>
                  <AnimatedNumber value={overview.stats.total_courses} />
                </strong>
              </div>
              <div className="hero__stat">
                <span>Sessions</span>
                <strong>
                  <AnimatedNumber value={overview.stats.total_sessions} />
                </strong>
              </div>
              <div className="hero__stat">
                <span>Staff</span>
                <strong>
                  <AnimatedNumber value={staff.length} />
                </strong>
              </div>
            </div>
          </section>

          <div className="kpi-grid stagger">
            <StatCard
              icon="users"
              label="Students"
              value={<AnimatedNumber value={overview.stats.total_students} />}
              meta="Active in major"
              tone="navy"
            />
            <StatCard
              icon="book"
              label="Courses"
              value={<AnimatedNumber value={overview.stats.total_courses} />}
              meta="Across all terms"
              tone="blue"
            />
            <StatCard
              icon="calendar"
              label="Sessions"
              value={<AnimatedNumber value={overview.stats.total_sessions} />}
              meta="Recorded so far"
              tone="teal"
            />
            <StatCard
              icon="graduation-cap"
              label="Doctors"
              value={<AnimatedNumber value={doctors.length} />}
              meta={`${engineers.length} engineers`}
              tone="olive"
            />
          </div>

          <div className="grid-2">
            <div className="card">
              <div className="data-bar">
                <div>
                  <h2>Quick actions</h2>
                  <p>The most common department tasks.</p>
                </div>
              </div>
              <div className="card__body grid-2" style={{ gap: 10 }}>
                <Button variant="secondary" icon="plus" onClick={() => { setActiveTab('courses'); openAddCourseModal(); }}>
                  Add course
                </Button>
                <Button variant="secondary" icon="user-plus" onClick={() => setActiveTab('invite')}>
                  Invite staff
                </Button>
                <Button variant="secondary" icon="user-check" onClick={() => navigate('/head/pending-students')}>
                  Approve students
                </Button>
                <Button variant="secondary" icon="send" onClick={() => setActiveTab('warning')}>
                  Send warning
                </Button>
              </div>
            </div>

            <div className="card">
              <div className="data-bar">
                <div>
                  <h2>Current term</h2>
                  <p>Changing the term updates doctor and student views.</p>
                </div>
                <Badge variant="blue">{termLabel}</Badge>
              </div>
              <div className="card__body">
                <div className="stack" style={{ gap: 14 }}>
                  <div className="row" style={{ gap: 10 }}>
                    <Icon name="calendar" size={18} />
                    <span className="grow">Active term</span>
                    <b>{termLabel}</b>
                  </div>
                  <div className="row" style={{ gap: 10 }}>
                    <Icon name="book" size={18} />
                    <span className="grow">Courses this term</span>
                    <b>{courses.filter((c) => c.term === currentTerm).length}</b>
                  </div>
                  <div className="row" style={{ gap: 10 }}>
                    <Icon name="users" size={18} />
                    <span className="grow">Doctors assigned</span>
                    <b>{doctors.length}</b>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'courses' && (
        <div className="card">
          <div className="data-bar">
            <div>
              <h2>Manage courses</h2>
              <p>{filteredCourses.length} course(s) match the filters.</p>
            </div>
            <div className="data-bar__actions">
              <Select aria-label="Filter year" value={filterCourseYear} onChange={(e) => setFilterCourseYear(e.target.value)}>
                <option value="all">All years</option>
                <option value="1">Year 1</option>
                <option value="2">Year 2</option>
                <option value="3">Year 3</option>
                <option value="4">Year 4</option>
              </Select>
              <Select aria-label="Filter term" value={filterCourseTerm} onChange={(e) => setFilterCourseTerm(e.target.value)}>
                <option value="all">All terms</option>
                <option value="1">1st Term</option>
                <option value="2">2nd Term</option>
              </Select>
              <Button size="sm" icon="plus" onClick={openAddCourseModal}>
                Add course
              </Button>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Year</th>
                  <th>Term</th>
                  <th>Students</th>
                  <th>Doctor</th>
                  <th>Engineers</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCourses.length === 0 ? (
                  <tr>
                    <td colSpan="8">
                      <EmptyState icon="book" title="No courses found" description="Adjust the filters or add a new course." />
                    </td>
                  </tr>
                ) : (
                  filteredCourses.map((c) => {
                    const courseDoctor = c.staff?.find((s) => s.role_in_course === 'doctor');
                    const courseEngineers = c.staff?.filter((s) => s.role_in_course === 'engineer') || [];
                    const isCurrentTerm = c.term === currentTerm;
                    return (
                      <tr key={c.id} className={isCurrentTerm ? 'row-selected' : ''}>
                        <td className="strong">{c.course_code}</td>
                        <td>{c.course_name}</td>
                        <td className="muted-cell nowrap">Year {c.academic_year}</td>
                        <td className="nowrap">
                          {c.term === '2' ? '2nd Term' : '1st Term'}
                          {isCurrentTerm && <Badge variant="success" className="badge--dot">Active</Badge>}
                        </td>
                        <td className="num">{c.students}</td>
                        <td>
                          {courseDoctor ? (
                            <div className="row" style={{ gap: 8 }}>
                              <div className="person__meta">
                                <b>Dr. {courseDoctor.full_name}</b>
                                {courseDoctor.is_primary && <span>Primary</span>}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                icon="trash"
                                aria-label="Remove doctor"
                                onClick={() => removeStaff(c.id, courseDoctor.assignment_id)}
                              />
                            </div>
                          ) : (
                            <Button variant="soft" size="sm" icon="plus" onClick={() => openAssignModal(c, 'doctor')}>
                              Assign doctor
                            </Button>
                          )}
                        </td>
                        <td>
                          <div className="stack" style={{ gap: 6 }}>
                            {courseEngineers.map((eng) => (
                              <div key={eng.assignment_id} className="row" style={{ gap: 8 }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Eng. {eng.full_name}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  icon="x"
                                  aria-label="Remove engineer"
                                  onClick={() => removeStaff(c.id, eng.assignment_id)}
                                />
                              </div>
                            ))}
                            <Button variant="soft" size="sm" icon="plus" onClick={() => openAssignModal(c, 'engineer')}>
                              Assign engineer
                            </Button>
                          </div>
                        </td>
                        <td>
                          <div className="row" style={{ gap: 6 }}>
                            <Button variant="secondary" size="sm" icon="edit" onClick={() => openEditCourseModal(c)}>
                              Edit
                            </Button>
                            <Button variant="ghost" size="sm" icon="trash" aria-label="Delete course" onClick={() => deleteCourse(c.id)} />
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'invite' && (
        <section className="form-card form-card--narrow">
          <h2>Invite a doctor or engineer</h2>
          <p>They will receive a secure invitation link to create their account.</p>
          <form onSubmit={sendInvite} className="stack" style={{ gap: 16 }}>
            <Input
              label="Full name"
              icon="user"
              placeholder="Dr. Ahmed Mohamed"
              value={inviteForm.full_name}
              onChange={(e) => setInviteForm({ ...inviteForm, full_name: e.target.value })}
              required
            />
            <Input
              label="Email"
              type="email"
              icon="mail"
              placeholder="name@university.edu"
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              required
            />
            <Input
              label="National ID"
              icon="id-card"
              placeholder="14 digits"
              inputMode="numeric"
              value={inviteForm.national_id}
              onChange={(e) => setInviteForm({ ...inviteForm, national_id: e.target.value })}
              required
            />
            <Select
              label="Role"
              value={inviteForm.role}
              onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
            >
              <option value="doctor">Doctor</option>
              <option value="engineer">Engineer</option>
            </Select>
            <Button type="submit" icon="send" className="btn--block">
              Send invitation
            </Button>
          </form>
          {inviteStatus && (
            <div style={{ marginTop: 16 }}>
              <Alert variant={inviteStatus.startsWith('✅') ? 'success' : 'error'}>{inviteStatus}</Alert>
            </div>
          )}
        </section>
      )}

      {activeTab === 'invitations' && (
        <div className="card">
          <div className="data-bar">
            <div>
              <h2>Pending invitations</h2>
              <p>{filteredInvites.length} invitation(s) waiting for acceptance.</p>
            </div>
            <div className="data-bar__actions">
              <Select aria-label="Filter role" value={filterInviteRole} onChange={(e) => setFilterInviteRole(e.target.value)}>
                <option value="all">All roles</option>
                <option value="doctor">Doctors</option>
                <option value="engineer">Engineers</option>
              </Select>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvites.map((inv) => (
                  <tr key={inv.id}>
                    <td className="strong">{inv.full_name}</td>
                    <td className="muted-cell">{inv.email}</td>
                    <td>
                      <Badge variant="blue">{inv.role}</Badge>
                    </td>
                    <td>
                      <Button variant="ghost" size="sm" icon="x" onClick={() => cancelInvite(inv.id)}>
                        Cancel
                      </Button>
                    </td>
                  </tr>
                ))}
                {filteredInvites.length === 0 && (
                  <tr>
                    <td colSpan="4">
                      <EmptyState icon="mail" title="No pending invitations" description="New invitations will appear here until they are accepted." />
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
              <h2>All students in your major</h2>
              <p>{filteredStudents.length} student(s) shown.</p>
            </div>
            <div className="data-bar__actions">
              <Select aria-label="Filter year" value={filterStudentYear} onChange={(e) => setFilterStudentYear(e.target.value)}>
                <option value="all">All years</option>
                <option value="1">Year 1</option>
                <option value="2">Year 2</option>
                <option value="3">Year 3</option>
                <option value="4">Year 4</option>
              </Select>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>National ID</th>
                  <th>Year</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className="person">
                        <span className="avatar" style={{ width: 32, height: 32, fontSize: '0.66rem' }}>
                          {initials(s.full_name)}
                        </span>
                        <b>{s.full_name}</b>
                      </div>
                    </td>
                    <td className="muted-cell mono">{s.national_id}</td>
                    <td className="nowrap">Year {s.academic_year}</td>
                    <td>
                      <Badge variant={statusVariant(s.status)} dot>
                        {s.status}
                      </Badge>
                    </td>
                    <td>
                      {s.status === 'active' && (
                        <Button variant="danger" size="sm" icon="user-x" onClick={() => toggleStudent(s.id, 'banned')}>
                          Block
                        </Button>
                      )}
                      {s.status === 'banned' && (
                        <Button variant="success" size="sm" icon="user-check" onClick={() => toggleStudent(s.id, 'active')}>
                          Unblock
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan="5">
                      <EmptyState icon="users" title="No students found" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'risk' && (
        <div className="card">
          <div className="data-bar">
            <div>
              <h2>High risk students</h2>
              <p>Students whose attendance is below the threshold.</p>
            </div>
            <div className="data-bar__actions">
              <div className="row" style={{ gap: 8 }}>
                <span className="muted" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Below</span>
                <Input
                  type="number"
                  aria-label="Risk threshold"
                  value={riskThreshold}
                  onChange={(e) => setRiskThreshold(e.target.value)}
                  style={{ width: 84 }}
                />
                <span className="muted" style={{ fontWeight: 700 }}>%</span>
                <Button variant="secondary" size="sm" icon="refresh" onClick={loadRiskStudents}>
                  Apply
                </Button>
              </div>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Year</th>
                  <th>Attended</th>
                  <th style={{ minWidth: 170 }}>Attendance</th>
                </tr>
              </thead>
              <tbody>
                {riskStudents.map((s) => (
                  <tr key={s.id}>
                    <td className="strong">{s.full_name}</td>
                    <td className="nowrap">Year {s.academic_year}</td>
                    <td className="num">
                      {s.attended_sessions} / {s.total_sessions}
                    </td>
                    <td>
                      <div className="row" style={{ gap: 10 }}>
                        <span style={{ flex: 1 }}>
                          <ProgressBar value={Number(s.attendance_percentage) || 0} tone="danger" />
                        </span>
                        <span className="percent percent--bad">{s.attendance_percentage}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
                {riskStudents.length === 0 && (
                  <tr>
                    <td colSpan="4">
                      <EmptyState
                        icon="shield-check"
                        title="No students below the threshold"
                        description="Adjust the percentage and apply to re-check."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'warning' && (
        <section className="form-card" style={{ maxWidth: 720 }}>
          <h2>Send a warning to students</h2>
          <p>Delivered instantly as an in-app notification.</p>
          <form onSubmit={sendWarning} className="stack" style={{ gap: 16 }}>
            <Input
              label="Subject"
              icon="file-text"
              placeholder="Attendance warning"
              value={warningForm.subject}
              onChange={(e) => setWarningForm({ ...warningForm, subject: e.target.value })}
            />
            <div className="form-grid">
              <Select
                label="Warning type"
                value={warningForm.warning_type}
                onChange={(e) => setWarningForm({ ...warningForm, warning_type: e.target.value })}
              >
                <option value="general">General</option>
                <option value="academic">Academic</option>
                <option value="disciplinary">Disciplinary</option>
              </Select>
              <Select
                label="Target"
                value={warningForm.target}
                onChange={(e) => setWarningForm({ ...warningForm, target: e.target.value })}
              >
                <option value="all">All students in major</option>
                <option value="year">By year</option>
              </Select>
            </div>
            {warningForm.target === 'year' && (
              <Select
                label="Academic year"
                value={warningForm.academic_year}
                onChange={(e) => setWarningForm({ ...warningForm, academic_year: e.target.value })}
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
              value={warningForm.message}
              onChange={(e) => setWarningForm({ ...warningForm, message: e.target.value })}
            />
            <Button type="submit" variant="accent" icon="send" style={{ alignSelf: 'flex-start' }}>
              Send warning
            </Button>
          </form>
        </section>
      )}

      {activeTab === 'sessions' && (
        <div className="card">
          <div className="data-bar">
            <div>
              <h2>Active sessions</h2>
              <p>{filteredSessions.length} session(s) currently running.</p>
            </div>
            <div className="data-bar__actions">
              <Select aria-label="Filter year" value={filterSessionYear} onChange={(e) => setFilterSessionYear(e.target.value)}>
                <option value="all">All years</option>
                <option value="1">Year 1</option>
                <option value="2">Year 2</option>
                <option value="3">Year 3</option>
                <option value="4">Year 4</option>
              </Select>
              <Button variant="secondary" size="sm" icon="refresh" onClick={loadActiveSessions}>
                Refresh
              </Button>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Created by</th>
                  <th>Start time</th>
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
                    <td className="muted-cell">{s.created_by_name}</td>
                    <td className="muted-cell nowrap">{new Date(s.start_time).toLocaleString()}</td>
                    <td>
                      <Button variant="danger" size="sm" icon="stop" onClick={() => closeSession(s.id)}>
                        Close session
                      </Button>
                    </td>
                  </tr>
                ))}
                {filteredSessions.length === 0 && (
                  <tr>
                    <td colSpan="4">
                      <EmptyState icon="activity" title="No active sessions" description="When a doctor starts a session it will appear here." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'performance' && (
        <div className="card">
          <div className="data-bar">
            <div>
              <h2>Staff performance</h2>
              <p>{filteredPerf.length} staff member(s).</p>
            </div>
            <div className="data-bar__actions">
              <Select aria-label="Filter role" value={filterPerfRole} onChange={(e) => setFilterPerfRole(e.target.value)}>
                <option value="all">All roles</option>
                <option value="doctor">Doctors</option>
                <option value="engineer">Engineers</option>
                <option value="head">Heads</option>
              </Select>
              <Button variant="secondary" size="sm" icon="refresh" onClick={loadStaffPerf}>
                Refresh
              </Button>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Role</th>
                  <th>Courses</th>
                  <th>Sessions created</th>
                </tr>
              </thead>
              <tbody>
                {filteredPerf.map((st) => (
                  <tr key={st.id}>
                    <td>
                      <div className="person">
                        <span className="avatar" style={{ width: 32, height: 32, fontSize: '0.66rem' }}>
                          {initials(st.full_name)}
                        </span>
                        <b>{st.full_name}</b>
                      </div>
                    </td>
                    <td>
                      <Badge variant="blue">{st.role}</Badge>
                    </td>
                    <td className="num">{st.courses_assigned}</td>
                    <td className="num">{st.sessions_created}</td>
                  </tr>
                ))}
                {filteredPerf.length === 0 && (
                  <tr>
                    <td colSpan="4">
                      <EmptyState icon="chart" title="No staff found" />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {showCourseModal && (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowCourseModal(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="course-modal-title" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <div>
                <h2 id="course-modal-title">{editingCourse ? 'Edit course' : 'Add new course'}</h2>
                <p>Courses are visible to doctors and students in the selected term.</p>
              </div>
              <button type="button" className="modal__close" aria-label="Close" onClick={() => setShowCourseModal(false)}>
                <Icon name="x" size={18} />
              </button>
            </div>
            <form onSubmit={saveCourse}>
              <div className="modal__body">
                <Input
                  label="Course code"
                  placeholder="CS-301"
                  value={courseForm.course_code}
                  onChange={(e) => setCourseForm({ ...courseForm, course_code: e.target.value })}
                  required
                />
                <Input
                  label="Course name"
                  placeholder="Database Systems"
                  value={courseForm.course_name}
                  onChange={(e) => setCourseForm({ ...courseForm, course_name: e.target.value })}
                  required
                />
                <div className="form-grid">
                  <Select
                    label="Academic year"
                    value={courseForm.academic_year}
                    onChange={(e) => setCourseForm({ ...courseForm, academic_year: e.target.value })}
                  >
                    <option value="1">Year 1</option>
                    <option value="2">Year 2</option>
                    <option value="3">Year 3</option>
                    <option value="4">Year 4</option>
                  </Select>
                  <Select
                    label="Term"
                    value={courseForm.term}
                    onChange={(e) => setCourseForm({ ...courseForm, term: e.target.value })}
                  >
                    <option value="1">1st Term</option>
                    <option value="2">2nd Term</option>
                  </Select>
                </div>
              </div>
              <div className="modal__foot">
                <Button variant="secondary" onClick={() => setShowCourseModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" icon="check">
                  Save course
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAssignModal && assigningToCourse && (
        <div className="modal-backdrop" role="presentation" onClick={() => setShowAssignModal(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="assign-modal-title" onClick={(e) => e.stopPropagation()}>
            <div className="modal__head">
              <div>
                <h2 id="assign-modal-title">Assign staff</h2>
                <p>
                  Course: <b>{assigningToCourse.course_code}</b> — {assigningToCourse.course_name}
                </p>
              </div>
              <button type="button" className="modal__close" aria-label="Close" onClick={() => setShowAssignModal(false)}>
                <Icon name="x" size={18} />
              </button>
            </div>
            <form onSubmit={saveAssignment}>
              <div className="modal__body">
                <Select
                  label="Role in course"
                  value={assignForm.role_in_course}
                  onChange={(e) => setAssignForm({ ...assignForm, role_in_course: e.target.value, staff_id: '' })}
                >
                  <option value="doctor">Doctor</option>
                  <option value="engineer">Engineer</option>
                </Select>
                <Select
                  label="Staff member"
                  value={assignForm.staff_id}
                  onChange={(e) => setAssignForm({ ...assignForm, staff_id: e.target.value })}
                  required
                >
                  <option value="">Choose a staff member…</option>
                  {assignForm.role_in_course === 'doctor'
                    ? doctors.map((d) => (
                        <option key={d.id} value={d.id}>
                          Dr. {d.full_name}
                        </option>
                      ))
                    : engineers.map((en) => (
                        <option key={en.id} value={en.id}>
                          Eng. {en.full_name}
                        </option>
                      ))}
                </Select>
              </div>
              <div className="modal__foot">
                <Button variant="secondary" onClick={() => setShowAssignModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" icon="user-plus">
                  Assign
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
