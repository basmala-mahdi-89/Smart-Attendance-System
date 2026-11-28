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
import { PointsLedger } from '../components/ui/Points';
import { useLanguage } from '../context/LanguageContext';

const TABS = [
  { key: 'dashboard', label: { en: 'Overview', ar: 'نظرة عامة' }, icon: 'home' },
  { key: 'courses', label: { en: 'My Courses', ar: 'مقرراتي' }, icon: 'book' },
  { key: 'attendance', label: { en: 'Attendance History', ar: 'سجل الحضور' }, icon: 'calendar-check' },
  { key: 'points', label: { en: 'Bonus & Minus', ar: 'البونص والخصم' }, icon: 'award' },
  { key: 'warnings', label: { en: 'Warnings', ar: 'التحذيرات' }, icon: 'alert' },
];

function AttendanceGauge({ value }) {
  const { lang } = useLanguage();
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
        <span>{lang === 'ar' ? 'الحضور' : 'attendance'}</span>
      </div>
    </div>
  );
}

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [pointsData, setPointsData] = useState({ entries: [], totals: { bonus: 0, penalty: 0, net: 0 } });
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
      const [coursesRes, attendanceRes, warningsRes, pointsRes] = await Promise.all([
        client.get('/students/me/courses'),
        client.get('/students/me/attendance'),
        client.get('/students/me/warnings'),
        client.get('/students/me/points'),
      ]);
      // ⚡ Hide courses from other terms (e.g. term 1 while current term is 2).
      // No backend change needed: the API already returns course.term + current_term.
      const activeTerm = String(coursesRes.data.current_term || '1');
      const allCourses = Array.isArray(coursesRes.data.courses) ? coursesRes.data.courses : [];
      setCourses(allCourses.filter((c) => String(c.term || '1') === activeTerm));
      setCurrentTerm(activeTerm);
      setAttendance(attendanceRes.data);
      setWarnings(warningsRes.data);
      setPointsData(pointsRes.data || { entries: [], totals: { bonus: 0, penalty: 0, net: 0 } });
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

  const filteredPoints =
    selectedCourseId === 'all'
      ? pointsData.entries || []
      : (pointsData.entries || []).filter((p) => Number(p.course_id) === Number(selectedCourseId));

  const pointsTotals = filteredPoints.reduce(
    (acc, entry) => {
      if (entry.type === 'bonus') acc.bonus += entry.points;
      else acc.penalty += entry.points;
      return acc;
    },
    { bonus: 0, penalty: 0 }
  );
  pointsTotals.net = pointsTotals.bonus - pointsTotals.penalty;

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
  const termLabel =
    currentTerm === '2' ? (lang === 'ar' ? 'الفصل الثاني' : '2nd Term') : lang === 'ar' ? 'الفصل الأول' : '1st Term';

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
  nav.push({ key: 'my-warnings', label: 'My Warnings', icon: 'alert-triangle', to: '/student/warnings' });
  nav.push({ key: 'signout', label: 'Sign out', icon: 'logout', onClick: logout });

  if (loading) {
    return (
      <DashboardLayout
        user={user}
        role="student"
        nav={nav}
        activeKey={activeTab}
        title={{ en: 'Student workspace', ar: 'مساحة الطالب' }}
        crumb={{ en: 'Student', ar: 'الطالب' }}
        term={termLabel}
        onLogout={logout}
      >
        <Loader label={lang === 'ar' ? 'جارٍ تحميل حضورك…' : 'Loading your attendance…'} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      user={user}
      role="student"
      nav={nav}
      activeKey={activeTab}
      title={TABS.find((tab) => tab.key === activeTab)?.label || { en: 'Student workspace', ar: 'مساحة الطالب' }}
      crumb={{ en: 'Student', ar: 'الطالب' }}
      term={termLabel}
      onLogout={logout}
      actions={
        <>
          <Button variant="secondary" size="sm" icon="scan" onClick={() => navigate('/student/scan')}>
            {lang === 'ar' ? 'مسح رمز QR' : 'Scan QR'}
          </Button>
          <Button size="sm" icon="qr" onClick={() => navigate('/student/personal-qr')}>
            {lang === 'ar' ? 'رمزي الشخصي' : 'My QR'}
          </Button>
        </>
      }
    >
      <section className="hero anim-up">
        <div className="row-between wrap">
          <div className="grow" style={{ minWidth: 240, maxWidth: 640 }}>
            <span className="hero__eyebrow">
              <Icon name="sparkles" size={14} /> {termLabel} · {lang === 'ar' ? 'مساحة الطالب' : 'Student workspace'}
            </span>
            <h2>{lang === 'ar' ? `مرحباً بعودتك، ${user?.full_name_ar?.split(' ')[0] || user?.full_name?.split(' ')[0] || 'student'}.` : `Welcome back, ${user?.full_name?.split(' ')[0] || 'student'}.`}</h2>
            <p>
              {lang === 'ar'
                ? 'تتبع كل جلسة، احتفظ بحضورك فوق الحد المسموح به، وامسح رمز QR للدكتور في اللحظة التي تبدأ فيها المحاضرة.'
                : 'Track every session, keep your attendance above the limit and scan the doctor QR the moment a lecture starts.'}
            </p>
            <div className="hero__actions">
              <Button variant="white" icon="scan" onClick={() => navigate('/student/scan')}>
                {lang === 'ar' ? 'مسح رمز QR للدكتور' : 'Scan doctor QR'}
              </Button>
              <Button variant="ghost" icon="qr" onClick={() => navigate('/student/personal-qr')} style={{ color: '#fff', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.28)' }}>
                {lang === 'ar' ? 'الرمز الشخصي' : 'Personal QR'}
              </Button>
            </div>
            <div className="hero__stats">
              <div className="hero__stat">
                <span>{lang === 'ar' ? 'حضور' : 'Attended'}</span>
                <strong>
                  <AnimatedNumber value={displayAttended} />
                  <small> / {displayTotalSessions}</small>
                </strong>
              </div>
              <div className="hero__stat">
                <span>{lang === 'ar' ? 'مقررات' : 'Courses'}</span>
                <strong>
                  <AnimatedNumber value={filteredCourses.length} />
                </strong>
              </div>
              <div className="hero__stat">
                <span>{lang === 'ar' ? 'تحذيرات' : 'Warnings'}</span>
                <strong>
                  <AnimatedNumber value={displayWarningsCount} />
                </strong>
              </div>
              <div className="hero__stat">
                <span>{lang === 'ar' ? 'صافي النقاط' : 'Net points'}</span>
                <strong>
                  {pointsTotals.net >= 0 ? '+' : '−'}
                  <AnimatedNumber value={Math.abs(pointsTotals.net)} />
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
            label={lang === 'ar' ? 'تصفية المقررات' : 'Course filter'}
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            icon="filter"
          >
            <option value="all">{lang === 'ar' ? 'كل المقررات' : 'All courses'}</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.course_code} — {c.course_name}
              </option>
            ))}
          </Select>
        </div>
        {attendanceRate < 75 && displayTotalSessions > 0 && (
          <Badge variant="danger" dot>
            {lang === 'ar' ? 'تحت الحد المسموح به' : 'Below the 75% limit'}
          </Badge>
        )}
        {attendanceRate >= 75 && displayTotalSessions > 0 && (
          <Badge variant="success" dot>
            {lang === 'ar' ? 'الحضور ممتاز' : 'Attendance is healthy'}
          </Badge>
        )}
      </div>

      {activeTab === 'dashboard' && (
        <div className="stack" style={{ marginTop: 20 }}>
          <div className="kpi-grid stagger">
            <StatCard
              icon="book"
              label={lang === 'ar' ? 'المقررات المختارة' : 'Courses selected'}
              value={<AnimatedNumber value={filteredCourses.length} />}
              meta={lang === 'ar' ? 'مسجّل فيها هذا الفصل' : 'Enrolled this term'}
              tone="navy"
            />
            <StatCard
              icon="check-circle"
              label={lang === 'ar' ? 'الجلسات الحاضر' : 'Sessions attended'}
              value={<AnimatedNumber value={displayAttended} />}
              meta={lang === 'ar' ? `من أصل ${displayTotalSessions} جلسة` : `Out of ${displayTotalSessions} sessions`}
              tone="teal"
            />
            <StatCard
              icon="calendar"
              label={lang === 'ar' ? 'إجمالي الجلسات' : 'Total sessions'}
              value={<AnimatedNumber value={displayTotalSessions} />}
              meta={lang === 'ar' ? 'الحضور بها حتى الآن' : 'Held so far'}
              tone="blue"
            />
            <StatCard
              icon="alert"
              label={lang === 'ar' ? 'التحذيرات' : 'Warnings'}
              value={<AnimatedNumber value={displayWarningsCount} />}
              meta={displayWarningsCount === 0 ? (lang === 'ar' ? 'كل شيء مضبوط' : 'All clear') : (lang === 'ar' ? 'يحتاج انتباه' : 'Needs attention')}
              tone={displayWarningsCount === 0 ? 'olive' : 'danger'}
            />
            <StatCard
              icon="award"
              label={lang === 'ar' ? 'صافي البونص' : 'Net bonus'}
              value={`${pointsTotals.net >= 0 ? '+' : '−'}${Math.abs(pointsTotals.net)}`}
              meta={
                lang === 'ar'
                  ? `+${pointsTotals.bonus} بونص · −${pointsTotals.penalty} خصم`
                  : `+${pointsTotals.bonus} bonus · −${pointsTotals.penalty} minus`
              }
              tone={pointsTotals.net >= 0 ? 'teal' : 'danger'}
            />
          </div>

          <div className="card">
            <div className="data-bar">
              <div>
                <h2>{lang === 'ar' ? 'الحضور حسب المقرر' : 'Attendance by course'}</h2>
                <p>{lang === 'ar' ? 'نسبة الجلسات التي حضرتها في كل مادة مسجّلة.' : 'Percentage of sessions attended in each enrolled course.'}</p>
              </div>
              <Badge variant={attendanceRate >= 75 ? 'success' : 'warning'}>
                {lang === 'ar' ? `الإجمالي ${attendanceRate}%` : `Overall ${attendanceRate}%`}
              </Badge>
            </div>
            <div className="card__body stack">
              {filteredCourses.length === 0 && (
                <EmptyState
                  icon="book"
                  title={lang === 'ar' ? 'لا توجد مقررات بعد' : 'No courses yet'}
                  description={lang === 'ar' ? 'لم يقم رئيس القسم بإضافتك إلى مقررات لهذا الفصل.' : 'Your head of department has not enrolled you in courses for this term.'}
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
              <h2>{lang === 'ar' ? 'مقرراتي' : 'My courses'}</h2>
              <p>{filteredCourses.length} {lang === 'ar' ? 'مقرر' : 'course(s)'} في {termLabel.toLowerCase()}.{lang === 'ar' ? ` (${termLabel})` : ''}</p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{lang === 'ar' ? 'رمز' : 'Code'}</th>
                  <th>{lang === 'ar' ? 'المقرر' : 'Course'}</th>
                  <th>{lang === 'ar' ? 'التخصص' : 'Major'}</th>
                  <th>{lang === 'ar' ? 'السنة / الفصل' : 'Year / Term'}</th>
                  <th>{lang === 'ar' ? 'الجلسات' : 'Sessions'}</th>
                  <th>{lang === 'ar' ? 'الحضور' : 'Attended'}</th>
                  <th style={{ minWidth: 160 }}>{lang === 'ar' ? 'نسبة الحضور' : 'Attendance'}</th>
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
                        title={lang === 'ar' ? 'لا توجد مقررات' : 'No courses found'}
                        description={lang === 'ar' ? 'غيّر تصفية المقررات في الأعلى.' : 'Try changing the course filter above.'}
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
              <h2>{lang === 'ar' ? 'سجل الحضور' : 'Attendance history'}</h2>
              <p>{lang === 'ar' ? 'كل عملية حضور سُجّلت في حسابك.' : 'Every check-in recorded on your account.'}</p>
            </div>
            <Badge variant="blue">{attendance.length} {lang === 'ar' ? 'سجل' : 'record(s)'}</Badge>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{lang === 'ar' ? 'المقرر' : 'Course'}</th>
                  <th>{lang === 'ar' ? 'تاريخ الجلسة' : 'Session date'}</th>
                  <th>{lang === 'ar' ? 'الطريقة' : 'Method'}</th>
                  <th>{lang === 'ar' ? 'تم الحضور في' : 'Checked in at'}</th>
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
                        title={lang === 'ar' ? 'لا توجد سجلات حضور' : 'No attendance records'}
                        description={lang === 'ar' ? 'امسح رمز QR للدكتور في الجلسة القادمة لبدء سجل حضورك.' : 'Scan the doctor QR in your next session to start your history.'}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'points' && (
        <div className="card points-card" style={{ marginTop: 20 }}>
          <div className="data-bar">
            <div>
              <h2>{lang === 'ar' ? 'البونص والخصم' : 'Bonus & minus'}</h2>
              <p>
                {lang === 'ar'
                  ? 'كل النقاط التي منحها لك الدكتور أو المهندس، مع السبب والتاريخ.'
                  : 'Every point awarded to you by a doctor or engineer, with reason and date.'}
              </p>
            </div>
            <div className="data-bar__actions">
              <Badge variant="success">+{pointsTotals.bonus}</Badge>
              <Badge variant="danger">−{pointsTotals.penalty}</Badge>
              <Badge variant="neutral">
                {lang === 'ar' ? 'الصافي' : 'Net'} {pointsTotals.net >= 0 ? '+' : '−'}
                {Math.abs(pointsTotals.net)}
              </Badge>
            </div>
          </div>
          <div className="card__body">
            <PointsLedger entries={filteredPoints} lang={lang} />
          </div>
        </div>
      )}

      {activeTab === 'warnings' && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="data-bar">
            <div>
              <h2>{lang === 'ar' ? 'تحذيراتي' : 'My warnings'}</h2>
              <p>{lang === 'ar' ? 'تحذيرات تلقائية بناءً على نسبة غيابك.' : 'Automatic warnings based on your absence percentage.'}</p>
            </div>
            <Badge variant={filteredWarnings.length ? 'danger' : 'success'}>
              {filteredWarnings.length} {lang === 'ar' ? 'تحذير' : 'warning(s)'}
            </Badge>
          </div>
          <div className="card__body">
            {filteredWarnings.length === 0 ? (
              <EmptyState
                icon="shield-check"
                title={lang === 'ar' ? 'لا توجد تحذيرات' : 'No warnings'}
                description={lang === 'ar' ? 'حضورك ضمن الحد المسموح به.' : 'Your attendance is within the allowed limit for this selection.'}
              />
            ) : (
              <div className="warning-grid">
                {filteredWarnings.map((w) => (
                  <article key={w.id} className="warning-card">
                    <h3>
                      <Icon name="alert" size={18} /> {lang === 'ar' ? 'مستوى التحذير' : 'Warning level'} {w.level}
                    </h3>
                    <p>
                      <b>{w.course_code}</b> — {w.course_name}
                    </p>
                    <div className="warning-card__meta">
                      <Badge variant="danger">
                        {lang === 'ar' ? `غياب ${parseFloat(w.absence_percentage).toFixed(1)}%` : `Absence ${parseFloat(w.absence_percentage).toFixed(1)}%`}
                      </Badge>
                      <Badge variant="neutral">{lang === 'ar' ? `الحد المسموح ${w.max_allowed}%` : `Max allowed ${w.max_allowed}%`}</Badge>
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
