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
import { useLanguage } from '../context/LanguageContext';

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
  const { lang } = useLanguage();
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
  const [courseSearch, setCourseSearch] = useState('');

  const [courseStudents, setCourseStudents] = useState([]);
  const [showCourseStudents, setShowCourseStudents] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);

  const [sessionAttendees, setSessionAttendees] = useState([]);
  const [showSessionAttendees, setShowSessionAttendees] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);

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
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'doctor' });
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
      const [coursesRes, staffRes, overviewRes, majorRes, studentsRes] = await Promise.all([
        client.get('/head/courses'),
        client.get('/head/staff'),
        client.get('/head/major/overview'),
        client.get('/head/major/info'),
        client.get('/head/students'),
      ]);
      setCourses(coursesRes.data);
      setStaff(staffRes.data);
      setOverview(overviewRes.data);
      setMajorInfo(majorRes.data);
      setAllStudents(Array.isArray(studentsRes.data) ? studentsRes.data : []);
      loadStaffPerf();
      loadActiveSessions();
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
      alert(
        lang === 'ar'
          ? `تم تحديث الفصل إلى الفصل ${newTerm}. سيشاهد جميع الدكاترة والطلاب الآن مقررات الفصل ${newTerm}.`
          : `Active term updated to Term ${newTerm}. All doctors and students will now see Term ${newTerm} courses.`
      );
    } catch (err) {
      alert(lang === 'ar' ? 'فشل تحديث الفصل' : 'Failed to update term');
    }
  };

  // ============================
  // Course management
  // ============================
  const openCourseStudents = async (course) => {
    setSelectedCourse(course);
    setShowCourseStudents(true);
    setCourseStudents([]);
    try {
      const { data } = await client.get(`/head/courses/${course.id}/students`);
      setCourseStudents(data);
    } catch (err) {
      console.error(err);
    }
  };

  const openSessionAttendees = async (session) => {
    setSelectedSession(session);
    setShowSessionAttendees(true);
    setSessionAttendees([]);
    try {
      const { data } = await client.get(`/head/sessions/${session.id}/attendance`);
      setSessionAttendees(data);
    } catch (err) {
      console.error(err);
    }
  };

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
      alert(err.response?.data?.message || (lang === 'ar' ? 'فشل حفظ المقرر' : 'Failed to save course'));
    }
  };

  const deleteCourse = async (courseId) => {
    if (!window.confirm(lang === 'ar' ? 'هل أنت متأكد من حذف هذا المقرر؟' : 'Are you sure you want to delete this course?')) return;
    try {
      await client.delete(`/head/courses/${courseId}`);
      loadData();
      alert(lang === 'ar' ? 'تم حذف المقرر بنجاح' : 'Course deleted successfully');
    } catch (err) {
      const d = err.response?.data;
      if (d?.details) {
        alert(
          lang === 'ar'
            ? `${d.message}\nالتسجيلات: ${d.details.enrollments}، الجلسات: ${d.details.sessions}، الحضور: ${d.details.attendance}`
            : `${d.message}\nEnrollments: ${d.details.enrollments}, Sessions: ${d.details.sessions}, Attendance: ${d.details.attendance}`
        );
      } else {
        alert(d?.message || (lang === 'ar' ? 'فشل حذف المقرر' : 'Failed to delete course'));
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
      alert(err.response?.data?.message || (lang === 'ar' ? 'فشل تعيين الموظف' : 'Failed to assign staff'));
    }
  };

  const removeStaff = async (courseId, assignmentId) => {
    if (!window.confirm(lang === 'ar' ? 'إزالة هذا الموظف من المقرر؟' : 'Remove this staff member from the course?')) return;
    try {
      await client.delete(`/head/courses/${courseId}/staff/${assignmentId}`);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || (lang === 'ar' ? 'فشل إزالة الموظف' : 'Failed to remove staff'));
    }
  };

  // ============================
  // Invitations & students
  // ============================
  const sendInvite = async (e) => {
    e.preventDefault();
    setInviteStatus('');
    if (!inviteForm.email.trim()) {
      setInviteStatus(lang === 'ar' ? 'البريد الإلكتروني مطلوب' : 'Email is required');
      return;
    }
    try {
      await client.post('/invitations', { email: inviteForm.email, role: inviteForm.role, major_id: inviteForm.major_id });
      setInviteStatus(lang === 'ar' ? `✅ تم إرسال الدعوة إلى ${inviteForm.email}!` : `✅ Invitation sent to ${inviteForm.email}!`);
      setInviteForm({ full_name: '', email: '', national_id: '', role: 'doctor' });
      loadData();
      if (activeTab === 'invitations') loadPendingInvites();
    } catch (err) {
      setInviteStatus(`❌ ${err.response?.data?.message || (lang === 'ar' ? 'فشل إرسال الدعوة' : 'Failed to send invitation')}`);
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
    if (!window.confirm(lang === 'ar' ? 'هل تريد إلغاء هذه الدعوة؟' : 'Cancel this invitation?')) return;
    try {
      await client.delete(`/head/invitations/${id}`);
      loadPendingInvites();
      alert(lang === 'ar' ? 'تم إلغاء الدعوة بنجاح' : 'Invitation cancelled successfully');
    } catch (err) {
      alert(err.response?.data?.message || (lang === 'ar' ? 'فشل إلغاء الدعوة' : 'Failed to cancel invitation'));
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
    if (!window.confirm(lang === 'ar' ? `هل تريد ${action === 'block' ? 'حظر' : 'إلغاء حظر'} هذا الطالب؟` : `Are you sure you want to ${action} this student?`)) return;
    try {
      await client.put(`/head/students/${studentId}/status`, { status });
      loadAllStudents();
      alert(lang === 'ar' ? `تم ${action === 'block' ? 'حظر' : 'إلغاء حظر'} الطالب بنجاح` : `Student ${action}ed successfully`);
    } catch (err) {
      alert(err.response?.data?.message || (lang === 'ar' ? 'فشل الإجراء' : 'Action failed'));
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
      return alert(lang === 'ar' ? 'الموضوع والرسالة مطلوبان' : 'Subject and message are required');
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
      alert(err.response?.data?.message || (lang === 'ar' ? 'فشل إرسال التحذير' : 'Failed to send warning'));
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
    if (!window.confirm(lang === 'ar' ? 'هل أنت متأكد من إغلاق هذه الجلسة؟' : 'Are you sure you want to close this session?')) return;
    try {
      await client.post(`/head/sessions/${id}/close`);
      loadActiveSessions();
      alert(lang === 'ar' ? 'تم إغلاق الجلسة بنجاح' : 'Session closed successfully');
    } catch (err) {
      alert(err.response?.data?.message || (lang === 'ar' ? 'فشل إغلاق الجلسة' : 'Failed to close session'));
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
    if (!matchYear || !matchTerm) return false;
    if (!courseSearch) return true;
    const q = courseSearch.toLowerCase();
    return (c.course_code || '').toLowerCase().includes(q) || (c.course_name || '').toLowerCase().includes(q);
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
        title={{ en: 'Head workspace', ar: 'مساحة رئيس القسم' }}
        crumb={{ en: 'Head of Department', ar: 'رئيس القسم' }}
        term={termLabel}
        onLogout={logout}
      >
        <Loader label={lang === 'ar' ? 'جارٍ تحميل بيانات القسم…' : 'Loading department data…'} />
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
        title={{ en: 'Head workspace', ar: 'مساحة رئيس القسم' }}
        crumb={{ en: 'Head of Department', ar: 'رئيس القسم' }}
        onLogout={logout}
      >
        <Alert variant="error">{lang === 'ar' ? 'فشل تحميل بيانات القسم. يرجى تحديث الصفحة.' : 'Failed to load department data. Please refresh the page.'}</Alert>
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
        overview: { en: 'Department overview', ar: 'نظرة عامة على القسم' },
        courses: { en: 'Manage courses', ar: 'إدارة المقررات' },
        invite: { en: 'Invite staff', ar: 'مقترح موظف' },
        invitations: { en: 'Pending invitations', ar: 'الدعوات المعلقة' },
        students: { en: 'All students', ar: 'جميع الطلاب' },
        risk: { en: 'High risk students', ar: 'طلاب عاليو الخطورة' },
        warning: { en: 'Send warning', ar: 'إرسال تحذير' },
        sessions: { en: 'Active sessions', ar: 'الجلسات النشطة' },
        performance: { en: 'Staff performance', ar: 'أداء الموظفين' },
      }[activeTab]?.[lang] || { en: 'Head workspace', ar: 'مساحة رئيس القسم' }[lang]}
      crumb={{ en: 'Head of Department', ar: 'رئيس القسم' }}
      term={termLabel}
      onLogout={logout}
      actions={
        <>
          <div style={{ minWidth: 132 }}>
            <Select
              aria-label={lang === 'ar' ? 'الفصل الدراسي النشط' : 'Active term'}
              icon="calendar"
              value={currentTerm}
              onChange={handleTermChange}
            >
              <option value="1">{lang === 'ar' ? 'الفصل الأول' : '1st Term'}</option>
              <option value="2">{lang === 'ar' ? 'الفصل الثاني' : '2nd Term'}</option>
            </Select>
          </div>
          <Button variant="secondary" size="sm" icon="play" onClick={() => navigate('/doctor')}>
            {lang === 'ar' ? 'عرض الدكتور' : 'Doctor view'}
          </Button>
        </>
      }
    >
      {activeTab === 'overview' && (
        <div className="stack">
          <section className="hero anim-up">
            <span className="hero__eyebrow">
              <Icon name="building" size={14} /> {overview.major?.name || (lang === 'ar' ? 'القسم' : 'Department')}
            </span>
            <h2>{termLabel} {lang === 'ar' ? 'قيد التقدم.' : 'is in progress.'}</h2>
            <p>
              {lang === 'ar'
                ? 'أدر المقررات ومهام الموظفين وحسابات الطلاب والجلسات المباشرة من مركز تحكم واحد.'
                : 'Manage courses, staff assignments, student accounts and live sessions from one control room.'}
            </p>
            <div className="hero__stats">
              <div className="hero__stat">
                <span>{lang === 'ar' ? 'الطلاب' : 'Students'}</span>
                <strong>
                  <AnimatedNumber value={overview.stats.total_students} />
                </strong>
              </div>
              <div className="hero__stat">
                <span>{lang === 'ar' ? 'المقررات' : 'Courses'}</span>
                <strong>
                  <AnimatedNumber value={overview.stats.total_courses} />
                </strong>
              </div>
              <div className="hero__stat">
                <span>{lang === 'ar' ? 'الجلسات' : 'Sessions'}</span>
                <strong>
                  <AnimatedNumber value={overview.stats.total_sessions} />
                </strong>
              </div>
              <div className="hero__stat">
                <span>{lang === 'ar' ? 'الموظفون' : 'Staff'}</span>
                <strong>
                  <AnimatedNumber value={staff.length} />
                </strong>
              </div>
            </div>
          </section>

          <div className="kpi-grid stagger">
            <StatCard
              icon="users"
              label={lang === 'ar' ? 'الطلاب' : 'Students'}
              value={<AnimatedNumber value={overview.stats.total_students} />}
              meta={lang === 'ar' ? 'نشطون في التخصص' : 'Active in major'}
              tone="navy"
            />
            <StatCard
              icon="book"
              label={lang === 'ar' ? 'المقررات' : 'Courses'}
              value={<AnimatedNumber value={overview.stats.total_courses} />}
              meta={lang === 'ar' ? 'في جميع الفصول' : 'Across all terms'}
              tone="blue"
            />
            <StatCard
              icon="calendar"
              label={lang === 'ar' ? 'الجلسات' : 'Sessions'}
              value={<AnimatedNumber value={overview.stats.total_sessions} />}
              meta={lang === 'ar' ? 'المسجلة حتى الآن' : 'Recorded so far'}
              tone="teal"
            />
            <StatCard
              icon="graduation-cap"
              label={lang === 'ar' ? 'الدكاترة' : 'Doctors'}
              value={<AnimatedNumber value={doctors.length} />}
              meta={lang === 'ar' ? `${engineers.length} مهندس` : `${engineers.length} engineers`}
              tone="olive"
            />
          </div>

          <div className="grid-2">
            <div className="card">
              <div className="data-bar">
                <div>
                  <h2>{lang === 'ar' ? 'إجراءات سريعة' : 'Quick actions'}</h2>
                  <p>{lang === 'ar' ? 'المهام الأكثر شيوعاً في القسم.' : 'The most common department tasks.'}</p>
                </div>
              </div>
              <div className="card__body grid-2" style={{ gap: 10 }}>
                <Button variant="secondary" icon="plus" onClick={() => { setActiveTab('courses'); openAddCourseModal(); }}>
                  {lang === 'ar' ? 'إضافة مقرر' : 'Add course'}
                </Button>
                <Button variant="secondary" icon="user-plus" onClick={() => setActiveTab('invite')}>
                  {lang === 'ar' ? 'مقترح موظف' : 'Invite staff'}
                </Button>
                <Button variant="secondary" icon="user-check" onClick={() => navigate('/head/pending-students')}>
                  {lang === 'ar' ? 'قبول الطلاب' : 'Approve students'}
                </Button>
                <Button variant="secondary" icon="send" onClick={() => setActiveTab('warning')}>
                  {lang === 'ar' ? 'إرسال تحذير' : 'Send warning'}
                </Button>
              </div>
            </div>

            <div className="card">
              <div className="data-bar">
                <div>
                  <h2>{lang === 'ar' ? 'الفصل الحالي' : 'Current term'}</h2>
                  <p>{lang === 'ar' ? 'تغيير الفصل يحدّث عروض الدكاترة والطلاب.' : 'Changing the term updates doctor and student views.'}</p>
                </div>
                <Badge variant="blue">{termLabel}</Badge>
              </div>
              <div className="card__body">
                <div className="stack" style={{ gap: 14 }}>
                  <div className="row" style={{ gap: 10 }}>
                    <Icon name="calendar" size={18} />
                    <span className="grow">{lang === 'ar' ? 'الفصل النشط' : 'Active term'}</span>
                    <b>{termLabel}</b>
                  </div>
                  <div className="row" style={{ gap: 10 }}>
                    <Icon name="book" size={18} />
                    <span className="grow">{lang === 'ar' ? 'المقررات هذا الفصل' : 'Courses this term'}</span>
                    <b>{courses.filter((c) => c.term === currentTerm).length}</b>
                  </div>
                  <div className="row" style={{ gap: 10 }}>
                    <Icon name="users" size={18} />
                    <span className="grow">{lang === 'ar' ? 'الدكاترة المكلفون' : 'Doctors assigned'}</span>
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
              <h2>{lang === 'ar' ? 'إدارة المقررات' : 'Manage courses'}</h2>
              <p>{filteredCourses.length} {lang === 'ar' ? 'مقرر يطابق الفلاتر' : 'course(s) match the filters.'}</p>
            </div>
            <div className="data-bar__actions">
              <Select aria-label={lang === 'ar' ? 'تصفية السنة' : 'Filter year'} value={filterCourseYear} onChange={(e) => setFilterCourseYear(e.target.value)}>
                <option value="all">{lang === 'ar' ? 'كل السنوات' : 'All years'}</option>
                <option value="1">{lang === 'ar' ? 'السنة 1' : 'Year 1'}</option>
                <option value="2">{lang === 'ar' ? 'السنة 2' : 'Year 2'}</option>
                <option value="3">{lang === 'ar' ? 'السنة 3' : 'Year 3'}</option>
                <option value="4">{lang === 'ar' ? 'السنة 4' : 'Year 4'}</option>
              </Select>
              <Select aria-label={lang === 'ar' ? 'تصفية الفصل' : 'Filter term'} value={filterCourseTerm} onChange={(e) => setFilterCourseTerm(e.target.value)}>
                <option value="all">{lang === 'ar' ? 'كل الفصول' : 'All terms'}</option>
                <option value="1">{lang === 'ar' ? 'الفصل الأول' : '1st Term'}</option>
                <option value="2">{lang === 'ar' ? 'الفصل الثاني' : '2nd Term'}</option>
              </Select>
              <input
                className="input"
                placeholder={lang === 'ar' ? 'ابحث في المقررات…' : 'Search courses...'}
                value={courseSearch}
                onChange={(e) => setCourseSearch(e.target.value)}
                style={{ maxWidth: 180 }}
              />
              <Button size="sm" icon="plus" onClick={openAddCourseModal}>
                {lang === 'ar' ? 'إضافة مقرر' : 'Add course'}
              </Button>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{lang === 'ar' ? 'الرمز' : 'Code'}</th>
                  <th>{lang === 'ar' ? 'الاسم' : 'Name'}</th>
                  <th>{lang === 'ar' ? 'السنة' : 'Year'}</th>
                  <th>{lang === 'ar' ? 'الفصل' : 'Term'}</th>
                  <th>{lang === 'ar' ? 'الطلاب' : 'Students'}</th>
                  <th>{lang === 'ar' ? 'الدكتور' : 'Doctor'}</th>
                  <th>{lang === 'ar' ? 'المهندسون' : 'Engineers'}</th>
                  <th>{lang === 'ar' ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredCourses.length === 0 ? (
                  <tr>
                    <td colSpan="8">
                      <EmptyState icon="book" title={lang === 'ar' ? 'لا توجد مقررات' : 'No courses found'} description={lang === 'ar' ? 'عدّل الفلاتر أو أضف مقرراً جديداً.' : 'Adjust the filters or add a new course.'} />
                    </td>
                  </tr>
                ) : (
                  filteredCourses.map((c) => {
                    const courseDoctor = c.staff?.find((s) => s.role_in_course === 'doctor');
                    const courseEngineers = c.staff?.filter((s) => s.role_in_course === 'engineer') || [];
                    const isCurrentTerm = c.term === currentTerm;
                    return (
                      <tr key={c.id} className={isCurrentTerm ? 'row-selected' : ''}>
                        <td>
                          <Badge variant="blue">{c.course_code}</Badge>
                        </td>
                        <td>{c.course_name}</td>
                        <td className="muted-cell nowrap">{lang === 'ar' ? `السنة ${c.academic_year}` : `Year ${c.academic_year}`}</td>
                        <td className="nowrap">
                          {c.term === '2' ? (lang === 'ar' ? 'الفصل الثاني' : '2nd Term') : lang === 'ar' ? 'الفصل الأول' : '1st Term'}
                          {isCurrentTerm && <Badge variant="success" className="badge--dot">{lang === 'ar' ? 'نشط' : 'Active'}</Badge>}
                        </td>
                        <td className="num">{c.students}</td>
                        <td>
                          {courseDoctor ? (
                            <div className="row" style={{ gap: 8 }}>
                              <div className="person__meta">
                                <b>د. {lang === 'ar' && courseDoctor.full_name_ar ? courseDoctor.full_name_ar : courseDoctor.full_name}</b>
                                {courseDoctor.is_primary && <span>{lang === 'ar' ? 'رئيسي' : 'Primary'}</span>}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                icon="trash"
                                aria-label={lang === 'ar' ? 'إزالة الدكتور' : 'Remove doctor'}
                                onClick={() => removeStaff(c.id, courseDoctor.assignment_id)}
                              />
                            </div>
                          ) : (
                            <Button variant="soft" size="sm" icon="plus" onClick={() => openAssignModal(c, 'doctor')}>
                              {lang === 'ar' ? 'تعيين دكتور' : 'Assign doctor'}
                            </Button>
                          )}
                        </td>
                        <td>
                          <div className="stack" style={{ gap: 6 }}>
                            {courseEngineers.map((eng) => (
                              <div key={eng.assignment_id} className="row" style={{ gap: 8 }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>م. {lang === 'ar' && eng.full_name_ar ? eng.full_name_ar : eng.full_name}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  icon="x"
                                  aria-label={lang === 'ar' ? 'إزالة المهندس' : 'Remove engineer'}
                                  onClick={() => removeStaff(c.id, eng.assignment_id)}
                                />
                              </div>
                            ))}
                            <Button variant="soft" size="sm" icon="plus" onClick={() => openAssignModal(c, 'engineer')}>
                              {lang === 'ar' ? 'تعيين مهندس' : 'Assign engineer'}
                            </Button>
                          </div>
                        </td>
                        <td>
                          <div className="row" style={{ gap: 6 }}>
                            <Button variant="soft" size="sm" icon="users" onClick={() => openCourseStudents(c)}>
                              {lang === 'ar' ? 'الطلاب' : 'Students'}
                            </Button>
                            <Button variant="secondary" size="sm" icon="edit" onClick={() => openEditCourseModal(c)}>
                              {lang === 'ar' ? 'تعديل' : 'Edit'}
                            </Button>
                            <Button variant="danger" size="sm" icon="trash" aria-label={lang === 'ar' ? 'حذف المقرر' : 'Delete course'} onClick={() => deleteCourse(c.id)} />
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
          <h2>{lang === 'ar' ? 'مقترح دكتور أو مهندس' : 'Invite a doctor or engineer'}</h2>
          <p>{lang === 'ar' ? 'سيستلمون رابط دعوة آمن لإنشاء حسابهم.' : 'They will receive a secure invitation link to create their account.'}</p>
          <form onSubmit={sendInvite} className="stack" style={{ gap: 16 }}>
            <Input
              label={lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}
              type="email"
              icon="mail"
              placeholder={lang === 'ar' ? 'name@university.edu' : 'name@university.edu'}
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              required
            />
            <Select
              label={lang === 'ar' ? 'الدور' : 'Role'}
              value={inviteForm.role}
              onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
            >
              <option value="doctor">{lang === 'ar' ? 'دكتور' : 'Doctor'}</option>
              <option value="engineer">{lang === 'ar' ? 'مهندس' : 'Engineer'}</option>
            </Select>
            <Button type="submit" icon="send" className="btn--block">
              {lang === 'ar' ? 'إرسال الدعوة' : 'Send invitation'}
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
              <h2>{lang === 'ar' ? 'الدعوات المعلقة' : 'Pending invitations'}</h2>
              <p>{filteredInvites.length} {lang === 'ar' ? 'دعوة بانتظار القبول' : 'invitation(s) waiting for acceptance.'}</p>
            </div>
            <div className="data-bar__actions">
              <Select aria-label={lang === 'ar' ? 'تصفية الدور' : 'Filter role'} value={filterInviteRole} onChange={(e) => setFilterInviteRole(e.target.value)}>
                <option value="all">{lang === 'ar' ? 'كل الأدوار' : 'All roles'}</option>
                <option value="doctor">{lang === 'ar' ? 'الدكاترة' : 'Doctors'}</option>
                <option value="engineer">{lang === 'ar' ? 'المهندسون' : 'Engineers'}</option>
              </Select>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{lang === 'ar' ? 'الاسم' : 'Name'}</th>
                  <th>{lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}</th>
                  <th>{lang === 'ar' ? 'الدور' : 'Role'}</th>
                  <th>{lang === 'ar' ? 'إجراء' : 'Action'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvites.map((inv) => (
                  <tr key={inv.id}>
                    <td className="strong">{(lang === 'ar' && inv.full_name_ar ? inv.full_name_ar : inv.full_name) || inv.email}</td>
                    <td className="muted-cell">{inv.email}</td>
                    <td>
                      <Badge variant="blue">{inv.role}</Badge>
                    </td>
                    <td>
                      <Button variant="ghost" size="sm" icon="x" onClick={() => cancelInvite(inv.id)}>
                        {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                      </Button>
                    </td>
                  </tr>
                ))}
                {filteredInvites.length === 0 && (
                  <tr>
                    <td colSpan="4">
                      <EmptyState icon="mail" title={lang === 'ar' ? 'لا توجد دعوات معلقة' : 'No pending invitations'} description={lang === 'ar' ? 'الدعوات الجديدة ستظهر هنا حتى يتم قبولها.' : 'New invitations will appear here until they are accepted.'} />
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
              <h2>{lang === 'ar' ? 'جميع الطلاب في تخصصك' : 'All students in your major'}</h2>
              <p>{filteredStudents.length} {lang === 'ar' ? 'طالب معروض' : 'student(s) shown.'}</p>
            </div>
            <div className="data-bar__actions">
              <Select aria-label={lang === 'ar' ? 'تصفية السنة' : 'Filter year'} value={filterStudentYear} onChange={(e) => setFilterStudentYear(e.target.value)}>
                <option value="all">{lang === 'ar' ? 'كل السنوات' : 'All years'}</option>
                <option value="1">{lang === 'ar' ? 'السنة 1' : 'Year 1'}</option>
                <option value="2">{lang === 'ar' ? 'السنة 2' : 'Year 2'}</option>
                <option value="3">{lang === 'ar' ? 'السنة 3' : 'Year 3'}</option>
                <option value="4">{lang === 'ar' ? 'السنة 4' : 'Year 4'}</option>
              </Select>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{lang === 'ar' ? 'الطالب' : 'Student'}</th>
                  <th>{lang === 'ar' ? 'البطاقة الوطنية' : 'National ID'}</th>
                  <th>{lang === 'ar' ? 'السنة' : 'Year'}</th>
                  <th>{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                  <th>{lang === 'ar' ? 'إجراء' : 'Action'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div className="person">
                        <span className="avatar" style={{ width: 32, height: 32, fontSize: '0.66rem' }}>
                          {initials(lang === 'ar' && s.full_name_ar ? s.full_name_ar : s.full_name)}
                        </span>
                        <b>{lang === 'ar' && s.full_name_ar ? s.full_name_ar : s.full_name}</b>
                      </div>
                    </td>
                    <td className="muted-cell mono">{s.national_id}</td>
                    <td className="nowrap">{lang === 'ar' ? `السنة ${s.academic_year}` : `Year ${s.academic_year}`}</td>
                    <td>
                      <Badge variant={statusVariant(s.status)} dot>
                        {s.status}
                      </Badge>
                    </td>
                    <td>
                      {s.status === 'active' && (
                        <Button variant="danger" size="sm" icon="user-x" onClick={() => toggleStudent(s.id, 'banned')}>
                          {lang === 'ar' ? 'حظر' : 'Block'}
                        </Button>
                      )}
                      {s.status === 'banned' && (
                        <Button variant="success" size="sm" icon="user-check" onClick={() => toggleStudent(s.id, 'active')}>
                          {lang === 'ar' ? 'إلغاء الحظر' : 'Unblock'}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredStudents.length === 0 && (
                  <tr>
                    <td colSpan="5">
                      <EmptyState icon="users" title={lang === 'ar' ? 'لا يوجد طلاب' : 'No students found'} />
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
              <h2>{lang === 'ar' ? 'طلاب عالي الخطورة' : 'High risk students'}</h2>
              <p>{lang === 'ar' ? 'الطلاب الذين حضورهم أقل من الحد المحدد.' : 'Students whose attendance is below the threshold.'}</p>
            </div>
            <div className="data-bar__actions">
              <div className="row" style={{ gap: 8 }}>
                <span className="muted" style={{ fontSize: '0.8rem', fontWeight: 600 }}>{lang === 'ar' ? 'أقل من' : 'Below'}</span>
                <Input
                  type="number"
                  aria-label={lang === 'ar' ? 'حد الخطورة' : 'Risk threshold'}
                  value={riskThreshold}
                  onChange={(e) => setRiskThreshold(e.target.value)}
                  style={{ width: 84 }}
                />
                <span className="muted" style={{ fontWeight: 700 }}>%</span>
                <Button variant="secondary" size="sm" icon="refresh" onClick={loadRiskStudents}>
                  {lang === 'ar' ? 'تطبيق' : 'Apply'}
                </Button>
              </div>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{lang === 'ar' ? 'الطالب' : 'Student'}</th>
                  <th>{lang === 'ar' ? 'السنة' : 'Year'}</th>
                  <th>{lang === 'ar' ? 'الحضور' : 'Attended'}</th>
                  <th style={{ minWidth: 170 }}>{lang === 'ar' ? 'نسبة الحضور' : 'Attendance'}</th>
                </tr>
              </thead>
              <tbody>
                {riskStudents.map((s) => (
                  <tr key={s.id}>
                    <td className="strong">{lang === 'ar' && s.full_name_ar ? s.full_name_ar : s.full_name}</td>
                    <td className="nowrap">{lang === 'ar' ? `السنة ${s.academic_year}` : `Year ${s.academic_year}`}</td>
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
                        title={lang === 'ar' ? 'لا يوجد طلاب تحت الحد المحدد' : 'No students below the threshold'}
                        description={lang === 'ar' ? 'عدّل النسبة واضغط تطبيق لإعادة الفحص.' : 'Adjust the percentage and apply to re-check.'}
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
          <h2>{lang === 'ar' ? 'إرسال تحذير للطلاب' : 'Send a warning to students'}</h2>
          <p>{lang === 'ar' ? 'يُسلَّم فوراً كإشعار داخل التطبيق.' : 'Delivered instantly as an in-app notification.'}</p>
          <form onSubmit={sendWarning} className="stack" style={{ gap: 16 }}>
            <Input
              label={lang === 'ar' ? 'الموضوع' : 'Subject'}
              icon="file-text"
              placeholder={lang === 'ar' ? 'تحذير حضور' : 'Attendance warning'}
              value={warningForm.subject}
              onChange={(e) => setWarningForm({ ...warningForm, subject: e.target.value })}
            />
            <div className="form-grid">
              <Select
                label={lang === 'ar' ? 'نوع التحذير' : 'Warning type'}
                value={warningForm.warning_type}
                onChange={(e) => setWarningForm({ ...warningForm, warning_type: e.target.value })}
              >
                <option value="general">{lang === 'ar' ? 'عام' : 'General'}</option>
                <option value="academic">{lang === 'ar' ? 'أكاديمي' : 'Academic'}</option>
                <option value="disciplinary">{lang === 'ar' ? 'سلوكي' : 'Disciplinary'}</option>
              </Select>
              <Select
                label={lang === 'ar' ? 'الهدف' : 'Target'}
                value={warningForm.target}
                onChange={(e) => setWarningForm({ ...warningForm, target: e.target.value })}
              >
                <option value="all">{lang === 'ar' ? 'جميع الطلاب في التخصص' : 'All students in major'}</option>
                <option value="year">{lang === 'ar' ? 'حسب السنة' : 'By year'}</option>
              </Select>
            </div>
            {warningForm.target === 'year' && (
              <Select
                label={lang === 'ar' ? 'السنة الدراسية' : 'Academic year'}
                value={warningForm.academic_year}
                onChange={(e) => setWarningForm({ ...warningForm, academic_year: e.target.value })}
              >
                <option value="">{lang === 'ar' ? 'اختر سنة' : 'Select year'}</option>
                <option value="1">{lang === 'ar' ? 'السنة 1' : 'Year 1'}</option>
                <option value="2">{lang === 'ar' ? 'السنة 2' : 'Year 2'}</option>
                <option value="3">{lang === 'ar' ? 'السنة 3' : 'Year 3'}</option>
                <option value="4">{lang === 'ar' ? 'السنة 4' : 'Year 4'}</option>
              </Select>
            )}
            <Textarea
              label={lang === 'ar' ? 'الرسالة' : 'Message'}
              placeholder={lang === 'ar' ? 'اكتب رسالة التحذير…' : 'Write the warning message…'}
              value={warningForm.message}
              onChange={(e) => setWarningForm({ ...warningForm, message: e.target.value })}
            />
            <Button type="submit" variant="accent" icon="send" style={{ alignSelf: 'flex-start' }}>
              {lang === 'ar' ? 'إرسال التحذير' : 'Send warning'}
            </Button>
          </form>
        </section>
      )}

      {activeTab === 'sessions' && (
        <div className="card">
          <div className="data-bar">
            <div>
              <h2>{lang === 'ar' ? 'الجلسات النشطة' : 'Active sessions'}</h2>
              <p>{filteredSessions.length} {lang === 'ar' ? 'جلسة تعمل حالياً' : 'session(s) currently running.'}</p>
            </div>
            <div className="data-bar__actions">
              <Select aria-label={lang === 'ar' ? 'تصفية السنة' : 'Filter year'} value={filterSessionYear} onChange={(e) => setFilterSessionYear(e.target.value)}>
                <option value="all">{lang === 'ar' ? 'كل السنوات' : 'All years'}</option>
                <option value="1">{lang === 'ar' ? 'السنة 1' : 'Year 1'}</option>
                <option value="2">{lang === 'ar' ? 'السنة 2' : 'Year 2'}</option>
                <option value="3">{lang === 'ar' ? 'السنة 3' : 'Year 3'}</option>
                <option value="4">{lang === 'ar' ? 'السنة 4' : 'Year 4'}</option>
              </Select>
              <Button variant="secondary" size="sm" icon="refresh" onClick={loadActiveSessions}>
                {lang === 'ar' ? 'تحديث' : 'Refresh'}
              </Button>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{lang === 'ar' ? 'المقرر' : 'Course'}</th>
                  <th>{lang === 'ar' ? 'أنشأه' : 'Created by'}</th>
                  <th>{lang === 'ar' ? 'وقت البدء' : 'Start time'}</th>
                  <th>{lang === 'ar' ? 'إجراء' : 'Action'}</th>
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
                      <div className="row" style={{ gap: 6 }}>
                        <Button variant="soft" size="sm" icon="users" onClick={() => openSessionAttendees(s)}>
                          {lang === 'ar' ? 'الحضور' : 'Attendees'}
                        </Button>
                        <Button variant="danger" size="sm" icon="stop" onClick={() => closeSession(s.id)}>
                          {lang === 'ar' ? 'إغلاق الجلسة' : 'Close session'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredSessions.length === 0 && (
                  <tr>
                    <td colSpan="4">
                      <EmptyState icon="activity" title={lang === 'ar' ? 'لا توجد جلسات نشطة' : 'No active sessions'} description={lang === 'ar' ? 'عندما يبدأ الدكتور جلسة ستظهر هنا.' : 'When a doctor starts a session it will appear here.'} />
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
              <h2>{lang === 'ar' ? 'أداء الموظفين' : 'Staff performance'}</h2>
              <p>{filteredPerf.length} {lang === 'ar' ? 'موظف' : 'staff member(s).'}</p>
            </div>
            <div className="data-bar__actions">
              <Select aria-label={lang === 'ar' ? 'تصفية الدور' : 'Filter role'} value={filterPerfRole} onChange={(e) => setFilterPerfRole(e.target.value)}>
                <option value="all">{lang === 'ar' ? 'كل الأدوار' : 'All roles'}</option>
                <option value="doctor">{lang === 'ar' ? 'الدكاترة' : 'Doctors'}</option>
                <option value="engineer">{lang === 'ar' ? 'المهندسون' : 'Engineers'}</option>
                <option value="head">{lang === 'ar' ? 'العمداء' : 'Heads'}</option>
              </Select>
              <Button variant="secondary" size="sm" icon="refresh" onClick={loadStaffPerf}>
                {lang === 'ar' ? 'تحديث' : 'Refresh'}
              </Button>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{lang === 'ar' ? 'الموظف' : 'Staff'}</th>
                  <th>{lang === 'ar' ? 'الدور' : 'Role'}</th>
                  <th>{lang === 'ar' ? 'المقررات' : 'Courses'}</th>
                  <th>{lang === 'ar' ? 'الجلسات المنشأة' : 'Sessions created'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredPerf.map((st) => (
                  <tr key={st.id}>
                    <td>
                      <div className="person">
                        <span className="avatar" style={{ width: 32, height: 32, fontSize: '0.66rem' }}>
                          {initials(lang === 'ar' && st.full_name_ar ? st.full_name_ar : st.full_name)}
                        </span>
                        <b>{lang === 'ar' && st.full_name_ar ? st.full_name_ar : st.full_name}</b>
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
                      <EmptyState icon="chart" title={lang === 'ar' ? 'لا يوجد موظفين' : 'No staff found'} />
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
                <h2 id="course-modal-title">{editingCourse ? (lang === 'ar' ? 'تعديل المقرر' : 'Edit course') : lang === 'ar' ? 'إضافة مقرر جديد' : 'Add new course'}</h2>
                <p>{lang === 'ar' ? 'المقررات مرئية للدكاترة والطلاب في الفصل المحدد.' : 'Courses are visible to doctors and students in the selected term.'}</p>
              </div>
              <button type="button" className="modal__close" aria-label={lang === 'ar' ? 'إغلاق' : 'Close'} onClick={() => setShowCourseModal(false)}>
                <Icon name="x" size={18} />
              </button>
            </div>
            <form onSubmit={saveCourse}>
              <div className="modal__body">
                <Input
                  label={lang === 'ar' ? 'رمز المقرر' : 'Course code'}
                  placeholder="CS-301"
                  value={courseForm.course_code}
                  onChange={(e) => setCourseForm({ ...courseForm, course_code: e.target.value })}
                  required
                />
                <Input
                  label={lang === 'ar' ? 'اسم المقرر' : 'Course name'}
                  placeholder={lang === 'ar' ? 'أنظمة قواعد البيانات' : 'Database Systems'}
                  value={courseForm.course_name}
                  onChange={(e) => setCourseForm({ ...courseForm, course_name: e.target.value })}
                  required
                />
                <div className="form-grid">
                  <Select
                    label={lang === 'ar' ? 'السنة الدراسية' : 'Academic year'}
                    value={courseForm.academic_year}
                    onChange={(e) => setCourseForm({ ...courseForm, academic_year: e.target.value })}
                  >
                    <option value="1">{lang === 'ar' ? 'السنة 1' : 'Year 1'}</option>
                    <option value="2">{lang === 'ar' ? 'السنة 2' : 'Year 2'}</option>
                    <option value="3">{lang === 'ar' ? 'السنة 3' : 'Year 3'}</option>
                    <option value="4">{lang === 'ar' ? 'السنة 4' : 'Year 4'}</option>
                  </Select>
                  <Select
                    label={lang === 'ar' ? 'الفصل' : 'Term'}
                    value={courseForm.term}
                    onChange={(e) => setCourseForm({ ...courseForm, term: e.target.value })}
                  >
                    <option value="1">{lang === 'ar' ? 'الفصل الأول' : '1st Term'}</option>
                    <option value="2">{lang === 'ar' ? 'الفصل الثاني' : '2nd Term'}</option>
                  </Select>
                </div>
              </div>
              <div className="modal__foot">
                <Button variant="secondary" onClick={() => setShowCourseModal(false)}>
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button type="submit" icon="check">
                  {lang === 'ar' ? 'حفظ المقرر' : 'Save course'}
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
                <h2 id="assign-modal-title">{lang === 'ar' ? 'تعيين موظف' : 'Assign staff'}</h2>
                <p>
                  Course: <b>{assigningToCourse.course_code}</b> — {assigningToCourse.course_name}
                </p>
              </div>
              <button type="button" className="modal__close" aria-label={lang === 'ar' ? 'إغلاق' : 'Close'} onClick={() => setShowAssignModal(false)}>
                <Icon name="x" size={18} />
              </button>
            </div>
            <form onSubmit={saveAssignment}>
              <div className="modal__body">
                <Select
                  label={lang === 'ar' ? 'الدور في المقرر' : 'Role in course'}
                  value={assignForm.role_in_course}
                  onChange={(e) => setAssignForm({ ...assignForm, role_in_course: e.target.value, staff_id: '' })}
                >
                  <option value="doctor">{lang === 'ar' ? 'دكتور' : 'Doctor'}</option>
                  <option value="engineer">{lang === 'ar' ? 'مهندس' : 'Engineer'}</option>
                </Select>
                <Select
                  label={lang === 'ar' ? 'الموظف' : 'Staff member'}
                  value={assignForm.staff_id}
                  onChange={(e) => setAssignForm({ ...assignForm, staff_id: e.target.value })}
                  required
                >
                  <option value="">{lang === 'ar' ? 'اختر موظفاً…' : 'Choose a staff member…'}</option>
                  {assignForm.role_in_course === 'doctor'
                    ? doctors.map((d) => (
                        <option key={d.id} value={d.id}>
                          د. {lang === 'ar' && d.full_name_ar ? d.full_name_ar : d.full_name}
                        </option>
                      ))
                    : engineers.map((en) => (
                        <option key={en.id} value={en.id}>
                          م. {lang === 'ar' && en.full_name_ar ? en.full_name_ar : en.full_name}
                        </option>
                      ))}
                </Select>
              </div>
              <div className="modal__foot">
                <Button variant="secondary" onClick={() => setShowAssignModal(false)}>
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </Button>
                <Button type="submit" icon="user-plus">
                  {lang === 'ar' ? 'تعيين' : 'Assign'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCourseStudents && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#fff', overflow: 'auto', padding: 24 }} onClick={() => setShowCourseStudents(false)}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }} onClick={(e) => e.stopPropagation()}>
            <h2>{lang === 'ar' ? `الطلاب المسجلون — ${selectedCourse?.course_code}` : `Enrolled students — ${selectedCourse?.course_code}`}</h2>
            {courseStudents.length === 0 ? (
              <p className="muted">{lang === 'ar' ? 'لا يوجد طلاب مسجلون.' : 'No students enrolled.'}</p>
            ) : (
              <ul className="stack" style={{ gap: 6, maxHeight: 500, overflow: 'auto', minWidth: 320 }}>
                {courseStudents.map((s) => (
                  <li key={s.id} className="row" style={{ justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
                    <div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{lang === 'ar' && s.full_name_ar ? s.full_name_ar : s.full_name}</div>
                      <div className="muted-cell" style={{ fontSize: '0.9rem' }}>{lang === 'ar' ? `السنة ${s.academic_year}` : `Year ${s.academic_year}`} · {s.national_id}</div>
                    </div>
                    <span className="muted-cell">{s.status}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
              <Button variant="secondary" onClick={() => setShowCourseStudents(false)}>{lang === 'ar' ? 'إغلاق' : 'Close'}</Button>
            </div>
          </div>
        </div>
      )}

      {showSessionAttendees && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#fff', overflow: 'auto', padding: 24 }} onClick={() => setShowSessionAttendees(false)}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }} onClick={(e) => e.stopPropagation()}>
            <h2>{lang === 'ar' ? `الحضور — ${selectedSession?.course_name || `الجلسة ${selectedSession?.id}`}` : `Attendees — ${selectedSession?.course_name || `Session ${selectedSession?.id}`}`}</h2>
            {sessionAttendees.length === 0 ? (
              <p className="muted">{lang === 'ar' ? 'لا يوجد حضور مسجل.' : 'No attendance recorded.'}</p>
            ) : (
              <ul className="stack" style={{ gap: 6, maxHeight: 500, overflow: 'auto', minWidth: 320 }}>
                {sessionAttendees.map((a) => (
                  <li key={a.id} className="row" style={{ justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
                    <div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{lang === 'ar' && a.full_name_ar ? a.full_name_ar : a.full_name}</div>
                      <div className="muted-cell" style={{ fontSize: '0.9rem' }}>
                        {a.major_name || ''} · {lang === 'ar' ? `السنة ${a.academic_year || ''}` : `Year ${a.academic_year || ''}`} · {a.national_id || ''}
                      </div>
                    </div>
                    <span className="muted-cell">{a.method} · {a.created_at ? new Date(a.created_at).toLocaleTimeString() : ''}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
              <Button variant="secondary" onClick={() => setShowSessionAttendees(false)}>{lang === 'ar' ? 'إغلاق' : 'Close'}</Button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
