import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import DashboardLayout from '../components/layout/DashboardLayout';
import Button from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import { Input, Select } from '../components/ui/Field';
import { Badge, EmptyState, Loader, StatCard } from '../components/ui/Feedback';
import { AnimatedNumber, ProgressBar } from '../components/ui/Motion';
import { PointsLedger, PointsSummary } from '../components/ui/Points';
import { useLanguage } from '../context/LanguageContext';

export default function DoctorReports() {
  const { user, logout } = useAuth();
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [points, setPoints] = useState(null);

  // Student selection + warning dispatch
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [sendingWarnings, setSendingWarnings] = useState(false);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const { data } = await client.get('/doctor/courses');
        setCourses(Array.isArray(data) ? data : data.courses || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchCourses();
  }, []);

  const loadReport = async (courseId) => {
    if (!courseId) {
      setReport(null);
      setPoints(null);
      return;
    }
    setLoading(true);
    setSearchTerm('');
    setSelectedStudents([]);
    setPoints(null);
    try {
      const { data } = await client.get(`/doctor/courses/${courseId}/report`);
      setReport(data);
    } catch (err) {
      alert(lang === 'ar' ? 'فشل تحميل التقرير' : 'Failed to load report');
    } finally {
      setLoading(false);
    }
    try {
      const { data } = await client.get(`/doctor/courses/${courseId}/points`);
      setPoints(data);
    } catch (err) {
      console.error('points load error:', err);
    }
  };

  const undoPoint = async (entry) => {
    const label = lang === 'ar' ? 'حذف هذه النقاط من السجل؟' : 'Remove this point entry?';
    if (!window.confirm(label)) return;
    try {
      await client.delete(`/doctor/points/${entry.id}`);
      const { data } = await client.get(`/doctor/courses/${selectedCourse}/points`);
      setPoints(data);
    } catch (err) {
      alert(err.response?.data?.message || (lang === 'ar' ? 'فشل حذف النقاط' : 'Failed to remove points'));
    }
  };

  const toggleStudent = (studentId) => {
    setSelectedStudents((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const toggleAll = () => {
    if (selectedStudents.length === filteredStudents.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(filteredStudents.map((s) => s.student_id));
    }
  };

  const handleSendWarnings = async () => {
    if (selectedStudents.length === 0) {
      alert(lang === 'ar' ? 'الرجاء تحديد طالب واحد على الأقل.' : 'Please select at least one student.');
      return;
    }
    if (!window.confirm(lang === 'ar' ? `إرسال تحذير إلى ${selectedStudents.length} طالب محدد؟` : `Send warnings to ${selectedStudents.length} selected student(s)?`)) return;

    setSendingWarnings(true);
    try {
      const { data } = await client.post(`/doctor/courses/${selectedCourse}/send-warnings`, {
        student_ids: selectedStudents,
      });
      alert(data.message);
      setSelectedStudents([]);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send warnings');
    } finally {
      setSendingWarnings(false);
    }
  };

  const downloadCSV = async () => {
    if (!selectedCourse) return;
    try {
      const response = await client.get(`/doctor/courses/${selectedCourse}/export`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'Course_Report.csv');
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      alert(lang === 'ar' ? 'فشل تنزيل التقرير' : 'Failed to download report');
    }
  };

  const filteredStudents =
    report?.students?.filter((s) =>
      s.full_name.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

  const belowThreshold = filteredStudents.filter((s) => Number(s.percentage) < 75).length;
  const allSelected =
    filteredStudents.length > 0 && selectedStudents.length === filteredStudents.length;

  const homeLink =
    user?.role === 'head' ? '/head' : user?.role === 'dean' ? '/dean' : '/doctor';
  const homeLabel =
    user?.role === 'head'
      ? { en: 'Head Overview', ar: 'نظرة عامة على القسم' }
      : user?.role === 'dean'
        ? { en: 'Dean Console', ar: 'لوحة العميد' }
        : { en: 'Live Session', ar: 'الجلسة المباشرة' };

  const nav = [
    { key: 'dashboard', label: homeLabel, icon: user?.role === 'dean' ? 'building' : 'home', to: homeLink, section: { en: 'Workspace', ar: 'مساحة العمل' } },
    { key: 'reports', label: { en: 'Attendance Reports', ar: 'تقارير الحضور' }, icon: 'chart' },
    { key: 'signout', label: { en: 'Sign out', ar: 'تسجيل الخروج' }, icon: 'logout', onClick: logout, section: { en: 'Account', ar: 'الحساب' } },
  ];

  return (
    <DashboardLayout
      user={user}
      role={user?.role}
      nav={nav}
      activeKey="reports"
      title={{ en: 'Attendance reports', ar: 'تقارير الحضور' }}
      crumb={{ en: 'Reports', ar: 'التقارير' }}
      onLogout={logout}
      actions={
        <Button variant="secondary" size="sm" icon="arrow-left" onClick={() => navigate(homeLink)}>
          {lang === 'ar' ? 'رجوع' : 'Back'}
        </Button>
      }
    >
      <div className="page-head">
        <div className="page-head__text">
          <h1>{lang === 'ar' ? 'تقرير حضور المقررات' : 'Course attendance report'}</h1>
          <p>{lang === 'ar' ? 'راجع الحضور لكل طالب، أو صدّر CSV، أو أرسل تحذيرات موجهة.' : 'Inspect attendance per student, export a CSV, or send targeted warnings.'}</p>
        </div>
        <div className="page-head__actions">
          {report && (
            <Badge variant="blue" dot>
              {report.type === 'section' ? (lang === 'ar' ? 'أقسام' : 'Sections') : lang === 'ar' ? 'محاضرات' : 'Lectures'} · {report.total_sessions} {lang === 'ar' ? 'عقد' : 'held'}
            </Badge>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card__body">
          <div className="toolbar" style={{ alignItems: 'flex-end' }}>
            <div style={{ minWidth: 280, flex: '1 1 320px' }}>
              <Select
                label={lang === 'ar' ? 'المقرر' : 'Course'}
                icon="book"
                value={selectedCourse}
                onChange={(e) => {
                  setSelectedCourse(e.target.value);
                  loadReport(e.target.value);
                }}
              >
                <option value="">{lang === 'ar' ? 'اختر مادة…' : 'Choose a course…'}</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.course_code} — {c.course_name}
                  </option>
                ))}
              </Select>
            </div>
            <Button
              variant="secondary"
              icon="download"
              disabled={!selectedCourse || !report}
              onClick={downloadCSV}
            >
              {lang === 'ar' ? 'تصدير CSV' : 'Export CSV'}
            </Button>
            <Button
              variant="danger"
              icon="alert"
              loading={sendingWarnings}
              disabled={selectedStudents.length === 0 || sendingWarnings}
              onClick={handleSendWarnings}
            >
              {lang === 'ar' ? `إرسال تحذير (${selectedStudents.length})` : `Send warning (${selectedStudents.length})`}
            </Button>
          </div>
        </div>
      </div>

      {loading && <Loader label={lang === 'ar' ? 'جارٍ إنشاء التقرير…' : 'Building report…'} />}

      {!loading && !report && (
        <div className="card">
          <div className="card__body">
            <EmptyState
              icon="chart"
              title={lang === 'ar' ? 'اختر مادة لعرض تقريرها' : 'Select a course to view its report'}
              description={lang === 'ar' ? 'اختر واحدة من مقرراتك أعلاه لعرض الحضور لكل طالب، أو صدّره، أو أرسل التحذيرات.' : 'Pick one of your courses above to see per-student attendance, export it, or send warnings.'}
            />
          </div>
        </div>
      )}

      {report && !loading && (
        <div className="stack">
          <div className="kpi-grid stagger">
            <StatCard
              icon="calendar"
              label={report.type === 'section' ? (lang === 'ar' ? 'الأقسام المعقدة' : 'Sections held') : lang === 'ar' ? 'المحاضرات المعقدة' : 'Lectures held'}
              value={<AnimatedNumber value={report.total_sessions} />}
              meta={`${report.course.course_code} · ${report.course.course_name}`}
              tone="navy"
            />
            <StatCard
              icon="users"
              label={lang === 'ar' ? 'الطلاب في التقرير' : 'Students in report'}
              value={<AnimatedNumber value={filteredStudents.length} />}
              meta={lang === 'ar' ? `${selectedStudents.length} مُختار` : `${selectedStudents.length} selected`}
              tone="blue"
            />
            <StatCard
              icon="alert"
              label={lang === 'ar' ? 'تحت 75%' : 'Below 75%'}
              value={<AnimatedNumber value={belowThreshold} />}
              meta={lang === 'ar' ? 'مؤهل لاستلام تحذير' : 'Eligible for a warning'}
              tone={belowThreshold > 0 ? 'danger' : 'olive'}
            />
          </div>

          <div className="card">
            <div className="data-bar">
              <div>
                <h2>
                  {report.course.course_code} — {report.course.course_name}
                </h2>
                <p>{lang === 'ar' ? 'اختر الطلاب لإرسال تحذير حضور.' : 'Select students to send them an attendance warning.'}</p>
              </div>
              <div className="data-bar__actions">
                <div style={{ minWidth: 220 }}>
                  <Input
                    icon="search"
                    placeholder={lang === 'ar' ? 'ابحث باسم الطالب…' : 'Search student name…'}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    aria-label={lang === 'ar' ? 'ابحث باسم الطالب' : 'Search student name'}
                  />
                </div>
              </div>
            </div>

            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th className="check-cell">
                      <input
                        type="checkbox"
                        aria-label={lang === 'ar' ? 'تحديد جميع الطلاب' : 'Select all students'}
                        onChange={toggleAll}
                        checked={allSelected}
                      />
                    </th>
                    <th>{lang === 'ar' ? 'الطالب' : 'Student'}</th>
                    <th>{lang === 'ar' ? 'البطاقة الوطنية' : 'National ID'}</th>
                    <th>{lang === 'ar' ? 'حاضر' : 'Attended'}</th>
                    <th>{lang === 'ar' ? 'غائب' : 'Absent'}</th>
                    <th style={{ minWidth: 170 }}>{lang === 'ar' ? 'النسبة' : 'Percentage'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan="6">
                        <EmptyState
                          icon="search"
                          title={lang === 'ar' ? 'لا يوجد طلاب' : 'No students found'}
                          description={lang === 'ar' ? 'جرّب اسمًا مختلفًا في مربع البحث.' : 'Try a different name in the search box.'}
                        />
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((s) => {
                      const selected = selectedStudents.includes(s.student_id);
                      return (
                        <tr key={s.student_id} className={selected ? 'row-selected' : ''}>
                          <td className="check-cell">
                            <input
                              type="checkbox"
                              aria-label={`Select ${lang === 'ar' && s.full_name_ar ? s.full_name_ar : s.full_name}`}
                              checked={selected}
                              onChange={() => toggleStudent(s.student_id)}
                            />
                          </td>
                          <td>
                            <span className="strong">{lang === 'ar' && s.full_name_ar ? s.full_name_ar : s.full_name}</span>
                          </td>
                          <td className="muted-cell mono">{s.national_id}</td>
                          <td className="num">{s.attended}</td>
                          <td className="num">{s.absent}</td>
                          <td>
                            <div className="row" style={{ gap: 10 }}>
                              <span style={{ flex: 1, minWidth: 80 }}>
                                <ProgressBar
                                  value={Number(s.percentage) || 0}
                                  tone={
                                    Number(s.percentage) >= 75
                                      ? 'success'
                                      : Number(s.percentage) >= 50
                                        ? 'warning'
                                        : 'danger'
                                  }
                                />
                              </span>
                              <span
                                className={`percent ${
                                  Number(s.percentage) >= 75 ? 'percent--good' : 'percent--bad'
                                }`}
                              >
                                {s.percentage}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="data-bar" style={{ borderBottom: 0, borderTop: '1px solid var(--line-2)' }}>
              <div>
                <p>
                  <Icon name="info" size={13} /> {lang === 'ar' ? 'تُرسل التحذيرات كإشعارات داخل التطبيق للطلاب المحددين.' : 'Warnings are sent as in-app notifications to the selected students.'}
                </p>
              </div>
              <div className="data-bar__actions">
                <Button
                  variant="danger"
                  size="sm"
                  icon="send"
                  loading={sendingWarnings}
                  disabled={selectedStudents.length === 0 || sendingWarnings}
                  onClick={handleSendWarnings}
                >
                  {lang === 'ar' ? `إرسال إلى ${selectedStudents.length} طالب` : `Send to ${selectedStudents.length} student(s)`}
                </Button>
              </div>
            </div>
          </div>

          {points && (
            <div className="card points-card">
              <div className="data-bar">
                <div>
                  <h2>{lang === 'ar' ? 'سجل البونص والخصم' : 'Bonus & minus ledger'}</h2>
                  <p>
                    {lang === 'ar'
                      ? 'كل النقاط المسجّلة في هذا المقرر وأسماء الطلاب المستحقين لها.'
                      : 'Every point recorded in this course and the students who received it.'}
                  </p>
                </div>
                <div className="data-bar__actions">
                  <Badge variant="success">+{points.totals?.bonus ?? 0}</Badge>
                  <Badge variant="danger">−{points.totals?.penalty ?? 0}</Badge>
                  <Badge variant="neutral">
                    {lang === 'ar' ? 'الصافي' : 'Net'} {points.totals?.net >= 0 ? '+' : '−'}
                    {Math.abs(points.totals?.net ?? 0)}
                  </Badge>
                </div>
              </div>
              <div className="card__body">
                <PointsSummary rows={points.summary || []} totals={points.totals} lang={lang} />
              </div>
              <div className="card__body">
                <h3 className="points-section-title">
                  <Icon name="award" size={16} /> {lang === 'ar' ? 'آخر العمليات' : 'Recent entries'}
                </h3>
                <PointsLedger entries={points.entries || []} onUndo={undoPoint} lang={lang} />
              </div>
            </div>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
