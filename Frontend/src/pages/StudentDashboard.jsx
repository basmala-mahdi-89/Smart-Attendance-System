import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import DashboardLayout from '../components/layout/DashboardLayout';
import Button from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import { Select } from '../components/ui/Field';
import { Badge, EmptyState, Loader, StatCard } from '../components/ui/Feedback';
import { AnimatedNumber, ProgressBar } from '../components/ui/Motion';

const TABS = [
  { key: 'dashboard', label: 'Overview', icon: 'home' },
  { key: 'courses', label: 'My Courses', icon: 'book' },
  { key: 'attendance', label: 'Attendance History', icon: 'calendar-check' },
  { key: 'warnings', label: 'Warnings', icon: 'alert' },
];

function AttendanceGauge({ value }) {
  const size = 104;
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  const offset = circumference - (safe / 100) * circumference;

  return (
    <div className="gauge" style={{ '--size': `${size}px` }} role="img" aria-label={`Attendance ${safe}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="gaugeGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#87afc6" />
            <stop offset="100%" stopColor="#c4d7f2" />
          </linearGradient>
        </defs>
        <circle className="gauge__track" cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth="8" />
        <circle
          className="gauge__fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="gauge__value">
        <strong>
          <AnimatedNumber value={safe} suffix="%" />
        </strong>
        <span>attendance</span>
      </div>
    </div>
  );
}

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [currentTerm, setCurrentTerm] = useState('1');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Course filter
  const [selectedCourseId, setSelectedCourseId] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [coursesRes, attendanceRes, warningsRes] = await Promise.all([
        client.get('/students/me/courses'),
        client.get('/students/me/attendance'),
        client.get('/students/me/warnings'),
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

  const filteredCourses =
    selectedCourseId === 'all'
      ? courses
      : courses.filter((c) => c.id === parseInt(selectedCourseId));

  const filteredWarnings =
    selectedCourseId === 'all'
      ? warnings
      : warnings.filter((w) => w.course_id === parseInt(selectedCourseId));

  const displayAttended = filteredCourses.reduce(
    (sum, c) => sum + parseInt(c.attended_sessions || 0),
    0
  );
  const displayTotalSessions = filteredCourses.reduce(
    (sum, c) => sum + parseInt(c.total_sessions || 0),
    0
  );
  const displayWarningsCount = filteredWarnings.length;
  const attendanceRate =
    displayTotalSessions > 0 ? Math.round((displayAttended / displayTotalSessions) * 100) : 0;
  const termLabel = currentTerm === '2' ? '2nd Term' : '1st Term';

  const nav = TABS.map((tab) => ({
    ...tab,
    count: tab.key === 'warnings' ? warnings.length : undefined,
    onClick: () => setActiveTab(tab.key),
    section: tab.key === 'dashboard' ? 'Student workspace' : undefined,
  }));
  nav.push({
    key: 'personal-qr',
    label: 'My Personal QR',
    icon: 'qr',
    to: '/student/personal-qr',
    section: 'Quick actions',
  });
  nav.push({ key: 'scan', label: 'Scan Session QR', icon: 'scan', to: '/student/scan' });
  nav.push({ key: 'warnings', label: 'My Warnings', icon: 'alert-triangle', to: '/student/warnings' });
  nav.push({ key: 'signout', label: 'Sign out', icon: 'logout', onClick: logout });

  if (loading) {
    return (
      <DashboardLayout
        user={user}
        role="student"
        nav={nav}
        activeKey={activeTab}
        title="Student workspace"
        crumb="Student"
        term={termLabel}
        onLogout={logout}
      >
        <Loader label="Loading your attendance…" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      user={user}
      role="student"
      nav={nav}
      activeKey={activeTab}
      title={TABS.find((tab) => tab.key === activeTab)?.label || 'Student workspace'}
      crumb="Student"
      term={termLabel}
      onLogout={logout}
      actions={
        <>
          <Button variant="secondary" size="sm" icon="scan" onClick={() => navigate('/student/scan')}>
            Scan QR
          </Button>
          <Button size="sm" icon="qr" onClick={() => navigate('/student/personal-qr')}>
            My QR
          </Button>
        </>
      }
    >
      <section className="hero anim-up">
        <div className="row-between wrap">
          <div className="grow" style={{ minWidth: 240, maxWidth: 640 }}>
            <span className="hero__eyebrow">
              <Icon name="sparkles" size={14} /> {termLabel} · Student workspace
            </span>
            <h2>Welcome back, {user?.full_name?.split(' ')[0] || 'student'}.</h2>
            <p>
              Track every session, keep your attendance above the limit and scan the doctor QR
              the moment a lecture starts.
            </p>
            <div className="hero__actions">
              <Button variant="white" icon="scan" onClick={() => navigate('/student/scan')}>
                Scan doctor QR
              </Button>
              <Button variant="ghost" icon="qr" onClick={() => navigate('/student/personal-qr')} style={{ color: '#fff', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.28)' }}>
                Personal QR
              </Button>
            </div>
            <div className="hero__stats">
              <div className="hero__stat">
                <span>Attended</span>
                <strong>
                  <AnimatedNumber value={displayAttended} />
                  <small> / {displayTotalSessions}</small>
                </strong>
              </div>
              <div className="hero__stat">
                <span>Courses</span>
                <strong>
                  <AnimatedNumber value={filteredCourses.length} />
                </strong>
              </div>
              <div className="hero__stat">
                <span>Warnings</span>
                <strong>
                  <AnimatedNumber value={displayWarningsCount} />
                </strong>
              </div>
            </div>
          </div>
          <AttendanceGauge value={attendanceRate} />
        </div>
      </section>

      <div className="toolbar" style={{ marginTop: 22 }}>
        <div className="grow" style={{ minWidth: 240 }}>
          <Select
            label="Course filter"
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            icon="filter"
          >
            <option value="all">All courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.course_code} — {c.course_name}
              </option>
            ))}
          </Select>
        </div>
        {attendanceRate < 75 && displayTotalSessions > 0 && (
          <Badge variant="danger" dot>
            Below the 75% limit
          </Badge>
        )}
        {attendanceRate >= 75 && displayTotalSessions > 0 && (
          <Badge variant="success" dot>
            Attendance is healthy
          </Badge>
        )}
      </div>

      {activeTab === 'dashboard' && (
        <div className="stack" style={{ marginTop: 20 }}>
          <div className="kpi-grid stagger">
            <StatCard
              icon="book"
              label="Courses selected"
              value={<AnimatedNumber value={filteredCourses.length} />}
              meta="Enrolled this term"
              tone="navy"
            />
            <StatCard
              icon="check-circle"
              label="Sessions attended"
              value={<AnimatedNumber value={displayAttended} />}
              meta={`Out of ${displayTotalSessions} sessions`}
              tone="teal"
            />
            <StatCard
              icon="calendar"
              label="Total sessions"
              value={<AnimatedNumber value={displayTotalSessions} />}
              meta="Held so far"
              tone="blue"
            />
            <StatCard
              icon="alert"
              label="Warnings"
              value={<AnimatedNumber value={displayWarningsCount} />}
              meta={displayWarningsCount === 0 ? 'All clear' : 'Needs attention'}
              tone={displayWarningsCount === 0 ? 'olive' : 'danger'}
            />
          </div>

          <div className="card">
            <div className="data-bar">
              <div>
                <h2>Attendance by course</h2>
                <p>Percentage of sessions attended in each enrolled course.</p>
              </div>
              <Badge variant={attendanceRate >= 75 ? 'success' : 'warning'}>
                Overall {attendanceRate}%
              </Badge>
            </div>
            <div className="card__body stack">
              {filteredCourses.length === 0 && (
                <EmptyState
                  icon="book"
                  title="No courses yet"
                  description="Your head of department has not enrolled you in courses for this term."
                />
              )}
              {filteredCourses.map((c) => {
                const pct =
                  c.total_sessions > 0
                    ? Math.round((c.attended_sessions / c.total_sessions) * 100)
                    : 0;
                return (
                  <div key={c.id} className="stack" style={{ gap: 8 }}>
                    <div className="row-between wrap" style={{ gap: 8 }}>
                      <div className="row" style={{ gap: 9 }}>
                        <span className="course-card__code">{c.course_code}</span>
                        <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{c.course_name}</span>
                      </div>
                      <span className={`percent ${pct >= 75 ? 'percent--good' : 'percent--bad'}`}>
                        {pct}%
                      </span>
                    </div>
                    <ProgressBar
                      value={pct}
                      tone={pct >= 75 ? 'success' : pct >= 50 ? 'warning' : 'danger'}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'courses' && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="data-bar">
            <div>
              <h2>My courses</h2>
              <p>{filteredCourses.length} course(s) in {termLabel.toLowerCase()}.</p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Course</th>
                  <th>Major</th>
                  <th>Year / Term</th>
                  <th>Sessions</th>
                  <th>Attended</th>
                  <th style={{ minWidth: 160 }}>Attendance</th>
                </tr>
              </thead>
              <tbody>
                {filteredCourses.map((c) => {
                  const pct =
                    c.total_sessions > 0
                      ? Math.round((c.attended_sessions / c.total_sessions) * 100)
                      : 0;
                  return (
                    <tr key={c.id}>
                      <td className="strong">{c.course_code}</td>
                      <td>{c.course_name}</td>
                      <td className="muted-cell">{c.major_name}</td>
                      <td className="muted-cell nowrap">
                        Year {c.academic_year} · Term {c.term || '1'}
                      </td>
                      <td className="num">{c.total_sessions}</td>
                      <td className="num">{c.attended_sessions}</td>
                      <td>
                        <ProgressBar
                          value={pct}
                          tone={pct >= 75 ? 'success' : pct >= 50 ? 'warning' : 'danger'}
                          showLabel
                        />
                      </td>
                    </tr>
                  );
                })}
                {filteredCourses.length === 0 && (
                  <tr>
                    <td colSpan="7">
                      <EmptyState
                        icon="book"
                        title="No courses found"
                        description="Try changing the course filter above."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'attendance' && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="data-bar">
            <div>
              <h2>Attendance history</h2>
              <p>Every check-in recorded on your account.</p>
            </div>
            <Badge variant="blue">{attendance.length} record(s)</Badge>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Session date</th>
                  <th>Method</th>
                  <th>Checked in at</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <span className="strong">{a.course_code}</span>
                      <span className="muted-cell"> — {a.course_name}</span>
                    </td>
                    <td className="nowrap">{a.session_date}</td>
                    <td>
                      <Badge variant={a.method === 'manual' ? 'warning' : 'blue'}>
                        {a.method.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="muted-cell nowrap">{new Date(a.created_at).toLocaleString()}</td>
                  </tr>
                ))}
                {attendance.length === 0 && (
                  <tr>
                    <td colSpan="4">
                      <EmptyState
                        icon="calendar"
                        title="No attendance records"
                        description="Scan the doctor QR in your next session to start your history."
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'warnings' && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="data-bar">
            <div>
              <h2>My warnings</h2>
              <p>Automatic warnings based on your absence percentage.</p>
            </div>
            <Badge variant={filteredWarnings.length ? 'danger' : 'success'}>
              {filteredWarnings.length} warning(s)
            </Badge>
          </div>
          <div className="card__body">
            {filteredWarnings.length === 0 ? (
              <EmptyState
                icon="shield-check"
                title="No warnings"
                description="Your attendance is within the allowed limit for this selection."
              />
            ) : (
              <div className="warning-grid">
                {filteredWarnings.map((w) => (
                  <article key={w.id} className="warning-card">
                    <h3>
                      <Icon name="alert" size={18} /> Warning level {w.level}
                    </h3>
                    <p>
                      <b>{w.course_code}</b> — {w.course_name}
                    </p>
                    <div className="warning-card__meta">
                      <Badge variant="danger">
                        Absence {parseFloat(w.absence_percentage).toFixed(1)}%
                      </Badge>
                      <Badge variant="neutral">Max allowed {w.max_allowed}%</Badge>
                    </div>
                    <time>{new Date(w.sent_at).toLocaleString()}</time>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
