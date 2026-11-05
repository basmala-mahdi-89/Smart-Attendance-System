import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import DashboardLayout from '../components/layout/DashboardLayout';
import Button from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import { Badge, EmptyState, Loader, StatCard } from '../components/ui/Feedback';
import { AnimatedNumber } from '../components/ui/Motion';
import { useLanguage } from '../context/LanguageContext';

const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'ST';

export default function PendingStudents() {
  const { user, logout } = useAuth();
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadPending = async () => {
      try {
        const { data } = await client.get('/head/students/pending');
        if (mounted) setStudents(data);
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadPending();

    return () => {
      mounted = false;
    };
  }, []);

  const approveStudent = async (studentId) => {
    setActionLoading(studentId);
    try {
      await client.post(`/head/students/${studentId}/approve`);
      setStudents((prev) => prev.filter((s) => s.id !== studentId));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  };

  const rejectStudent = async (studentId) => {
    setActionLoading(studentId);
    try {
      await client.post(`/head/students/${studentId}/reject`);
      setStudents((prev) => prev.filter((s) => s.id !== studentId));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject');
    } finally {
      setActionLoading(null);
    }
  };

  const acceptAll = async () => {
    setActionLoading('all');
    try {
      const { data } = await client.post('/head/students/pending/accept-all');
      const approvedIds = new Set((data.approved || []).map((a) => a.id));
      const count = approvedIds.size;
      setStudents((prev) => prev.filter((s) => !approvedIds.has(s.id)));
      alert(lang === 'ar' ? `تم قبول ${count} طالباً` : `Accepted ${count} student(s) successfully`);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to accept all');
    } finally {
      setActionLoading(null);
    }
  };

  const nav = [
    { key: 'overview', label: 'Head Overview', icon: 'home', to: '/head', section: 'Department' },
    { key: 'pending', label: 'Pending Students', icon: 'user-plus', count: students.length },
    { key: 'doctor', label: 'Live Sessions', icon: 'play', to: '/doctor' },
    { key: 'reports', label: 'Attendance Reports', icon: 'chart', to: '/doctor/reports' },
    { key: 'signout', label: 'Sign out', icon: 'logout', onClick: logout, section: 'Account' },
  ];

  if (loading) {
    return (
      <DashboardLayout
        user={user}
        role="head"
        nav={nav}
        activeKey="pending"
        title={{ en: 'Pending students', ar: 'الطلاب المنتظرون' }}
        crumb={{ en: 'Head · Students', ar: 'رئيس القسم · الطلاب' }}
        onLogout={logout}
      >
        <Loader label={lang === 'ar' ? 'جارٍ تحميل التسجيلات المعلقة…' : 'Loading pending registrations…'} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      user={user}
      role="head"
      nav={nav}
      activeKey="pending"
      title={{ en: 'Pending students', ar: 'الطلاب المنتظرون' }}
      crumb={{ en: 'Head · Students', ar: 'رئيس القسم · الطلاب' }}
      onLogout={logout}
      actions={
        <Button variant="secondary" size="sm" icon="arrow-left" onClick={() => navigate('/head')}>
          {lang === 'ar' ? 'رجوع' : 'Back to head'}
        </Button>
      }
    >
      <div className="page-head">
        <div className="page-head__text">
          <h1>{lang === 'ar' ? 'موافقات التسجيل' : 'Registration approvals'}</h1>
          <p>{lang === 'ar' ? 'راجع حسابات الطلاب قبل أن يتمكنوا من تسجيل الدخول ومسح الحضور.' : 'Review student accounts before they can sign in and scan attendance.'}</p>
        </div>
        <div className="page-head__actions">
          {students.length > 0 && (
            <Button
              variant="success"
              size="sm"
              icon="check"
              onClick={acceptAll}
              loading={actionLoading === 'all'}
              disabled={actionLoading === 'all'}
            >
              {lang === 'ar' ? 'قبول الكل' : 'Accept All'}
            </Button>
          )}
          <Badge variant={students.length ? 'warning' : 'success'} dot>
            {students.length
              ? lang === 'ar'
                ? `${students.length} بانتظار المراجعة`
                : `${students.length} awaiting review`
              : lang === 'ar'
                ? 'كل شيء مُراجَع'
                : 'All caught up'}
          </Badge>
        </div>
      </div>

      <div className="kpi-grid stagger" style={{ marginBottom: 20 }}>
        <StatCard
          icon="user-plus"
          label={lang === 'ar' ? 'الطلبات المعلقة' : 'Pending requests'}
          value={<AnimatedNumber value={students.length} />}
          meta={lang === 'ar' ? 'بانتظار قرارك' : 'Waiting for your decision'}
          tone={students.length ? 'warn' : 'olive'}
        />
        <StatCard
          icon="shield-check"
          label={lang === 'ar' ? 'التحقق' : 'Verification'}
          value={lang === 'ar' ? 'يدوي' : 'Manual'}
          meta={lang === 'ar' ? 'البطاقة الوطنية + السنة الدراسية' : 'National ID + academic year'}
          tone="blue"
        />
      </div>

      {students.length === 0 ? (
        <div className="card">
          <div className="card__body">
            <EmptyState
              icon="check-circle"
              title={lang === 'ar' ? 'لا يوجد طلاب منتظرون' : 'No pending students'}
              description={lang === 'ar' ? 'تمت مراجعة كل التسجيلات. الطلبات الجديدة ستظهر هنا تلقائياً.' : 'Every registration has been reviewed. New requests will appear here automatically.'}
              action={
                <Button variant="secondary" icon="users" onClick={() => navigate('/head')}>
                  {lang === 'ar' ? 'رجوع إلى نظرة عامة على القسم' : 'Back to head overview'}
                </Button>
              }
            />
          </div>
        </div>
      ) : (
        <div className="course-grid">
          {students.map((s) => (
            <article key={s.id} className="course-card">
              <div className="course-card__top">
                <div className="person">
                  <span className="avatar avatar--lg avatar--light">{initials(lang === 'ar' && s.full_name_ar ? s.full_name_ar : s.full_name)}</span>
                  <div className="person__meta">
                    <b>{lang === 'ar' && s.full_name_ar ? s.full_name_ar : s.full_name}</b>
                    <span>{lang === 'ar' ? `السنة ${s.academic_year}` : `Year ${s.academic_year}`}</span>
                  </div>
                </div>
                <Badge variant="warning" dot>
                  {s.status}
                </Badge>
              </div>

              <div className="stack" style={{ gap: 7 }}>
                <div className="row" style={{ gap: 8, fontSize: '0.8rem' }}>
                  <Icon name="id-card" size={15} />
                  <span className="muted-cell">{lang === 'ar' ? 'البطاقة الوطنية' : 'National ID'}</span>
                  <span className="mono" style={{ marginLeft: 'auto', fontWeight: 700 }}>
                    {s.national_id}
                  </span>
                </div>
                <div className="row" style={{ gap: 8, fontSize: '0.8rem' }}>
                  <Icon name="mail" size={15} />
                  <span className="muted-cell">{lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}</span>
                  <span style={{ marginLeft: 'auto', fontWeight: 600 }}>{s.email}</span>
                </div>
                <div className="row" style={{ gap: 8, fontSize: '0.8rem' }}>
                  <Icon name="smartphone" size={15} />
                  <span className="muted-cell">{lang === 'ar' ? 'رقم الهاتف' : 'Phone'}</span>
                  <span style={{ marginLeft: 'auto', fontWeight: 600 }}>{s.phone}</span>
                </div>
              </div>

              <div className="course-card__actions">
                <Button
                  variant="success"
                  size="sm"
                  icon="check"
                  loading={actionLoading === s.id}
                  disabled={actionLoading === s.id}
                  onClick={() => approveStudent(s.id)}
                >
                  {lang === 'ar' ? 'قبول' : 'Approve'}
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  icon="x"
                  disabled={actionLoading === s.id}
                  onClick={() => rejectStudent(s.id)}
                >
                  {lang === 'ar' ? 'رفض' : 'Reject'}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
