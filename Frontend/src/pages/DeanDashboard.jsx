import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import DashboardLayout from '../components/layout/DashboardLayout';
import Button from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import { Input, Select, Textarea } from '../components/ui/Field';
import { Alert, Badge, EmptyState, Loader, StatCard } from '../components/ui/Feedback';
import { AnimatedNumber, ProgressBar } from '../components/ui/Motion';
import { useLanguage } from '../context/LanguageContext';

const statusVariant = (status) =>
  status === 'active' ? 'success' : status === 'pending' ? 'warning' : 'danger';

const roleIcon = (role) =>
  role === 'head' ? 'building' : role === 'doctor' ? 'graduation-cap' : 'settings';

export default function DeanDashboard() {
  const { user, logout } = useAuth();
  const { lang } = useLanguage();
  const [activeTab, setActiveTab] = useState('overview');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const [selectedMajor, setSelectedMajor] = useState('all');
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [filterRole, setFilterRole] = useState('all');

  const [staffQuery, setStaffQuery] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [staffPage, setStaffPage] = useState(1);
  const [studentPage, setStudentPage] = useState(1);
  const PAGE_SIZE = 10;

  const [toast, setToast] = useState(null);
  const exportCSV = () => {
    const rows = [['Major', 'Attendance Rate']];
    filteredAttendanceOverview.forEach((a) => rows.push([a.major_name, a.attendance_rate]));
    const csv = rows.map((r) => r.join(',')).join('\\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'attendance-overview.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const notify = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const [invitations, setInvitations] = useState([]);

  const [majors, setMajors] = useState([]);
  const [majorForm, setMajorForm] = useState({ name: '' });
  const [editingMajor, setEditingMajor] = useState(null);
  const [currentTerm, setCurrentTerm] = useState('1');

  const [inviteForm, setInviteForm] = useState({ email: '', role: 'head', major_id: '' });
  const [inviteStatus, setInviteStatus] = useState('');

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
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
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
      if (Array.isArray(majorsRes.data) && majorsRes.data.length > 0) {
        setCurrentTerm(majorsRes.data[0].current_term || '1');
      }
      setActiveSessions(Array.isArray(sessionsRes.data) ? sessionsRes.data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleUserAction = async (type, id, action) => {
    if (action === 'delete' && !window.confirm(lang === 'ar' ? 'هل أنت متأكد من الحذف النهائي لهذا المستخدم؟' : 'Are you sure you want to permanently delete this user?')) return;
    try {
      if (action === 'delete') {
        await client.delete(`/dean/users/${type}/${id}`);
      } else {
        const newStatus = action === 'block' ? 'banned' : 'active';
        await client.put(`/dean/users/${type}/${id}/status`, { status: newStatus });
      }
      loadData();
    } catch (err) {
      notify(err.response?.data?.message || (lang === 'ar' ? 'فشل الإجراء' : 'Action failed'));
    }
  };

  const cancelInvite = async (id) => {
    if (!window.confirm(lang === 'ar' ? 'هل تريد إلغاء هذه الدعوة؟' : 'Cancel this invitation?')) return;
    try {
      await client.delete(`/dean/invitations/${id}`);
      loadData();
    } catch (err) {
      notify(lang === 'ar' ? 'فشل الإلغاء' : 'Failed to cancel');
    }
  };

  const addMajor = async (e) => {
    e.preventDefault();
    if (!majorForm.name.trim()) return notify(lang === 'ar' ? 'اسم التخصص مطلوب' : 'Major name is required');
    try {
      await client.post('/dean/majors', { name: majorForm.name });
      setMajorForm({ name: '' });
      loadData();
      notify(lang === 'ar' ? 'تمت إضافة التخصص بنجاح' : 'Major added successfully');
    } catch (err) {
      notify(err.response?.data?.message || (lang === 'ar' ? 'فشل إضافة التخصص' : 'Failed to add major'));
    }
  };

  const updateMajor = async (e) => {
    if (e) e.preventDefault();
    if (!editingMajor || !editingMajor.name.trim()) return notify(lang === 'ar' ? 'اسم التخصص مطلوب' : 'Major name is required');
    try {
      await client.put(`/dean/majors/${editingMajor.id}`, { name: editingMajor.name });
      setEditingMajor(null);
      loadData();
      notify(lang === 'ar' ? 'تم تحديث التخصص بنجاح' : 'Major updated successfully');
    } catch (err) {
      notify(err.response?.data?.message || (lang === 'ar' ? 'فشل تحديث التخصص' : 'Failed to update major'));
    }
  };

  const handleTermChange = async (e) => {
    const newTerm = e.target.value;
    try {
      await client.put('/dean/current-term', { term: newTerm });
      setCurrentTerm(newTerm);
      loadData();
    } catch (err) {
      notify(lang === 'ar' ? 'فشل تحديث الفصل' : 'Failed to update term');
    }
  };

  const sendInvite = async (e) => {
    e.preventDefault();
    setInviteStatus('');
    if (!inviteForm.email.trim() || !inviteForm.major_id) {
      setInviteStatus(lang === 'ar' ? 'البريد الإلكتروني والتخصص مطلوبان' : 'Email and major are required');
      return;
    }
    try {
      await client.post('/invitations', { email: inviteForm.email, role: 'head', major_id: inviteForm.major_id });
      setInviteStatus(lang === 'ar' ? `✅ تم إرسال الدعوة إلى ${inviteForm.email}!` : `✅ Invitation sent to ${inviteForm.email}!`);
      setInviteForm({ full_name: '', email: '', national_id: '', role: 'head', major_id: '' });
      loadData();
    } catch (err) {
      setInviteStatus(err.response?.data?.message || (lang === 'ar' ? 'فشل إرسال الدعوة' : 'Failed to send invitation'));
    }
  };

  const deleteMajor = async (id) => {
    if (!window.confirm(lang === 'ar' ? 'هل أنت متأكد من حذف هذا التخصص؟' : 'Are you sure you want to delete this major?')) return;
    try {
      await client.delete(`/dean/majors/${id}`);
      loadData();
      notify(lang === 'ar' ? 'تم حذف التخصص بنجاح' : 'Major deleted successfully');
    } catch (err) {
      const d = err.response?.data;
      if (d?.details) {
        notify(
          lang === 'ar'
            ? `${d.message}\nالطلاب: ${d.details.students}، المقررات: ${d.details.courses}، الموظفون: ${d.details.staff}`
            : `${d.message}\nStudents: ${d.details.students}, Courses: ${d.details.courses}, Staff: ${d.details.staff}`
        );
      } else {
        notify(d?.message || (lang === 'ar' ? 'فشل حذف التخصص' : 'Failed to delete major'));
      }
    }
  };

  const sendBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastForm.subject.trim() || !broadcastForm.message.trim()) {
      return notify(lang === 'ar' ? 'الموضوع والرسالة مطلوبان' : 'Subject and message are required');
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
      notify(res.data.message);
      setBroadcastForm({ subject: '', message: '', warning_type: 'general', major_id: '', academic_year: '', target: 'all' });
    } catch (err) {
      notify(err.response?.data?.message || (lang === 'ar' ? 'فشل إرسال الشامل' : 'Failed to send broadcast'));
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
    if (!window.confirm(lang === 'ar' ? 'هل تريد إغلاق هذه الجلسة قسرياً؟' : 'Are you sure you want to force close this session?')) return;
    try {
      await client.post(`/dean/sessions/${id}/force-close`);
      loadActiveSessions();
      loadData();
      notify(lang === 'ar' ? 'تم إغلاق الجلسة قسرياً بنجاح' : 'Session force-closed successfully');
    } catch (err) {
      notify(err.response?.data?.message || (lang === 'ar' ? 'فشل إغلاق الجلسة' : 'Failed to close session'));
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
    ['overview', 'majors', 'invite', 'broadcast', 'invitations', 'staff', 'students', 'reports', 'sessions', 'analytics', 'audit'].includes(item.key)
      ? { ...item, onClick: () => goTo(item.key) }
      : item
  );

  const toastEl = toast ? (
    <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999, padding: '10px 16px', background: toast.type === 'success' ? '#16a34a' : '#dc2626', color: '#fff', borderRadius: 8 }}>
      {toast.msg}
    </div>
  ) : null;

  if (loading) {
    return (
      <>
        {toastEl}
        <DashboardLayout
        user={user}
        role="dean"
        nav={nav}
        activeKey={activeTab}
        title={{ en: 'Dean console', ar: 'لوحة العميد' }}
        crumb={{ en: 'Dean', ar: 'العميد' }}
        onLogout={logout}
      >
        <Loader label={lang === 'ar' ? 'جارٍ تحميل بيانات المؤسسة…' : 'Loading institution data…'} />
      </DashboardLayout>
      </>
    );
  }

  if (!data) {
    return (
      <DashboardLayout
        user={user}
        role="dean"
        nav={nav}
        activeKey={activeTab}
        title={{ en: 'Dean console', ar: 'لوحة العميد' }}
        crumb={{ en: 'Dean', ar: 'العميد' }}
        onLogout={logout}
      >
        <Alert variant="error">{lang === 'ar' ? 'فشل تحميل البيانات. يرجى تحديث الصفحة.' : 'Failed to load data. Please refresh the page.'}</Alert>
      </DashboardLayout>
    );
  }

  const matchMajor = (name) => selectedMajor === 'all' || name === selectedMajor;
  const matchYear = (year) => selectedGrade === 'all' || String(year) === String(selectedGrade);
  const matchRole = (role) => filterRole === 'all' || role === filterRole;

  const filteredStudents = (data.students || []).filter((s) => {
    if (!matchMajor(s.major_name) || !matchYear(s.academic_year)) return false;
    if (!studentQuery) return true;
    const q = studentQuery.toLowerCase();
    return (s.full_name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q) || String(s.id).includes(q);
  });
  const filteredStaff = (data.staff || []).filter((s) => {
    if (!matchMajor(s.major_name) || !matchRole(s.role)) return false;
    if (!staffQuery) return true;
    const q = staffQuery.toLowerCase();
    return (s.full_name || '').toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q) || (s.role || '').toLowerCase().includes(q);
  });
  const filteredInvitations = invitations.filter((inv) => matchMajor(inv.major_name) && matchRole(inv.role));
  const filteredCourses = (data.courses || []).filter((c) => matchMajor(c.major_name) && matchYear(c.academic_year));
  const filteredSessions = activeSessions.filter((s) => matchMajor(s.major_name) && matchYear(s.academic_year));
  const filteredAttendanceOverview = attendanceOverview.filter((a) => matchMajor(a.major_name));
  const filteredHighRisk = highRiskStudents.filter((s) => matchMajor(s.major_name) && matchYear(s.academic_year));

  const pagedStaff = filteredStaff.slice((staffPage - 1) * PAGE_SIZE, staffPage * PAGE_SIZE);
  const pagedStudents = filteredStudents.slice((studentPage - 1) * PAGE_SIZE, studentPage * PAGE_SIZE);
  const staffPages = Math.max(1, Math.ceil(filteredStaff.length / PAGE_SIZE));
  const studentPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));
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
    overview: { en: 'Institution overview', ar: 'نظرة عامة على المؤسسة' },
    invitations: { en: 'Pending invitations', ar: 'الدعوات المعلقة' },
    staff: { en: 'Manage staff', ar: 'إدارة الموظفين' },
    students: { en: 'Manage students', ar: 'إدارة الطلاب' },
    majors: { en: 'Majors', ar: 'التخصصات' },
    broadcast: { en: 'Broadcast warning', ar: 'تحذير شامل' },
    invite: { en: 'Invite a head', ar: 'دعوة عميد قسم' },
    reports: { en: 'Institution reports', ar: 'تقارير المؤسسة' },
    sessions: { en: 'Live sessions', ar: 'الجلسات المباشرة' },
    analytics: { en: 'Analytics', ar: 'التحليلات' },
    audit: { en: 'Audit logs', ar: 'سجلات التدقيق' },
  };

  const overallAttendance =
    filteredAttendanceOverview.length > 0
      ? Math.round(
          filteredAttendanceOverview.reduce((sum, a) => sum + Number(a.attendance_rate || 0), 0) /
            filteredAttendanceOverview.length
        )
      : null;

  return (
    <>
      {toastEl}
      <DashboardLayout
      user={user}
      role="dean"
      nav={nav}
      activeKey={activeTab}
      title={titles[activeTab] || { en: 'Dean console', ar: 'لوحة العميد' }}
      crumb={{ en: 'Dean', ar: 'العميد' }}
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
          <Badge variant="neutral">{majors.length} {lang === 'ar' ? 'تخصص' : 'major(s)'}</Badge>
          <span className="chip chip--live">
            <span className="dot-pulse" /> {filteredStats.active_sessions} {lang === 'ar' ? 'مباشر' : 'live'}
          </span>
        </>
      }
    >
      {showFilters && (
        <div className="toolbar" style={{ marginBottom: 20 }}>
          <Select aria-label={lang === 'ar' ? 'تصفية التخصص' : 'Filter major'} icon="building" value={selectedMajor} onChange={(e) => setSelectedMajor(e.target.value)}>
            <option value="all">{lang === 'ar' ? 'كل التخصصات' : 'All majors'}</option>
            {(data.majorsList || []).map((m) => (
              <option key={m.id} value={m.name}>
                {m.name}
              </option>
            ))}
          </Select>
          {showYearFilter && (
            <Select aria-label={lang === 'ar' ? 'تصفية السنة' : 'Filter year'} icon="graduation-cap" value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)}>
              <option value="all">{lang === 'ar' ? 'كل السنوات' : 'All years'}</option>
              <option value="1">{lang === 'ar' ? 'السنة 1' : 'Year 1'}</option>
              <option value="2">{lang === 'ar' ? 'السنة 2' : 'Year 2'}</option>
              <option value="3">{lang === 'ar' ? 'السنة 3' : 'Year 3'}</option>
              <option value="4">{lang === 'ar' ? 'السنة 4' : 'Year 4'}</option>
            </Select>
          )}
          {showRoleFilter && (
            <Select aria-label={lang === 'ar' ? 'تصفية الدور' : 'Filter role'} icon="users" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
              <option value="all">{lang === 'ar' ? 'كل الأدوار' : 'All roles'}</option>
              <option value="head">{lang === 'ar' ? 'العمداء' : 'Heads'}</option>
              <option value="doctor">{lang === 'ar' ? 'الدكاترة' : 'Doctors'}</option>
              <option value="engineer">{lang === 'ar' ? 'المهندسون' : 'Engineers'}</option>
            </Select>
          )}
        </div>
      )}

      {activeTab === 'overview' && (
        <div className="stack">
          <section className="hero anim-up">
            <span className="hero__eyebrow">
              <Icon name="shield-check" size={14} /> {lang === 'ar' ? 'لوحة العميد · على مستوى المؤسسة' : 'Dean console · institution-wide'}
            </span>
            <h2>{lang === 'ar' ? `مرحباً، ${user?.full_name_ar?.split(' ')[0] || user?.full_name?.split(' ')[0] || 'العميد'}.` : `Good day, ${user?.full_name?.split(' ')[0] || 'Dean'}.`}</h2>
            <p>
              {lang === 'ar'
                ? 'راقب كل تخصص، وحافظ على سلامة حسابات الموظفين، وتدخّل فوراً عند الحاجة لجلسات مباشرة.'
                : 'Monitor every major, keep staff accounts healthy and step in the moment a session needs your attention.'}
            </p>
            <div className="hero__stats">
              <div className="hero__stat">
                <span>{lang === 'ar' ? 'الطلاب' : 'Students'}</span>
                <strong>
                  <AnimatedNumber value={filteredStats.total_students} />
                </strong>
              </div>
              <div className="hero__stat">
                <span>{lang === 'ar' ? 'المقررات' : 'Courses'}</span>
                <strong>
                  <AnimatedNumber value={filteredStats.total_courses} />
                </strong>
              </div>
              <div className="hero__stat">
                <span>{lang === 'ar' ? 'جلسات مباشرة' : 'Live sessions'}</span>
                <strong>
                  <AnimatedNumber value={filteredStats.active_sessions} />
                </strong>
              </div>
              <div className="hero__stat">
                <span>{lang === 'ar' ? 'الحضور' : 'Attendance'}</span>
                <strong>{overallAttendance !== null ? `${overallAttendance}%` : '—'}</strong>
              </div>
            </div>
          </section>

          <div className="kpi-grid stagger">
            <StatCard
              icon="graduation-cap"
              label={lang === 'ar' ? 'الطلاب' : 'Students'}
              value={<AnimatedNumber value={filteredStats.total_students} />}
              meta={lang === 'ar' ? 'في جميع التخصصات' : 'Across all majors'}
              tone="navy"
            />
            <StatCard
              icon="book"
              label={lang === 'ar' ? 'المقررات' : 'Courses'}
              value={<AnimatedNumber value={filteredStats.total_courses} />}
              meta={lang === 'ar' ? 'كل الفصول' : 'All terms'}
              tone="blue"
            />
            <StatCard
              icon="user-check"
              label={lang === 'ar' ? 'الدكاترة' : 'Doctors'}
              value={<AnimatedNumber value={filteredStats.total_doctors} />}
              meta={lang === 'ar' ? `${filteredStats.total_engineers} مهندس` : `${filteredStats.total_engineers} engineers`}
              tone="teal"
            />
            <StatCard
              icon="building"
              label={lang === 'ar' ? 'التخصصات' : 'Majors'}
              value={<AnimatedNumber value={majors.length} />}
              meta={lang === 'ar' ? 'هيكل المؤسسة' : 'Institution structure'}
              tone="olive"
            />
            <StatCard
              icon="activity"
              label={lang === 'ar' ? 'جلسات نشطة' : 'Active sessions'}
              value={<AnimatedNumber value={filteredStats.active_sessions} />}
              meta={lang === 'ar' ? 'تعمل الآن' : 'Running right now'}
              tone={filteredStats.active_sessions > 0 ? 'warn' : 'default'}
            />
          </div>

          <div className="grid-2">
            <div className="card">
              <div className="data-bar">
                <div>
                  <h2>{lang === 'ar' ? 'إجراءات سريعة' : 'Quick actions'}</h2>
                  <p>{lang === 'ar' ? 'المهام الأكثر استخداماً لدى العمداء.' : 'The tasks deans reach for most.'}</p>
                </div>
              </div>
              <div className="card__body grid-2" style={{ gap: 10 }}>
                <Button variant="secondary" icon="plus" onClick={() => goTo('majors')}>
                  {lang === 'ar' ? 'إدارة التخصصات' : 'Manage majors'}
                </Button>
                <Button variant="secondary" icon="user-plus" onClick={() => goTo('invitations')}>
                  {lang === 'ar' ? 'الدعوات' : 'Invitations'}
                </Button>
                <Button variant="secondary" icon="chart" onClick={() => goTo('reports')}>
                  {lang === 'ar' ? 'تقارير المؤسسة' : 'Institution reports'}
                </Button>
                <Button variant="secondary" icon="send" onClick={() => goTo('broadcast')}>
                  {lang === 'ar' ? 'تحذير شامل' : 'Broadcast warning'}
                </Button>
              </div>
            </div>

            <div className="card">
              <div className="data-bar">
                <div>
                  <h2>{lang === 'ar' ? 'الجلسات المباشرة' : 'Live sessions'}</h2>
                  <p>{lang === 'ar' ? 'أغلق أي جلسة لا ينبغي أن تكون تعمل.' : 'Force-close anything that should not be running.'}</p>
                </div>
                <Button variant="soft" size="sm" icon="refresh" onClick={loadActiveSessions}>
                  {lang === 'ar' ? 'تحديث' : 'Refresh'}
                </Button>
              </div>
              <div className="card__body">
                {filteredSessions.length === 0 ? (
                  <EmptyState icon="activity" title={lang === 'ar' ? 'لا توجد جلسات نشطة' : 'No active sessions'} description={lang === 'ar' ? 'الجلسات التي يبدأها الدكاترة تظهر هنا.' : 'Sessions started by doctors appear here.'} />
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

      {activeTab === 'invite' && (
        <section className="form-card form-card--narrow">
          <h2>{lang === 'ar' ? 'دعوة عميد قسم' : 'Invite a head of department'}</h2>
          <p>{lang === 'ar' ? 'سيستلم رابط دعوة آمن لإنشاء حسابه.' : 'They will receive a secure invitation link to create their account.'}</p>
          <form onSubmit={sendInvite} className="stack" style={{ gap: 16 }}>
            <Input
              label={lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}
              type="email"
              icon="mail"
              placeholder="name@university.edu"
              value={inviteForm.email}
              onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
              required
            />
            <Select
              label={lang === 'ar' ? 'التخصص' : 'Major'}
              value={inviteForm.major_id}
              onChange={(e) => setInviteForm({ ...inviteForm, major_id: e.target.value })}
              required
            >
              <option value="">{lang === 'ar' ? 'اختر تخصصاً' : 'Select major'}</option>
              {majors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
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
              <p>{filteredInvitations.length} {lang === 'ar' ? 'دعوة بانتظار القبول' : 'invitation(s) waiting for acceptance.'}</p>
            </div>
            <Badge variant="warning">{filteredInvitations.length} {lang === 'ar' ? 'معلقة' : 'pending'}</Badge>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{lang === 'ar' ? 'الاسم' : 'Name'}</th>
                  <th>{lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}</th>
                  <th>{lang === 'ar' ? 'الدور' : 'Role'}</th>
                  <th>{lang === 'ar' ? 'التخصص' : 'Major'}</th>
                  <th>{lang === 'ar' ? 'إجراء' : 'Action'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvitations.map((inv) => (
                  <tr key={inv.id}>
                    <td className="strong">{(lang === 'ar' && inv.full_name_ar ? inv.full_name_ar : inv.full_name) || inv.email}</td>
                    <td className="muted-cell">{inv.email}</td>
                    <td>
                      <Badge variant="blue">{inv.role}</Badge>
                    </td>
                    <td className="muted-cell">{inv.major_name || '—'}</td>
                    <td>
                      <Button variant="ghost" size="sm" icon="x" onClick={() => cancelInvite(inv.id)}>
                        {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                      </Button>
                    </td>
                  </tr>
                ))}
                {filteredInvitations.length === 0 && (
                  <tr>
                    <td colSpan="5">
                      <EmptyState icon="mail" title={lang === 'ar' ? 'لا توجد دعوات معلقة' : 'No pending invitations'} description={lang === 'ar' ? 'الدعوات المرسلة حديثاً تظهر هنا.' : 'Newly sent invitations appear here.'} />
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
              <h2>{lang === 'ar' ? 'إدارة الموظفين' : 'Manage staff'}</h2>
              <p>{filteredStaff.length} {lang === 'ar' ? 'حساب موظف في هذا الاختيار' : 'staff account(s) in this selection.'}</p>
            </div>
            <Badge variant="blue">{filteredStaff.length} {lang === 'ar' ? 'موظف' : 'staff'}</Badge>
            <input
              className="input"
              placeholder={lang === 'ar' ? 'ابحث في الموظفين…' : 'Search staff...'}
              value={staffQuery}
              onChange={(e) => { setStaffQuery(e.target.value); setStaffPage(1); }}
              style={{ maxWidth: 200 }}
            />
            <Button variant="secondary" size="sm" icon="user-plus" onClick={() => setActiveTab('invite')}>
              {lang === 'ar' ? 'دعوة عميد' : 'Invite head'}
            </Button>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{lang === 'ar' ? 'الاسم' : 'Name'}</th>
                  <th>{lang === 'ar' ? 'الدور' : 'Role'}</th>
                  <th>{lang === 'ar' ? 'التخصص' : 'Major'}</th>
                  <th>{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                  <th>{lang === 'ar' ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {pagedStaff.map((s) => {
                  const currentStatus = s.status || 'active';
                  return (
                    <tr key={s.id}>
                      <td>
                        <div className="person">
                          <span className="avatar" style={{ width: 32, height: 32 }}>
                            <Icon name={roleIcon(s.role)} size={15} />
                          </span>
                          <b>{lang === 'ar' && s.full_name_ar ? s.full_name_ar : s.full_name}</b>
                        </div>
                      </td>
                      <td>
                        <Badge variant="blue">{s.role}</Badge>
                      </td>
                      <td className="muted-cell">{s.major_name || '—'}</td>
                      <td>
                        <Badge variant={statusVariant(currentStatus)} dot>
                          {currentStatus === 'active' ? (lang === 'ar' ? 'نشط' : 'active') : currentStatus === 'blocked' ? (lang === 'ar' ? 'محظور' : 'blocked') : currentStatus}
                        </Badge>
                      </td>
                      <td>
                        <div className="row" style={{ gap: 6 }}>
                          {currentStatus === 'active' ? (
                            <Button variant="soft" size="sm" icon="lock" onClick={() => handleUserAction('staff', s.id, 'block')}>
                              {lang === 'ar' ? 'حظر' : 'Block'}
                            </Button>
                          ) : (
                            <Button variant="success" size="sm" icon="check" onClick={() => handleUserAction('staff', s.id, 'unblock')}>
                              {lang === 'ar' ? 'إلغاء الحظر' : 'Unblock'}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            icon="trash"
                            aria-label={lang === 'ar' ? `حذف ${s.full_name_ar || s.full_name}` : `Delete ${s.full_name}`}
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
                      <EmptyState icon="users" title={lang === 'ar' ? 'لا يوجد موظفون' : 'No staff found'} description={lang === 'ar' ? 'عدّل الفلاتر بالأعلى.' : 'Adjust the filters above.'} />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="row" style={{ justifyContent: 'center', gap: 8, padding: 12 }}>
              <Button size="sm" variant="secondary" disabled={staffPage <= 1} onClick={() => setStaffPage((p) => p - 1)}>{lang === 'ar' ? 'السابق' : 'Prev'}</Button>
              <span>{staffPage} / {staffPages}</span>
              <Button size="sm" variant="secondary" disabled={staffPage >= staffPages} onClick={() => setStaffPage((p) => p + 1)}>{lang === 'ar' ? 'التالي' : 'Next'}</Button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'students' && (
        <div className="card">
          <div className="data-bar">
            <div>
              <h2>{lang === 'ar' ? 'إدارة الطلاب' : 'Manage students'}</h2>
              <p>{filteredStudents.length} {lang === 'ar' ? 'حساب طالب في هذا الاختيار' : 'student account(s) in this selection.'}</p>
            </div>
            <Badge variant="blue">{filteredStudents.length} {lang === 'ar' ? 'طالب' : 'students'}</Badge>
            <input
              className="input"
              placeholder={lang === 'ar' ? 'ابحث في الطلاب…' : 'Search students...'}
              value={studentQuery}
              onChange={(e) => { setStudentQuery(e.target.value); setStudentPage(1); }}
              style={{ maxWidth: 200 }}
            />
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{lang === 'ar' ? 'الاسم' : 'Name'}</th>
                  <th>{lang === 'ar' ? 'التخصص' : 'Major'}</th>
                  <th>{lang === 'ar' ? 'السنة' : 'Year'}</th>
                  <th>{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                  <th style={{ minWidth: 130 }}>{lang === 'ar' ? 'الحضور' : 'Attendance'}</th>
                  <th>{lang === 'ar' ? 'إجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {pagedStudents.map((s) => {
                  const pct = Number(s.percentage) || 0;
                  return (
                    <tr key={s.id}>
                      <td className="strong">{lang === 'ar' && s.full_name_ar ? s.full_name_ar : s.full_name}</td>
                      <td className="muted-cell">{s.major_name}</td>
                      <td className="nowrap">{lang === 'ar' ? `السنة ${s.academic_year}` : `Year ${s.academic_year}`}</td>
                      <td>
                        <Badge variant={statusVariant(s.status)} dot>
                          {s.status === 'active' ? (lang === 'ar' ? 'نشط' : 'active') : s.status === 'banned' ? (lang === 'ar' ? 'محظور' : 'banned') : s.status}
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
                              {lang === 'ar' ? 'حظر' : 'Block'}
                            </Button>
                          )}
                          {s.status === 'banned' && (
                            <Button variant="success" size="sm" icon="check" onClick={() => handleUserAction('student', s.id, 'unblock')}>
                              {lang === 'ar' ? 'إلغاء الحظر' : 'Unblock'}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            icon="trash"
                            aria-label={lang === 'ar' ? `حذف ${s.full_name_ar || s.full_name}` : `Delete ${s.full_name}`}
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
                      <EmptyState icon="graduation-cap" title={lang === 'ar' ? 'لا يوجد طلاب' : 'No students found'} description={lang === 'ar' ? 'عدّل الفلاتر بالأعلى.' : 'Adjust the filters above.'} />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="row" style={{ justifyContent: 'center', gap: 8, padding: 12 }}>
              <Button size="sm" variant="secondary" disabled={studentPage <= 1} onClick={() => setStudentPage((p) => p - 1)}>{lang === 'ar' ? 'السابق' : 'Prev'}</Button>
              <span>{studentPage} / {studentPages}</span>
              <Button size="sm" variant="secondary" disabled={studentPage >= studentPages} onClick={() => setStudentPage((p) => p + 1)}>{lang === 'ar' ? 'التالي' : 'Next'}</Button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'majors' && (
        <div className="stack">
          <section className="form-card form-card--narrow" style={{ maxWidth: '100%' }}>
            <h2>{lang === 'ar' ? 'إضافة تخصص' : 'Add a major'}</h2>
            <p>{lang === 'ar' ? 'يجمّع التخصص المقررات والموظفين والطلاب تحت عميد قسم.' : 'Majors group courses, staff and students under a head of department.'}</p>
            <form onSubmit={addMajor} className="toolbar" style={{ alignItems: 'flex-end' }}>
              <div className="grow" style={{ minWidth: 220 }}>
                <Input
                  label={lang === 'ar' ? 'اسم التخصص' : 'Major name'}
                  icon="building"
                  placeholder={lang === 'ar' ? 'علوم الحاسوب' : 'Computer Science'}
                  value={majorForm.name}
                  onChange={(e) => setMajorForm({ name: e.target.value })}
                />
              </div>
              <Button type="submit" icon="plus">
                {lang === 'ar' ? 'إضافة تخصص' : 'Add major'}
              </Button>
            </form>
          </section>

          <div className="card">
            <div className="data-bar">
              <div>
                <h2>{lang === 'ar' ? 'التخصصات' : 'Majors'}</h2>
                <p>{majors.length} {lang === 'ar' ? 'تخصص مُعد' : 'major(s) configured.'}</p>
              </div>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>{lang === 'ar' ? 'الاسم' : 'Name'}</th>
                    <th>{lang === 'ar' ? 'رئيس القسم' : 'Head of department'}</th>
                    <th>{lang === 'ar' ? 'إجراءات' : 'Actions'}</th>
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
                            aria-label={lang === 'ar' ? 'اسم التخصص' : 'Major name'}
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
                              {lang === 'ar' ? 'حفظ' : 'Save'}
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => setEditingMajor(null)}>
                              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
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
                              {lang === 'ar' ? 'تعديل' : 'Edit'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              icon="trash"
                              aria-label={lang === 'ar' ? `حذف ${m.name}` : `Delete ${m.name}`}
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
                        <EmptyState icon="building" title={lang === 'ar' ? 'لا توجد تخصصات بعد' : 'No majors yet'} description={lang === 'ar' ? 'أضف أول تخصص باستخدام النموذج بالأعلى.' : 'Add the first major using the form above.'} />
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
          <h2>{lang === 'ar' ? 'إرسال تحذير شامل' : 'Broadcast a warning'}</h2>
          <p>{lang === 'ar' ? 'يُسلَّم فوراً كإشعار داخل التطبيق للطلاب المحددين.' : 'Delivered instantly as an in-app notification to the selected students.'}</p>
          <form onSubmit={sendBroadcast} className="stack" style={{ gap: 16 }}>
            <Input
              label={lang === 'ar' ? 'الموضوع' : 'Subject'}
              icon="file-text"
              placeholder={lang === 'ar' ? 'تحذير حضور' : 'Attendance warning'}
              value={broadcastForm.subject}
              onChange={(e) => setBroadcastForm({ ...broadcastForm, subject: e.target.value })}
            />
            <div className="form-grid">
              <Select
                label={lang === 'ar' ? 'نوع التحذير' : 'Warning type'}
                value={broadcastForm.warning_type}
                onChange={(e) => setBroadcastForm({ ...broadcastForm, warning_type: e.target.value })}
              >
                <option value="general">{lang === 'ar' ? 'عام' : 'General'}</option>
                <option value="academic">{lang === 'ar' ? 'أكاديمي' : 'Academic'}</option>
                <option value="disciplinary">{lang === 'ar' ? 'سلوكي' : 'Disciplinary'}</option>
              </Select>
              <Select
                label={lang === 'ar' ? 'الهدف' : 'Target'}
                value={broadcastForm.target}
                onChange={(e) => setBroadcastForm({ ...broadcastForm, target: e.target.value })}
              >
                <option value="all">{lang === 'ar' ? 'جميع الطلاب النشطين' : 'All active students'}</option>
                <option value="major">{lang === 'ar' ? 'حسب التخصص' : 'By major'}</option>
                <option value="year">{lang === 'ar' ? 'حسب التخصص والسنة' : 'By major & year'}</option>
              </Select>
            </div>
            {(broadcastForm.target === 'major' || broadcastForm.target === 'year') && (
              <Select
                label={lang === 'ar' ? 'التخصص' : 'Major'}
                icon="building"
                value={broadcastForm.major_id}
                onChange={(e) => setBroadcastForm({ ...broadcastForm, major_id: e.target.value })}
              >
                <option value="">{lang === 'ar' ? 'اختر تخصصاً' : 'Select major'}</option>
                {majors.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            )}
            {broadcastForm.target === 'year' && (
              <Select
                label={lang === 'ar' ? 'السنة الدراسية' : 'Academic year'}
                icon="graduation-cap"
                value={broadcastForm.academic_year}
                onChange={(e) => setBroadcastForm({ ...broadcastForm, academic_year: e.target.value })}
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
              value={broadcastForm.message}
              onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
            />
            <Button type="submit" variant="accent" icon="send" style={{ alignSelf: 'flex-start' }}>
              {lang === 'ar' ? 'إرسال الشامل' : 'Send broadcast'}
            </Button>
          </form>
        </section>
      )}

      {activeTab === 'reports' && (
        <div className="stack">
          <div className="card">
            <div className="data-bar">
              <div>
                <h2>{lang === 'ar' ? 'نظرة عامة على الحضور حسب التخصص' : 'Attendance overview by major'}</h2>
                <p>{lang === 'ar' ? 'أداء كل تخصص هذا الفصل.' : 'How each major is performing this term.'}</p>
              </div>
              <Button variant="soft" size="sm" icon="refresh" onClick={loadAttendanceOverview}>
                {lang === 'ar' ? 'تحديث' : 'Refresh'}
              </Button>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{lang === 'ar' ? 'التخصص' : 'Major'}</th>
                    <th>{lang === 'ar' ? 'الطلاب' : 'Students'}</th>
                    <th>{lang === 'ar' ? 'المقررات' : 'Courses'}</th>
                    <th>{lang === 'ar' ? 'الجلسات المنفذة' : 'Sessions conducted'}</th>
                    <th style={{ minWidth: 160 }}>{lang === 'ar' ? 'نسبة الحضور' : 'Attendance rate'}</th>
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
                        <EmptyState icon="chart" title={lang === 'ar' ? 'لا توجد بيانات' : 'No overview data'} description={lang === 'ar' ? 'تظهر بيانات الحضور بعد تسجيل الجلسات.' : 'Attendance data appears once sessions are recorded.'} />
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
                <h2>{lang === 'ar' ? 'طلاب عالي الخطورة' : 'High risk students'}</h2>
                <p>{lang === 'ar' ? 'الطلاب الذين حضورهم أقل من الحد المحدد.' : 'Students whose attendance falls below the threshold.'}</p>
              </div>
              <div className="data-bar__actions">
                <span className="muted" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                  {lang === 'ar' ? 'أقل من' : 'Below'}
                </span>
                <input
                  className="input"
                  type="number"
                  aria-label={lang === 'ar' ? 'حد الخطورة العالية' : 'High risk threshold'}
                  style={{ width: 82 }}
                  value={highRiskThreshold}
                  onChange={(e) => setHighRiskThreshold(e.target.value)}
                />
                <span className="muted" style={{ fontWeight: 700 }}>
                  %
                </span>
                <Button variant="secondary" size="sm" icon="refresh" onClick={loadHighRiskStudents}>
                  {lang === 'ar' ? 'تطبيق' : 'Apply'}
                </Button>
              </div>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{lang === 'ar' ? 'الاسم' : 'Name'}</th>
                    <th>{lang === 'ar' ? 'التخصص' : 'Major'}</th>
                    <th>{lang === 'ar' ? 'السنة' : 'Year'}</th>
                    <th>{lang === 'ar' ? 'الإجمالي' : 'Total'}</th>
                    <th>{lang === 'ar' ? 'الحضور' : 'Attended'}</th>
                    <th style={{ minWidth: 140 }}>{lang === 'ar' ? 'نسبة الحضور' : 'Attendance'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHighRisk.map((s) => {
                    const pct = Number(s.attendance_percentage) || 0;
                    return (
                      <tr key={s.id}>
                        <td className="strong">{lang === 'ar' && s.full_name_ar ? s.full_name_ar : s.full_name}</td>
                        <td className="muted-cell">{s.major_name}</td>
                        <td className="nowrap">{lang === 'ar' ? `السنة ${s.academic_year}` : `Year ${s.academic_year}`}</td>
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
                        <EmptyState icon="shield-check" title={lang === 'ar' ? 'لا يوجد طلاب تحت الحد المحدد' : 'No students below the threshold'} description={lang === 'ar' ? 'الجميع أعلى الحد الحالي.' : 'Everyone is above the current limit.'} />
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
                <h2>{lang === 'ar' ? 'نشاط الموظفين' : 'Staff activity'}</h2>
                <p>{lang === 'ar' ? 'من فتح الجلسات وكيف كان الحضور.' : 'Who opened sessions and how they were attended.'}</p>
              </div>
              <Button variant="soft" size="sm" icon="refresh" onClick={loadStaffActivity}>
                {lang === 'ar' ? 'تحديث' : 'Refresh'}
              </Button>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{lang === 'ar' ? 'الموظف' : 'Staff'}</th>
                    <th>{lang === 'ar' ? 'الدور' : 'Role'}</th>
                    <th>{lang === 'ar' ? 'التخصص' : 'Major'}</th>
                    <th>{lang === 'ar' ? 'المقررات' : 'Courses'}</th>
                    <th>{lang === 'ar' ? 'الجلسات' : 'Sessions'}</th>
                    <th>{lang === 'ar' ? 'المكتملة' : 'Completed'}</th>
                    <th>{lang === 'ar' ? 'النشطة' : 'Active'}</th>
                    <th>{lang === 'ar' ? 'المتوسط / جلسة' : 'Avg / session'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaffActivity.map((st) => (
                    <tr key={st.id}>
                      <td className="strong">{lang === 'ar' && st.full_name_ar ? st.full_name_ar : st.full_name}</td>
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
                        <EmptyState icon="users" title={lang === 'ar' ? 'لا يوجد نشاط موظفين' : 'No staff activity'} description={lang === 'ar' ? 'يظهر النشاط بعد أول جلسة.' : 'Activity appears after the first session.'} />
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
              <h2>{lang === 'ar' ? 'الجلسات المباشرة النشطة' : 'Live active sessions'}</h2>
              <p>{filteredSessions.length} {lang === 'ar' ? 'جلسة تعمل في المؤسسة' : 'session(s) running across the institution.'}</p>
            </div>
            <Button variant="secondary" size="sm" icon="refresh" onClick={loadActiveSessions}>
              {lang === 'ar' ? 'تحديث' : 'Refresh'}
            </Button>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{lang === 'ar' ? 'المقرر' : 'Course'}</th>
                  <th>{lang === 'ar' ? 'التخصص' : 'Major'}</th>
                  <th>{lang === 'ar' ? 'السنة' : 'Year'}</th>
                  <th>{lang === 'ar' ? 'أنشأه' : 'Created by'}</th>
                  <th>{lang === 'ar' ? 'الدور' : 'Role'}</th>
                  <th>{lang === 'ar' ? 'الحضور' : 'Attendance'}</th>
                  <th>{lang === 'ar' ? 'البدء' : 'Started'}</th>
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
                    <td className="muted-cell">{s.major_name}</td>
                    <td className="nowrap">{lang === 'ar' ? `السنة ${s.academic_year}` : `Year ${s.academic_year}`}</td>
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
                        {lang === 'ar' ? 'إغلاق قسري' : 'Force close'}
                      </Button>
                    </td>
                  </tr>
                ))}
                {filteredSessions.length === 0 && (
                  <tr>
                    <td colSpan="8">
                      <EmptyState icon="activity" title={lang === 'ar' ? 'لا توجد جلسات نشطة' : 'No active sessions'} description={lang === 'ar' ? 'كل شيء متوقف الآن.' : 'Everything is idle right now.'} />
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
            <Loader label={lang === 'ar' ? 'جارٍ بناء التحليلات…' : 'Building analytics…'} />
          ) : (
            <>
              <div className="card">
                <div className="data-bar">
                  <div>
                    <h2>{lang === 'ar' ? 'اتجاه الحضور · آخر 14 يوماً' : 'Attendance trend · last 14 days'}</h2>
                    <p>{lang === 'ar' ? 'الجلسات المفتوحة وسجلات الحضور المنشأة.' : 'Sessions opened and attendance records created.'}</p>
                  </div>
                  <Button variant="soft" size="sm" icon="refresh" onClick={loadAnalytics}>
                    {lang === 'ar' ? 'تحديث' : 'Refresh'}
                  </Button>
                </div>
                <div className="table-wrap">
                  <table className="table table--compact">
                    <thead>
                      <tr>
                        <th>{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                        <th>{lang === 'ar' ? 'الجلسات' : 'Sessions'}</th>
                        <th>{lang === 'ar' ? 'سجلات الحضور' : 'Attendance records'}</th>
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
                    <h2>{lang === 'ar' ? 'الطلاب الأكثر غياباً' : 'Most absent students'}</h2>
                    <p>{lang === 'ar' ? 'أعلى نسب الغياب في المؤسسة.' : 'The highest absence percentages across the institution.'}</p>
                  </div>
                  <Badge variant="danger">{filteredMostAbsent.length} {lang === 'ar' ? 'طالب' : 'students'}</Badge>
                </div>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{lang === 'ar' ? 'الاسم' : 'Name'}</th>
                        <th>{lang === 'ar' ? 'التخصص' : 'Major'}</th>
                        <th>{lang === 'ar' ? 'السنة' : 'Year'}</th>
                        <th>{lang === 'ar' ? 'الإجمالي' : 'Total'}</th>
                        <th>{lang === 'ar' ? 'الحضور' : 'Attended'}</th>
                        <th>{lang === 'ar' ? 'الغياب' : 'Absent'}</th>
                        <th>{lang === 'ar' ? 'نسبة الغياب' : 'Absence'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMostAbsent.map((s) => (
                        <tr key={s.id}>
                          <td className="strong">{lang === 'ar' && s.full_name_ar ? s.full_name_ar : s.full_name}</td>
                          <td className="muted-cell">{s.major_name}</td>
                          <td className="nowrap">{lang === 'ar' ? `السنة ${s.academic_year}` : `Year ${s.academic_year}`}</td>
                          <td className="num">{s.total_sessions}</td>
                          <td className="num">{s.attended_sessions}</td>
                          <td className="num">{s.absent_count}</td>
                          <td className="percent percent--bad">{s.absence_percentage}%</td>
                        </tr>
                      ))}
                      {filteredMostAbsent.length === 0 && (
                        <tr>
                          <td colSpan="7">
                            <EmptyState icon="shield-check" title={lang === 'ar' ? 'لا توجد بيانات غياب' : 'No absence data'} description={lang === 'ar' ? 'جرّب تغيير الفلاتر.' : 'Try changing the filters.'} />
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
                    <h2>{lang === 'ar' ? 'إنجاز المقررات' : 'Course completion'}</h2>
                    <p>{lang === 'ar' ? 'متوسط الحضور لكل جلسة لكل مقرر.' : 'Average attendance per session for each course.'}</p>
                  </div>
                </div>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{lang === 'ar' ? 'المقرر' : 'Course'}</th>
                        <th>{lang === 'ar' ? 'التخصص' : 'Major'}</th>
                        <th>{lang === 'ar' ? 'السنة' : 'Year'}</th>
                        <th>{lang === 'ar' ? 'المسجلون' : 'Enrolled'}</th>
                        <th>{lang === 'ar' ? 'الجلسات المعقدة' : 'Sessions held'}</th>
                        <th>{lang === 'ar' ? 'متوسط الحضور' : 'Avg attendance'}</th>
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
                          <td className="nowrap">{lang === 'ar' ? `السنة ${c.academic_year}` : `Year ${c.academic_year}`}</td>
                          <td className="num">{c.enrolled_students}</td>
                          <td className="num">{c.total_sessions_held}</td>
                          <td className="num">{c.avg_attendance_per_session}</td>
                        </tr>
                      ))}
                      {filteredCourseCompletion.length === 0 && (
                        <tr>
                          <td colSpan="6">
                            <EmptyState icon="book" title={lang === 'ar' ? 'لا توجد بيانات مقررات' : 'No course data'} description={lang === 'ar' ? 'جرّب تغيير الفلاتر.' : 'Try changing the filters.'} />
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
              <h2>{lang === 'ar' ? 'سجلات التدقيق' : 'Audit logs'}</h2>
              <p>{lang === 'ar' ? 'الإجراءات الأمنية عبر المنصة.' : 'Security-relevant actions across the platform.'}</p>
            </div>
            <div className="data-bar__actions">
              <Badge variant="neutral">{auditTotal} {lang === 'ar' ? 'إجمالي' : 'total'}</Badge>
              <Button variant="secondary" size="sm" icon="refresh" onClick={loadAuditLogs}>
                {lang === 'ar' ? 'تحديث' : 'Refresh'}
              </Button>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table table--compact">
              <thead>
                <tr>
                  <th>{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                  <th>{lang === 'ar' ? 'المنفذ' : 'Actor'}</th>
                  <th>{lang === 'ar' ? 'الإجراء' : 'Action'}</th>
                  <th>{lang === 'ar' ? 'نوع الهدف' : 'Target type'}</th>
                  <th>{lang === 'ar' ? 'معرّف الهدف' : 'Target ID'}</th>
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
                      <EmptyState icon="shield" title={lang === 'ar' ? 'لا توجد سجلات تدقيق' : 'No audit logs'} description={lang === 'ar' ? 'تُسجَّل الإجراءات هنا عند وقوعها.' : 'Actions will be recorded here as they happen.'} />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardLayout>
    </>
  );
}
