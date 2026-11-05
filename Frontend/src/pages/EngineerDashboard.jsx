import { useEffect, useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import { connectSocket, disconnectSocket, getSocket } from '../api/socket';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/layout/DashboardLayout';
import Button from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import { Select } from '../components/ui/Field';
import { Alert, Badge, EmptyState, Loader, StatCard } from '../components/ui/Feedback';
import { AnimatedNumber } from '../components/ui/Motion';
import { PointActions, PointsLedger, PointsModal } from '../components/ui/Points';
import { useLanguage } from '../context/LanguageContext';

const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'EN';

export default function EngineerDashboard() {
  const { user, logout } = useAuth();
  const { lang } = useLanguage();
  const navigate = useNavigate();

  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liveUpdates, setLiveUpdates] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [qrToken, setQrToken] = useState('');
  const qrIntervalRef = useRef(null);
  const [currentTerm, setCurrentTerm] = useState('1');
  const [activeTab, setActiveTab] = useState('live');

  // Filters
  const [selectedMajor, setSelectedMajor] = useState('all');
  const [selectedGrade, setSelectedGrade] = useState('all');

  const [shortId, setShortId] = useState('');
  const [manualResult, setManualResult] = useState(null);

  // ➕ Bonus / minus points
  const [sessionPoints, setSessionPoints] = useState([]);
  const [pointTarget, setPointTarget] = useState(null);
  const [pointBusy, setPointBusy] = useState(false);

  const loadSessionPoints = async (sessionId) => {
    if (!sessionId) return;
    try {
      const { data } = await client.get(`/doctor/sessions/${sessionId}/points`);
      setSessionPoints(data.entries || []);
    } catch (err) {
      console.error('points error:', err);
    }
  };

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

  useEffect(() => {
    let mounted = true;

    const loadInitialData = async () => {
      try {
        const { data: coursesData } = await client.get('/doctor/courses');
        if (mounted) {
          setCourses(coursesData.courses);
          setCurrentTerm(coursesData.current_term);
        }

        const { data: sessionData } = await client.get('/doctor/active-session');
        if (sessionData.session && mounted) {
          setActiveSession(sessionData.session);
          startQrRefresh(sessionData.session.id);
          loadSessionPoints(sessionData.session.id);
          const socket = getSocket();
          if (socket) socket.emit('join-session', sessionData.session.id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadInitialData();

    const socket = connectSocket();
    const handleUpdate = (data) => {
      setLiveUpdates((prev) => [data, ...prev].slice(0, 20));
    };
    const handlePoints = (data) => {
      if (data.action === 'awarded' && data.point) {
        setSessionPoints((prev) => {
          if (prev.some((item) => item.id === data.point.id)) return prev;
          return [data.point, ...prev];
        });
      }
      if (data.action === 'removed' && data.point_id) {
        setSessionPoints((prev) => prev.filter((item) => item.id !== data.point_id));
      }
    };
    if (socket) {
      socket.on('attendance-update', handleUpdate);
      socket.on('points-update', handlePoints);
    }

    return () => {
      mounted = false;
      if (socket) {
        socket.off('attendance-update', handleUpdate);
        socket.off('points-update', handlePoints);
      }
      disconnectSocket();
      if (qrIntervalRef.current) clearInterval(qrIntervalRef.current);
    };
  }, []);

  // ⚡ Polling كل 5 ثواني — بديل WebSocket على Vercel
  useEffect(() => {
    if (!activeSession) return;
    const poll = setInterval(async () => {
      try {
        const { data } = await client.get(`/doctor/sessions/${activeSession.id}/attendance-list`);
        setLiveUpdates(
          data.map((x) => ({
            attendance_id: x.attendance_id,
            student_id: x.student_id,
            full_name: x.full_name,
            method: x.method,
            at: x.created_at,
          })).slice(0, 20)
        );
        loadSessionPoints(activeSession.id);
      } catch (e) {
        /* silent */
      }
    }, 5000);
    return () => clearInterval(poll);
  }, [activeSession?.id]);

  const startSession = async (courseId) => {
    try {
      const { data } = await client.post('/doctor/sessions', { course_id: courseId });
      setActiveSession(data.session);
      const socket = getSocket();
      if (socket) socket.emit('join-session', data.session.id);
      startQrRefresh(data.session.id);
      setManualResult(null);
      setLiveUpdates([]);
      setSessionPoints([]);
      loadSessionPoints(data.session.id);
      setActiveTab('live');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to start session');
    }
  };

  const endSession = async () => {
    if (!activeSession) return;
    try {
      await client.post(`/doctor/sessions/${activeSession.id}/end`);
      const socket = getSocket();
      if (socket) socket.emit('leave-session', activeSession.id);
      if (qrIntervalRef.current) clearInterval(qrIntervalRef.current);
      setActiveSession(null);
      setQrToken('');
      setManualResult(null);
      setSessionPoints([]);
      setPointTarget(null);
    } catch (err) {
      alert(lang === 'ar' ? 'فشل إنهاء الجلسة' : 'Failed to end session');
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
    } catch (err) {
      setManualResult({
        success: false,
        message: err.response?.data?.message || 'Failed to add manually',
      });
    }
  };

  const awardPoints = async ({ points, reason }) => {
    if (!activeSession || !pointTarget) return;
    setPointBusy(true);
    try {
      const name = pointTarget.student.full_name_ar || pointTarget.student.full_name;
      const { data } = await client.post(`/doctor/sessions/${activeSession.id}/points`, {
        student_id: pointTarget.student.student_id,
        type: pointTarget.mode,
        points,
        reason,
      });
      if (data.point) {
        setSessionPoints((prev) => {
          if (prev.some((item) => item.id === data.point.id)) return prev;
          return [data.point, ...prev];
        });
      }
      setManualResult({
        success: true,
        message:
          pointTarget.mode === 'bonus'
            ? lang === 'ar'
              ? `تم منح ${points} بونص لـ ${name}`
              : `Bonus of ${points} added to ${name}`
            : lang === 'ar'
              ? `تم تسجيل خصم ${points} لـ ${name}`
              : `Minus of ${points} recorded for ${name}`,
      });
      setPointTarget(null);
    } catch (err) {
      setManualResult({
        success: false,
        message: err.response?.data?.message || (lang === 'ar' ? 'فشل تسجيل النقاط' : 'Failed to save points'),
      });
    } finally {
      setPointBusy(false);
    }
  };

  const undoPoint = async (entry) => {
    const label = lang === 'ar' ? 'حذف هذه النقاط من السجل؟' : 'Remove this point entry?';
    if (!window.confirm(label)) return;
    try {
      await client.delete(`/doctor/points/${entry.id}`);
      setSessionPoints((prev) => prev.filter((item) => item.id !== entry.id));
    } catch (err) {
      alert(err.response?.data?.message || (lang === 'ar' ? 'فشل حذف النقاط' : 'Failed to remove points'));
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

  const termLabel = currentTerm === '2' ? (lang === 'ar' ? 'الفصل الثاني' : '2nd Term') : lang === 'ar' ? 'الفصل الأول' : '1st Term';

  const nav = [
    { key: 'live', label: 'Live Section', icon: 'activity', section: 'Section control', onClick: () => setActiveTab('live') },
    { key: 'section-courses', label: 'Section Courses', icon: 'book', onClick: () => setActiveTab('section-courses') },
    { key: 'reports', label: 'Attendance Reports', icon: 'chart', to: '/doctor/reports', section: 'Management' },
    { key: 'signout', label: 'Sign out', icon: 'logout', onClick: logout, section: 'Account' },
  ];

  if (loading) {
    return (
      <DashboardLayout
        user={user}
        role="engineer"
        nav={nav}
        activeKey={activeTab}
        title={{ en: 'Engineer workspace', ar: 'مساحة المهندس' }}
        crumb={{ en: 'Engineer', ar: 'المهندس' }}
        term={termLabel}
        onLogout={logout}
      >
        <Loader label={lang === 'ar' ? 'جارٍ تحميل الأقسام…' : 'Loading sections…'} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      user={user}
      role="engineer"
      nav={nav}
      activeKey={activeTab}
      title={activeTab === 'section-courses' ? { en: 'Section courses', ar: 'مقررات القسم' } : { en: 'Live section', ar: 'الجزء المباشر' }}
      crumb={{ en: 'Engineer', ar: 'المهندس' }}
      term={termLabel}
      onLogout={logout}
      actions={
        <>
          {activeSession && (
            <span className="chip chip--live">
              <span className="dot-pulse" /> {lang === 'ar' ? 'مباشر' : 'Section live'}
            </span>
          )}
          <Button variant="secondary" size="sm" icon="chart" onClick={() => navigate('/doctor/reports')}>
            {lang === 'ar' ? 'التقارير' : 'Reports'}
          </Button>
        </>
      }
    >
      {activeTab === 'live' && (
        <div className="stack">
          <div className="page-head" style={{ marginBottom: 0 }}>
            <div className="page-head__text">
              <h1>{lang === 'ar' ? 'تحكم القسم' : 'Section control'}</h1>
              <p>
                {lang === 'ar'
                  ? 'شغّل رمز QR للقسم، وأضف الطلاب يدوياً وشبّك بصمة الحضور.'
                  : 'Run the section QR, register students manually and monitor live check-ins.'}
              </p>
            </div>
            <div className="page-head__actions">
              <Badge variant={activeSession ? 'success' : 'neutral'} dot>
                {activeSession ? (lang === 'ar' ? 'الجلسة نشطة' : 'Session active') : lang === 'ar' ? 'لا توجد جلسة' : 'No active session'}
              </Badge>
            </div>
          </div>

          <div className="kpi-grid stagger">
            <StatCard
              icon="book"
              label={lang === 'ar' ? 'المقررات الموكلة' : 'Assigned courses'}
              value={<AnimatedNumber value={courses.length} />}
              meta={lang === 'ar' ? 'هذا الفصل' : 'This term'}
              tone="navy"
            />
            <StatCard
              icon="play"
              label={lang === 'ar' ? 'القسم المباشر' : 'Active section'}
              value={activeSession ? `#${activeSession.id}` : '—'}
              meta={activeSession ? activeSession.course_code : (lang === 'ar' ? 'ابدأ واحداً أدناه' : 'Start one below')}
              tone={activeSession ? 'teal' : 'default'}
            />
            <StatCard
              icon="activity"
              label={lang === 'ar' ? 'الحضور المباشر' : 'Live check-ins'}
              value={<AnimatedNumber value={liveUpdates.length} />}
              meta={lang === 'ar' ? 'هذه الجلسة' : 'This session'}
              tone="blue"
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
                      {lang === 'ar' ? `القسم رقم ${activeSession.id}` : `Section #${activeSession.id}`} · {activeSession.course_code}
                    </h2>
                    <p>{lang === 'ar' ? 'الطلاب يمسحون هذا الرمز من لوحة التحكم.' : 'Students scan this QR from their personal dashboard.'}</p>
                  </div>
                </div>
                <Button variant="danger" size="sm" icon="stop" onClick={endSession}>
                  {lang === 'ar' ? 'إنهاء القسم' : 'End section'}
                </Button>
              </div>

              <div className="session-panel__body">
                <div className="session-card-dark" style={{ textAlign: 'center' }}>
                  <h3>
                    <Icon name="qr" size={16} /> {lang === 'ar' ? 'رمز القسم' : 'Section QR'}
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
                      <Icon name="key" size={16} /> {lang === 'ar' ? 'الحضور اليدوي' : 'Manual attendance'}
                    </h3>
                    <p style={{ marginTop: 4, fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>
                      {lang === 'ar' ? 'استخدم آخر 5 أرقام من رقم الطالب.' : 'Use the last 5 digits of the student ID.'}
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
                        </Alert>
                      </div>
                    )}
                  </div>

                  <div className="session-card-dark">
                    <h3>
                      <Icon name="zap" size={16} /> {lang === 'ar' ? 'الحضور المباشر' : 'Live attendance'}
                    </h3>
                    {liveUpdates.length === 0 ? (
                      <div className="feed__empty" style={{ marginTop: 12 }}>
                        <Icon name="activity" size={18} /> {lang === 'ar' ? 'لا توجد تحديثات حضور بعد.' : 'No live updates yet.'}
                      </div>
                    ) : (
                      <div className="feed" style={{ marginTop: 12 }}>
                        {liveUpdates.map((u, i) => (
                          <div key={`${u.student_id}-${i}`} className="feed__item feed__item--points">
                            <span className="feed__avatar">{initials(lang === 'ar' && u.full_name_ar ? u.full_name_ar : u.full_name)}</span>
                            <div style={{ minWidth: 0 }}>
                              <b>{lang === 'ar' && u.full_name_ar ? u.full_name_ar : u.full_name}</b>
                              <span>{lang === 'ar' ? 'عبر' : 'via'} {u.method}</span>
                            </div>
                            <time>{new Date(u.at).toLocaleTimeString()}</time>
                            <PointActions
                              lang={lang}
                              onAward={(mode) => setPointTarget({ student: u, mode })}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeSession && (
            <section className="card points-card">
              <div className="data-bar">
                <div>
                  <h2>{lang === 'ar' ? 'سجل البونص والخصم' : 'Bonus & minus ledger'}</h2>
                  <p>
                    {lang === 'ar'
                      ? 'أسماء الطلاب الذين حصلوا على بونص أو خصم في هذا القسم.'
                      : 'Students who received a bonus or a minus in this section.'}
                  </p>
                </div>
                <div className="data-bar__actions">
                  <Badge variant="success">
                    +{sessionPoints.filter((p) => p.type === 'bonus').reduce((sum, p) => sum + p.points, 0)}
                  </Badge>
                  <Badge variant="danger">
                    −{sessionPoints.filter((p) => p.type === 'penalty').reduce((sum, p) => sum + p.points, 0)}
                  </Badge>
                </div>
              </div>
              <div className="card__body">
                <PointsLedger entries={sessionPoints} onUndo={undoPoint} lang={lang} />
              </div>
            </section>
          )}

          {!activeSession && (
            <section className="card">
              <div className="data-bar">
                <div>
                  <h2>{lang === 'ar' ? 'ابدأ قسماً' : 'Open a section'}</h2>
                  <p>{lang === 'ar' ? 'اختر مادة لبدء نافذة حضور قسم مباشر.' : 'Select a course to start a live section attendance window.'}</p>
                </div>
                <Badge variant="neutral">{filteredCourses.length} {lang === 'ar' ? 'مقرر' : 'course(s)'}</Badge>
              </div>
              <div className="card__body">
                {filteredCourses.length === 0 ? (
                  <EmptyState
                    icon="book"
                    title={lang === 'ar' ? 'لا توجد مقررات' : 'No courses for this selection'}
                    description={lang === 'ar' ? 'غيّر الفلاتر لرؤية مقررات أخرى مخصصة.' : 'Change the filters to see other assigned courses.'}
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
                            <Icon name="graduation-cap" size={14} /> Year {c.academic_year}
                          </span>
                          <span>
                            <Icon name="calendar" size={14} /> Term {c.term || '1'}
                          </span>
                          <span>
                            <Icon name="users" size={14} /> {c.student_count} students
                          </span>
                        </div>
                        <div className="course-card__actions">
                          <Button size="sm" icon="play" onClick={() => startSession(c.id)}>
                            Start section
                          </Button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      )}

      {activeTab === 'section-courses' && (
        <div className="stack">
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

          <div className="card">
            <div className="data-bar">
              <div>
                <h2>{lang === 'ar' ? 'مقررات القسم' : 'Section courses'}</h2>
                <p>{lang === 'ar' ? 'المقررات التي أنت مهندس القسم المسؤول عنها.' : 'Courses where you are assigned as the section engineer.'}</p>
              </div>
              <Badge variant="blue">{filteredCourses.length} {lang === 'ar' ? 'مقرر' : 'course(s)'}</Badge>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{lang === 'ar' ? 'المقرر' : 'Course'}</th>
                    <th>{lang === 'ar' ? 'التخصص' : 'Major'}</th>
                    <th>{lang === 'ar' ? 'السنة / الفصل' : 'Year / Term'}</th>
                    <th>{lang === 'ar' ? 'الطلاب' : 'Students'}</th>
                    <th>{lang === 'ar' ? 'إجراء' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCourses.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <span className="strong">{c.course_code}</span>
                        <span className="muted-cell"> — {c.course_name}</span>
                      </td>
                      <td className="muted-cell">{c.major_name}</td>
                      <td className="muted-cell nowrap">{lang === 'ar' ? `السنة ${c.academic_year} · الفصل ${c.term || '1'}` : `Year ${c.academic_year} · Term ${c.term || '1'}`}</td>
                      <td className="num">{c.student_count}</td>
                      <td>
                        <Button
                          size="sm"
                          icon="play"
                          onClick={() => startSession(c.id)}
                          disabled={!!activeSession}
                        >
                          {lang === 'ar' ? 'ابدأ القسم' : 'Start section'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {filteredCourses.length === 0 && (
                    <tr>
                      <td colSpan="5">
                        <EmptyState icon="book" title={lang === 'ar' ? 'لا توجد مقررات' : 'No courses found'} />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      <PointsModal
        open={!!pointTarget}
        student={
          pointTarget
            ? { ...pointTarget.student, course_code: activeSession?.course_code }
            : null
        }
        mode={pointTarget?.mode || 'bonus'}
        lang={lang}
        busy={pointBusy}
        onClose={() => setPointTarget(null)}
        onConfirm={awardPoints}
      />
    </DashboardLayout>
  );
}
