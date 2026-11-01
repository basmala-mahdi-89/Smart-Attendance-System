import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import DashboardLayout from '../components/layout/DashboardLayout';
import Button from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import { Badge, EmptyState, Loader, StatCard } from '../components/ui/Feedback';
import { AnimatedNumber } from '../components/ui/Motion';

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
        title="Pending students"
        crumb="Head · Students"
        onLogout={logout}
      >
        <Loader label="Loading pending registrations…" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      user={user}
      role="head"
      nav={nav}
      activeKey="pending"
      title="Pending students"
      crumb="Head · Students"
      onLogout={logout}
      actions={
        <Button variant="secondary" size="sm" icon="arrow-left" onClick={() => navigate('/head')}>
          Back to head
        </Button>
      }
    >
      <div className="page-head">
        <div className="page-head__text">
          <h1>Registration approvals</h1>
          <p>Review student accounts before they can sign in and scan attendance.</p>
        </div>
        <div className="page-head__actions">
          <Badge variant={students.length ? 'warning' : 'success'} dot>
            {students.length ? `${students.length} awaiting review` : 'All caught up'}
          </Badge>
        </div>
      </div>

      <div className="kpi-grid stagger" style={{ marginBottom: 20 }}>
        <StatCard
          icon="user-plus"
          label="Pending requests"
          value={<AnimatedNumber value={students.length} />}
          meta="Waiting for your decision"
          tone={students.length ? 'warn' : 'olive'}
        />
        <StatCard
          icon="shield-check"
          label="Verification"
          value="Manual"
          meta="National ID + academic year"
          tone="blue"
        />
      </div>

      {students.length === 0 ? (
        <div className="card">
          <div className="card__body">
            <EmptyState
              icon="check-circle"
              title="No pending students"
              description="Every registration has been reviewed. New requests will appear here automatically."
              action={
                <Button variant="secondary" icon="users" onClick={() => navigate('/head')}>
                  Back to head overview
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
                  <span className="avatar avatar--lg avatar--light">{initials(s.full_name)}</span>
                  <div className="person__meta">
                    <b>{s.full_name}</b>
                    <span>Year {s.academic_year}</span>
                  </div>
                </div>
                <Badge variant="warning" dot>
                  {s.status}
                </Badge>
              </div>

              <div className="stack" style={{ gap: 7 }}>
                <div className="row" style={{ gap: 8, fontSize: '0.8rem' }}>
                  <Icon name="id-card" size={15} />
                  <span className="muted-cell">National ID</span>
                  <span className="mono" style={{ marginLeft: 'auto', fontWeight: 700 }}>
                    {s.national_id}
                  </span>
                </div>
                <div className="row" style={{ gap: 8, fontSize: '0.8rem' }}>
                  <Icon name="mail" size={15} />
                  <span className="muted-cell">Email</span>
                  <span style={{ marginLeft: 'auto', fontWeight: 600 }}>{s.email}</span>
                </div>
                <div className="row" style={{ gap: 8, fontSize: '0.8rem' }}>
                  <Icon name="smartphone" size={15} />
                  <span className="muted-cell">Phone</span>
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
                  Approve
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  icon="x"
                  disabled={actionLoading === s.id}
                  onClick={() => rejectStudent(s.id)}
                >
                  Reject
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
