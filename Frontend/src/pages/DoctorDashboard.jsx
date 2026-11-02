import { useEffect, useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import { connectSocket, disconnectSocket, getSocket } from '../api/socket';
import { useNavigate } from 'react-router-dom';
import { Html5QrcodeScanner } from 'html5-qrcode';
import DashboardLayout from '../components/layout/DashboardLayout';
import Button from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import { Input, Select } from '../components/ui/Field';
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

export default function DoctorDashboard() {
  const { user, logout } = useAuth();
  const { lang } = useLanguage();
  const navigate = useNavigate();

  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liveUpdates, setLiveUpdates] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [qrToken, setQrToken] = useState('');
  const qrIntervalRef = useRef(null);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [attendanceList, setAttendanceList] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [currentTerm, setCurrentTerm] = useState('1');

  const [selectedMajor, setSelectedMajor] = useState('all');
  const [selectedGrade, setSelectedGrade] = useState('all');

  const [historySearch, setHistorySearch] = useState('');
  const [historyFilterCourse, setHistoryFilterCourse] = useState('all');

  const [attendees, setAttendees] = useState([]);
  const [showAttendees, setShowAttendees] = useState(false);
  const [selectedHistorySession, setSelectedHistorySession] = useState(null);

  const [toast, setToast] = useState(null);
  const notify = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const [showScanner, setShowScanner] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [shortId, setShortId] = useState('');
  const [manualResult, setManualResult] = useState(null);

  const startQrRefresh = (sessionId) => {
    const fetchQR = async () => {
      try {
        const { data } = await client.get(`/doctor/sessions/${sessionId}/qr`);
        setQrToken(data.token);
      } catch (err) {
        console.error('QR error:', err);
      }
    };
    fetchQR();
    if (qrIntervalRef.current) clearInterval(qrIntervalRef.current);
    qrIntervalRef.current = setInterval(fetchQR, 5000);
  };

  const loadAttendanceList = async (sessionId) => {
    try {
      const { data } = await client.get(`/doctor/sessions/${sessionId}/attendance-list`);
      setAttendanceList(data);
    } catch (err) {
      console.error(err);
    }
  };

  const openAttendees = async (session) => {
    setSelectedHistorySession(session);
    setShowAttendees(true);
    setAttendees([]);
    try {
      const { data } = await client.get(`/doctor/sessions/${session.id}/attendance`);
      setAttendees(data.attendance || data);
    } catch (err) {
      notify(err.response?.data?.message || (lang === 'ar' ? 'فشل تحميل الحضور' : 'Failed to load attendees'), 'error');
    }
  };

  const removeAttendance = async (attendanceId) => {
    if (!activeSession) return;
    if (!window.confirm(lang === 'ar' ? 'هل تريد إزالة سجل الحضور هذا؟' : 'Remove this attendance record?')) return;
    try {
      await client.delete(`/doctor/sessions/${activeSession.id}/attendance/${attendanceId}`);
      loadAttendanceList(activeSession.id);
    } catch (err) {
      notify(err.response?.data?.message || (lang === 'ar' ? 'فشل إزالة الحضور' : 'Failed to remove attendance'));
    }
  };

  useEffect(() => {
    if (!showScanner) return;
    const timeout = setTimeout(() => {
      const scanner = new Html5QrcodeScanner(
        'doctor-reader',
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
        false
      );
      scanner.render(
        async (decodedText) => {
          scanner.clear().catch((e) => console.error(e));
          setShowScanner(false);
          try {
            const res = await client.post(
              `/doctor/sessions/${activeSession.id}/scan-student-qr`,
              { qr_data: decodedText }
            );
            setScanResult({ success: true, message: res.data.message, student: res.data.student });
            setTimeout(() => setScanResult(null), 3000);
          } catch (err) {
            setScanResult({
              success: false,
              message: err.response?.data?.message || 'Scan failed',
            });
            setTimeout(() => setScanResult(null), 3000);
          }
        },
        () => {}
      );
    }, 200);
    return () => {
      clearTimeout(timeout);
    };
  }, [showScanner, activeSession]);

  useEffect(() => {
    let mounted = true;
    const loadInitialData = async () => {
      try {
        const [coursesRes, sessionData, historyRes] = await Promise.all([
          client.get('/doctor/courses'),
          client.get('/doctor/active-session'),
          client.get('/doctor/sessions/history'),
        ]);
        if (mounted) {
          setCourses(coursesRes.data.courses);
          setCurrentTerm(coursesRes.data.current_term);
          setSessionHistory(historyRes.data);
        }
        if (sessionData.data.session && mounted) {
          setActiveSession(sessionData.data.session);
          startQrRefresh(sessionData.data.session.id);
          loadAttendanceList(sessionData.data.session.id);
          const socket = getSocket();
          if (socket) socket.emit('join-session', sessionData.data.session.id);
        }
      } catch (err) {
        console.error('Error loading initial data:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadInitialData();

    const socket = connectSocket();
    const handleUpdate = (data) => {
      setLiveUpdates((prev) => [data, ...prev].slice(0, 20));
      setAttendanceList((prev) => {
        if (prev.some((item) => item.student_id === data.student_id)) return prev;
        return [
          {
            attendance_id: data.attendance_id || Date.now(),
            student_id: data.student_id,
            full_name: data.full_name,
            method: data.method,
            created_at: data.at || new Date().toISOString(),
          },
          ...prev,
        ];
      });
    };
    const handleRemove = (data) => {
      if (activeSession && data.session_id === activeSession.id) {
        setAttendanceList((prev) =>
          prev.filter((item) => item.attendance_id !== data.attendance_id)
        );
      }
    };
    socket.on('attendance-update', handleUpdate);
    socket.on('attendance-removed', handleRemove);

    return () => {
      mounted = false;
      socket.off('attendance-update', handleUpdate);
      socket.off('attendance-removed', handleRemove);
      disconnectSocket();
      if (qrIntervalRef.current) clearInterval(qrIntervalRef.current);
    };
  }, []);

  const startSession = async (courseId) => {
    try {
      const { data } = await client.post('/doctor/sessions', { course_id: courseId });
      setActiveSession(data.session);
      setAttendanceList([]);
      setLiveUpdates([]);
      setManualResult(null);
      setScanResult(null);
      const socket = getSocket();
      if (socket) socket.emit('join-session', data.session.id);
      startQrRefresh(data.session.id);
      setActiveTab('dashboard');
    } catch (err) {
      notify(err.response?.data?.message || (lang === 'ar' ? 'فشل بدء الجلسة' : 'Failed to start session'));
    }
  };

  const endSession = async () => {
    if (!activeSession) return;
    setShowScanner(false);
    try {
      await client.post(`/doctor/sessions/${activeSession.id}/end`);
      const socket = getSocket();
      if (socket) socket.emit('leave-session', activeSession.id);
      if (qrIntervalRef.current) clearInterval(qrIntervalRef.current);
      setActiveSession(null);
      setQrToken('');
      setManualResult(null);
      setScanResult(null);
      setAttendanceList([]);
    } catch (err) {
      notify(lang === 'ar' ? 'فشل إنهاء الجلسة' : 'Failed to end session');
    }
  };

  const handleManualAdd = async (e) => {
    e.preventDefault();
    setManualResult(null);
    try {
      const { data } = await client.post(`/doctor/sessions/${activeSession.id}/manual-add`, {
        short_id: shortId,
      });
      setManualResult({ success: true, message: data.message, student: data.attendance.full_name });
      setShortId('');
      loadAttendanceList(activeSession.id);
    } catch (err) {
      setManualResult({
        success: false,
        message: err.response?.data?.message || 'Failed to add manually',
      });
    }
  };

  const uniqueMajors = [...new Set(courses.map((c) => c.major_name))];
  const uniqueGrades = ['1', '2', '3', '4'].filter((grade) =>
    courses.some((c) => c.academic_year === grade)
  );

  const filteredCourses = courses.filter((c) => {
    const matchMajor = selectedMajor === 'all' || c.major_name === selectedMajor;
    const matchGrade = selectedGrade === 'all' || c.academic_year === selectedGrade;
    return matchMajor && matchGrade;
  });

  const dynamicStats = {
    totalCourses: filteredCourses.length,
    totalSessions: filteredCourses.reduce((sum, c) => sum + parseInt(c.total_sessions || 0), 0),
    completedSessions: filteredCourses.reduce(
      (sum, c) => sum + parseInt(c.completed_sessions || 0),
      0
    ),
    activeSessions: filteredCourses.reduce((sum, c) => sum + parseInt(c.active_sessions || 0), 0),
    uniqueStudents: filteredCourses.reduce(
      (sum, c) => sum + parseInt(c.unique_students_attended || 0),
      0
    ),
  };

  const termLabel = currentTerm === '2' ? (lang === 'ar' ? 'الفصل الثاني' : '2nd Term') : lang === 'ar' ? 'الفصل الأول' : '1st Term';
  const isHeadMode = user?.role === 'head';
  const isDeanMode = user?.role === 'dean';

  const filteredSessionHistory = sessionHistory.filter((s) => {
    const matchCourse = historyFilterCourse === 'all' || String(s.course_id) === historyFilterCourse;
    if (!matchCourse) return false;
    if (!historySearch) return true;
    const q = historySearch.toLowerCase();
    return (s.course_code || '').toLowerCase().includes(q) || (s.course_name || '').toLowerCase().includes(q);
  });

  const nav = [
    { key: 'dashboard', label: 'Live Session', icon: 'activity', section: 'Teaching' },
    { key: 'courses', label: 'My Courses', icon: 'book', onClick: () => setActiveTab('courses') },
    { key: 'history', label: 'Session History', icon: 'calendar', onClick: () => setActiveTab('history') },
    { key: 'reports', label: 'Attendance Reports', icon: 'chart', to: '/doctor/reports', section: 'Management' },
  ];
  if (isHeadMode) nav.push({ key: 'head', label: 'Head Management', icon: 'users', to: '/head' });
  if (isDeanMode) nav.push({ key: 'dean', label: 'Dean Console', icon: 'building', to: '/dean' });
  nav.push({ key: 'signout', label: 'Sign out', icon: 'logout', onClick: logout, section: 'Account' });

  nav[0].onClick = () => setActiveTab('dashboard');
  nav[1].onClick = () => setActiveTab('courses');
  nav[2].onClick = () => setActiveTab('history');

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
        role="doctor"
        nav={nav}
        activeKey={activeTab}
        title={{ en: 'Doctor workspace', ar: 'مساحة الدكتور' }}
        crumb={{ en: 'Doctor', ar: 'الدكتور' }}
        term={termLabel}
        onLogout={logout}
      >
        <Loader label={lang === 'ar' ? 'جارٍ تحميل مقرراتك…' : 'Loading your courses…'} />
      </DashboardLayout>
      </>
    );
  }

  return (
    <>
      {toastEl}
      <DashboardLayout
      user={user}
      role="doctor"
      nav={nav}
      activeKey={activeTab}
      title={
        {
          dashboard: { en: 'Live session', ar: 'الجلسة المباشرة' },
          courses: { en: 'My courses', ar: 'مقرراتي' },
          history: { en: 'Session history', ar: 'سجل الجلسات' },
        }[activeTab]?.[lang] || { en: 'Doctor workspace', ar: 'مساحة الدكاترة' }[lang]
      }
      crumb={{ en: 'Doctor', ar: 'الدكتور' }}
      term={termLabel}
      onLogout={logout}
      actions={
        <>
          {activeSession && (
            <span className="chip chip--live">
              <span className="dot-pulse" /> {lang === 'ar' ? 'مباشر' : 'Live'}
            </span>
          )}
          <Button variant="secondary" size="sm" icon="chart" onClick={() => navigate('/doctor/reports')}>
            {lang === 'ar' ? 'التقارير' : 'Reports'}
          </Button>
        </>
      }
    >
      {activeTab === 'dashboard' && (
        <div className="stack">
          <div className="page-head" style={{ marginBottom: 0 }}>
            <div className="page-head__text">
              <h1>{lang === 'ar' ? 'نظرة عامة على التدريس' : 'Teaching overview'}</h1>
              <p>{lang === 'ar' ? 'ابدأ جلسة، شارك رمز QR المتحرك، وشاهد الحضور يصلك مباشرة.' : 'Start a session, share the rotating QR and watch check-ins arrive live.'}</p>
            </div>
            <div className="page-head__actions">
              <Badge variant="blue">{filteredCourses.length} {lang === 'ar' ? 'مقرر' : 'course(s)'}</Badge>
              <Badge variant="neutral">{termLabel}</Badge>
            </div>
          </div>

          <div className="toolbar">
            <Select
              label={lang === 'ar' ? 'التخصص' : 'Major'}
              value={selectedMajor}
              onChange={(e) => setSelectedMajor(e.target.value)}
              icon="layers"
            >
              <option value="all">{lang === 'ar' ? 'كل التخصصات' : 'All majors'}</option>
              {uniqueMajors.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </Select>
            <Select
              label={lang === 'ar' ? 'الصف' : 'Grade'}
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              icon="graduation-cap"
            >
              <option value="all">{lang === 'ar' ? 'كل الصفوف' : 'All grades'}</option>
              {uniqueGrades.map((g) => (
                <option key={g} value={g}>
                  {lang === 'ar' ? `الصف ${g}` : `Year ${g}`}
                </option>
              ))}
            </Select>
          </div>

          <div className="kpi-grid stagger">
            <StatCard
              icon="book"
              label={lang === 'ar' ? 'المقررات' : 'Courses'}
              value={<AnimatedNumber value={dynamicStats.totalCourses} />}
              meta={lang === 'ar' ? 'بعد الفلاتر' : 'After filters'}
              tone="navy"
            />
            <StatCard
              icon="calendar"
              label={lang === 'ar' ? 'إجمالي الجلسات' : 'Total sessions'}
              value={<AnimatedNumber value={dynamicStats.totalSessions} />}
              meta={lang === 'ar' ? 'كل الجلسات المعقدة' : 'All held sessions'}
              tone="blue"
            />
            <StatCard
              icon="check-circle"
              label={lang === 'ar' ? 'مكتملة' : 'Completed'}
              value={<AnimatedNumber value={dynamicStats.completedSessions} />}
              meta={lang === 'ar' ? 'الجلسات المغلقة' : 'Closed sessions'}
              tone="teal"
            />
            <StatCard
              icon="activity"
              label={lang === 'ar' ? 'نشطة الآن' : 'Active now'}
              value={<AnimatedNumber value={dynamicStats.activeSessions} />}
              meta={lang === 'ar' ? 'الجلسات الجارية' : 'Running sessions'}
              tone={dynamicStats.activeSessions > 0 ? 'olive' : 'default'}
            />
            <StatCard
              icon="users"
              label={lang === 'ar' ? 'طلاب فريدون' : 'Unique students'}
              value={<AnimatedNumber value={dynamicStats.uniqueStudents} />}
              meta={lang === 'ar' ? 'حضروا مرة واحدة على الأقل' : 'Checked in at least once'}
              tone="default"
            />
          </div>

          {activeSession && (
            <section className="session-panel anim-up">
              <div className="session-panel__head">
                <div className="session-panel__title">
                  <span className="live-badge">
                    <span className="dot-pulse" /> LIVE
                  </span>
                  <div>
                    <h2>
                      {lang === 'ar' ? `الجلسة رقم ${activeSession.id}` : `Session #${activeSession.id}`} · {activeSession.course_code}
                    </h2>
                    <p>{lang === 'ar' ? `رمز QR يتجدد كل 5 ثوانٍ · ${attendanceList.length} حضور` : `QR rotates every 5 seconds · ${attendanceList.length} checked in`}</p>
                  </div>
                </div>
                <Button variant="danger" size="sm" icon="stop" onClick={endSession}>
                  {lang === 'ar' ? 'إنهاء الجلسة' : 'End session'}
                </Button>
              </div>

              <div className="session-panel__body">
                <div className="session-card-dark" style={{ textAlign: 'center' }}>
                  <h3>
                    <Icon name="qr" size={16} /> {lang === 'ar' ? 'رمز الجلسة' : 'Session QR'}
                  </h3>
                  {qrToken ? (
                    <>
                      <div className="qr-frame">
                        <QRCodeSVG value={qrToken} size={196} />
                      </div>
                      <div className="qr-frame__foot">
                        <Icon name="refresh" size={13} /> {lang === 'ar' ? 'يتجدد كل 5 ثوانٍ' : 'Refreshing every 5 seconds'}
                      </div>
                    </>
                  ) : (
                    <div className="feed__empty" style={{ marginTop: 12 }}>
                      <Icon name="refresh" size={18} /> {lang === 'ar' ? 'جارٍ توليد الرمز الآمن…' : 'Generating secure token…'}
                    </div>
                  )}
                </div>

                <div className="stack">
                  <div className="session-card-dark">
                    <h3>
                      <Icon name="smartphone" size={16} /> {lang === 'ar' ? 'امسح الرمز الشخصي للطالب' : "Scan a student's personal QR"}
                    </h3>
                    {!showScanner ? (
                      <Button
                        variant="white"
                        size="sm"
                        icon="camera"
                        style={{ marginTop: 12 }}
                        onClick={() => setShowScanner(true)}
                      >
                        {lang === 'ar' ? 'تشغيل ماسح الكاميرا' : 'Start camera scanner'}
                      </Button>
                    ) : (
                      <div style={{ marginTop: 12 }}>
                        <div className="scanner-shell">
                          <div id="doctor-reader" />
                        </div>
                        <Button
                          variant="danger"
                          size="sm"
                          block
                          icon="x"
                          style={{ marginTop: 10 }}
                          onClick={() => setShowScanner(false)}
                        >
                          {lang === 'ar' ? 'إيقاف الماسح' : 'Stop scanner'}
                        </Button>
                      </div>
                    )}
                    {scanResult && (
                      <div style={{ marginTop: 12 }}>
                        <Alert variant={scanResult.success ? 'success' : 'error'}>
                          {scanResult.message}
                        </Alert>
                      </div>
                    )}
                  </div>

                  <div className="session-card-dark">
                    <h3>
                      <Icon name="key" size={16} /> {lang === 'ar' ? 'الحضور اليدوي' : 'Manual attendance'}
                    </h3>
                    <p style={{ marginTop: 4, fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>
                      {lang === 'ar' ? 'أدخل آخر 5 أرقام من البطاقة الوطنية للطالب.' : "Enter the last 5 digits of the student's national ID."}
                    </p>
                    <form className="code-entry" onSubmit={handleManualAdd}>
                      <input
                        className="input"
                        type="text"
                        inputMode="numeric"
                        placeholder="12345"
                        value={shortId}
                        onChange={(e) => setShortId(e.target.value.replace(/\D/g, ''))}
                        maxLength={5}
                        aria-label={lang === 'ar' ? 'معرف الطالب المختصر' : 'Student short ID'}
                      />
                      <Button type="submit" variant="success" icon="plus">
                        {lang === 'ar' ? 'إضافة' : 'Add'}
                      </Button>
                    </form>
                    {manualResult && (
                      <div style={{ marginTop: 12 }}>
                        <Alert variant={manualResult.success ? 'success' : 'error'}>
                          {manualResult.message}
                          {manualResult.student ? ` · ${manualResult.student}` : ''}
                        </Alert>
                      </div>
                    )}
                  </div>

                  <div className="session-card-dark">
                    <h3>
                      <Icon name="zap" size={16} /> {lang === 'ar' ? 'الحضور المباشر' : 'Live check-ins'}
                    </h3>
                    {liveUpdates.length === 0 ? (
                      <div className="feed__empty" style={{ marginTop: 12 }}>
                        <Icon name="activity" size={18} />
                        {lang === 'ar' ? 'بانتظار أول حضور…' : 'Waiting for the first check-in…'}
                      </div>
                    ) : (
                      <div className="feed" style={{ marginTop: 12 }}>
                        {liveUpdates.map((u, i) => (
                          <div key={`${u.student_id}-${i}`} className="feed__item">
                            <span className="feed__avatar">{initials(lang === 'ar' && u.full_name_ar ? u.full_name_ar : u.full_name)}</span>
                            <div style={{ minWidth: 0 }}>
                              <b>{lang === 'ar' && u.full_name_ar ? u.full_name_ar : u.full_name}</b>
                              <span>{lang === 'ar' ? 'عبر' : 'via'} {u.method}</span>
                            </div>
                            <time>{new Date(u.at).toLocaleTimeString()}</time>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {!activeSession && (
            <section className="card">
              <div className="data-bar">
                <div>
                  <h2>{lang === 'ar' ? 'ابدأ جلسة جديدة' : 'Start a new session'}</h2>
                  <p>{lang === 'ar' ? 'اختر واحدة من مقرراتك لفتح جلسة حضور مباشرة.' : 'Pick one of your courses to open a live attendance session.'}</p>
                </div>
                <Badge variant="neutral">{filteredCourses.length} {lang === 'ar' ? 'متاح' : 'available'}</Badge>
              </div>
              <div className="card__body">
                {filteredCourses.length === 0 ? (
                  <EmptyState
                    icon="book"
                    title={lang === 'ar' ? 'لا توجد مقررات تطابق الفلاتر' : 'No courses match these filters'}
                    description={lang === 'ar' ? 'غيّر فلتر التخصص أو الصف لرؤية مقرراتك.' : 'Change the major or grade filter to see your courses.'}
                  />
                ) : (
                  <div className="course-grid">
                    {filteredCourses.map((c) => (
                      <article key={c.id} className="course-card">
                        <div className="course-card__top">
                          <div>
                            <span className="course-card__code">{c.course_code}</span>
                            <h3>{c.course_name}</h3>
                          </div>
                          <Badge variant="neutral">{c.major_name}</Badge>
                        </div>
                        <div className="course-card__meta">
                          <span>
                            <Icon name="graduation-cap" size={14} /> {lang === 'ar' ? `السنة ${c.academic_year}` : `Year ${c.academic_year}`}
                          </span>
                          <span>
                            <Icon name="calendar" size={14} /> {lang === 'ar' ? `الفصل ${c.term || '1'}` : `Term ${c.term || '1'}`}
                          </span>
                          <span>
                            <Icon name="users" size={14} /> {c.student_count} {lang === 'ar' ? 'طالب' : 'students'}
                          </span>
                        </div>
                        <div className="course-card__actions">
                          <Button size="sm" icon="play" onClick={() => startSession(c.id)}>
                            {lang === 'ar' ? 'ابدأ الجلسة' : 'Start session'}
                          </Button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {activeSession && attendanceList.length > 0 && (
            <section className="card">
              <div className="data-bar">
                <div>
                  <h2>{lang === 'ar' ? 'الطلاب الحاضرون' : 'Checked-in students'}</h2>
                  <p>{lang === 'ar' ? `قائمة مباشرة للجلسة رقم ${activeSession.id}. أزل سجلاً إذا كان خطأً.` : `Live list for session #${activeSession.id}. Remove a record if it was a mistake.`}</p>
                </div>
                <Badge variant="success">{attendanceList.length} {lang === 'ar' ? 'حاضر' : 'present'}</Badge>
              </div>
              <div className="table-wrap">
                <table className="table table--compact">
                  <thead>
                    <tr>
                      <th>{lang === 'ar' ? 'الطالب' : 'Student'}</th>
                      <th>{lang === 'ar' ? 'الطريقة' : 'Method'}</th>
                      <th>{lang === 'ar' ? 'تم الحضور' : 'Checked in'}</th>
                      <th style={{ width: 90 }}>{lang === 'ar' ? 'إجراء' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceList.map((a) => (
                      <tr key={a.attendance_id}>
                        <td>
                          <div className="person">
                            <span className="avatar" style={{ width: 32, height: 32, fontSize: '0.66rem' }}>
                              {initials(lang === 'ar' && a.full_name_ar ? a.full_name_ar : a.full_name)}
                            </span>
                            <div className="person__meta">
                              <b>{lang === 'ar' && a.full_name_ar ? a.full_name_ar : a.full_name}</b>
                              <span>ID #{a.student_id}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <Badge variant={a.method === 'manual' ? 'warning' : 'blue'}>{a.method}</Badge>
                        </td>
                        <td className="muted-cell nowrap">
                          {a.created_at ? new Date(a.created_at).toLocaleTimeString() : '—'}
                        </td>
                        <td>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon="trash"
                            aria-label={`Remove attendance for ${lang === 'ar' && a.full_name_ar ? a.full_name_ar : a.full_name}`}
                            onClick={() => removeAttendance(a.attendance_id)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}

      {activeTab === 'courses' && (
        <div className="card">
          <div className="data-bar">
            <div>
              <h2>{lang === 'ar' ? 'مقرراتي' : 'My courses'}</h2>
              <p>{lang === 'ar' ? 'كل ما تدرسه هذا الفصل، بما في ذلك المهندسون المكلفون.' : 'Everything you teach this term, including assigned engineers.'}</p>
            </div>
            <Badge variant="blue">{courses.length} {lang === 'ar' ? 'مقرر' : 'course(s)'}</Badge>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{lang === 'ar' ? 'المقرر' : 'Course'}</th>
                  <th>{lang === 'ar' ? 'التخصص' : 'Major'}</th>
                  <th>{lang === 'ar' ? 'السنة / الفصل' : 'Year / Term'}</th>
                  <th>{lang === 'ar' ? 'الطلاب' : 'Students'}</th>
                  <th>{lang === 'ar' ? 'المهندسون' : 'Engineers'}</th>
                  <th>{lang === 'ar' ? 'دورك' : 'Your role'}</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span className="strong">{c.course_code}</span>
                      <span className="muted-cell"> — {c.course_name}</span>
                    </td>
                    <td className="muted-cell">{c.major_name}</td>
                    <td className="muted-cell nowrap">{lang === 'ar' ? `السنة ${c.academic_year} · الفصل ${c.term || '1'}` : `Year ${c.academic_year} · Term ${c.term || '1'}`}</td>
                    <td className="num">{c.student_count}</td>
                    <td className="muted-cell">{c.engineers?.join(', ') || (lang === 'ar' ? 'لا يوجد' : 'None')}</td>
                    <td>
                      <Badge variant="blue">{c.role_in_course}</Badge>
                      {c.is_primary && <Badge variant="success" className="badge--dot">{lang === 'ar' ? 'رئيسي' : 'Primary'}</Badge>}
                    </td>
                  </tr>
                ))}
                {courses.length === 0 && (
                  <tr>
                    <td colSpan="6">
                      <EmptyState icon="book" title={lang === 'ar' ? 'لا توجد مقررات مخصصة بعد' : 'No courses assigned yet'} />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="card">
          <div className="data-bar">
            <div>
              <h2>{lang === 'ar' ? 'سجل الجلسات' : 'Session history'}</h2>
              <p>{lang === 'ar' ? 'كل جلسة فتحتها، مع إجمالي الحضور.' : 'Every session you opened, with attendance totals.'}</p>
            </div>
            <Badge variant="blue">{filteredSessionHistory.length} {lang === 'ar' ? 'جلسة' : 'session(s)'}</Badge>
            <select
              className="input"
              style={{ maxWidth: 160 }}
              value={historyFilterCourse}
              onChange={(e) => setHistoryFilterCourse(e.target.value)}
            >
              <option value="all">{lang === 'ar' ? 'كل المقررات' : 'All courses'}</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.course_code}</option>
              ))}
            </select>
            <input
              className="input"
              placeholder={lang === 'ar' ? 'ابحث في الجلسات…' : 'Search sessions...'}
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              style={{ maxWidth: 180 }}
            />
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{lang === 'ar' ? 'المقرر' : 'Course'}</th>
                  <th>{lang === 'ar' ? 'التاريخ' : 'Date'}</th>
                  <th>{lang === 'ar' ? 'البداية' : 'Start'}</th>
                  <th>{lang === 'ar' ? 'النهاية' : 'End'}</th>
                  <th>{lang === 'ar' ? 'النوع' : 'Type'}</th>
                  <th style={{ minWidth: 140 }}>{lang === 'ar' ? 'الحضور' : 'Attendance'}</th>
                  <th>{lang === 'ar' ? 'الحضور' : 'Attendees'}</th>
                  <th>{lang === 'ar' ? 'الحالة' : 'Status'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessionHistory.map((s) => {
                  const pct =
                    s.enrolled_count > 0
                      ? Math.round((s.attendance_count / s.enrolled_count) * 100)
                      : 0;
                  return (
                    <tr key={s.id}>
                      <td className="muted-cell">#{s.id}</td>
                      <td>
                        <span className="strong">{s.course_code}</span>
                        <span className="muted-cell"> — {s.course_name}</span>
                      </td>
                      <td className="nowrap">{s.session_date}</td>
                      <td className="muted-cell nowrap">
                        {s.start_time ? new Date(s.start_time).toLocaleTimeString() : '—'}
                      </td>
                      <td className="muted-cell nowrap">
                        {s.end_time ? new Date(s.end_time).toLocaleTimeString() : '—'}
                      </td>
                      <td>
                        <Badge variant="neutral">{s.type}</Badge>
                      </td>
                      <td>
                        <div className="row" style={{ gap: 8 }}>
                          <span className="num" style={{ fontSize: '0.78rem' }}>
                            {s.attendance_count}/{s.enrolled_count}
                          </span>
                          <span style={{ flex: 1, minWidth: 60 }}>
                            <ProgressBar value={pct} tone={pct >= 75 ? 'success' : 'warning'} />
                          </span>
                        </div>
                      </td>
                      <td>
                        <Button variant="soft" size="sm" icon="users" onClick={() => openAttendees(s)}>
                          {lang === 'ar' ? 'عرض' : 'View'}
                        </Button>
                      </td>
                      <td>
                        <Badge variant={s.is_active ? 'success' : 'neutral'} dot>
                          {s.is_active ? (lang === 'ar' ? 'نشطة' : 'Active') : lang === 'ar' ? 'مكتملة' : 'Completed'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
                {filteredSessionHistory.length === 0 && (
                  <tr>
                    <td colSpan="9">
                      <EmptyState
                        icon="calendar"
                        title={lang === 'ar' ? 'لا توجد جلسات بعد' : 'No sessions yet'}
                        description={lang === 'ar' ? 'ابدأ جلستك الأولى من تبويب الجلسة المباشرة.' : 'Start your first session from the live session tab.'}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    {showAttendees && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#fff', overflow: 'auto', padding: 24 }} onClick={() => setShowAttendees(false)}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }} onClick={(e) => e.stopPropagation()}>
          <h2>{lang === 'ar' ? `الحضور — الجلسة رقم ${selectedHistorySession?.id}` : `Attendees — Session #${selectedHistorySession?.id}`}</h2>
          {attendees.length === 0 ? (
            <p className="muted">{lang === 'ar' ? 'لا يوجد حضور مسجل.' : 'No attendance recorded.'}</p>
          ) : (
            <ul className="stack" style={{ gap: 6, maxHeight: 500, overflow: 'auto', minWidth: 320 }}>
              {attendees.map((a) => (
                <li key={a.attendance_id || a.id} className="row" style={{ justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #eee' }}>
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
            <Button variant="secondary" onClick={() => setShowAttendees(false)}>{lang === 'ar' ? 'إغلاق' : 'Close'}</Button>
          </div>
        </div>
      </div>
    )}
    </DashboardLayout>
    </>
  );
}
