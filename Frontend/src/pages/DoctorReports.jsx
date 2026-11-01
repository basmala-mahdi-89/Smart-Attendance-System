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

export default function DoctorReports() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

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
      return;
    }
    setLoading(true);
    setSearchTerm('');
    setSelectedStudents([]);
    try {
      const { data } = await client.get(`/doctor/courses/${courseId}/report`);
      setReport(data);
    } catch (err) {
      alert('Failed to load report');
    } finally {
      setLoading(false);
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
      alert('Please select at least one student.');
      return;
    }
    if (!window.confirm(`Send warnings to ${selectedStudents.length} selected student(s)?`)) return;

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
      alert('Failed to download report');
    }
  };

  const filteredStudents =
    report?.students.filter((s) =>
      s.full_name.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

  const belowThreshold = filteredStudents.filter((s) => Number(s.percentage) < 75).length;
  const allSelected =
    filteredStudents.length > 0 && selectedStudents.length === filteredStudents.length;

  const homeLink =
    user?.role === 'head' ? '/head' : user?.role === 'dean' ? '/dean' : '/doctor';
  const homeLabel =
    user?.role === 'head' ? 'Head Overview' : user?.role === 'dean' ? 'Dean Console' : 'Live Session';

  const nav = [
    { key: 'dashboard', label: homeLabel, icon: user?.role === 'dean' ? 'building' : 'home', to: homeLink, section: 'Workspace' },
    { key: 'reports', label: 'Attendance Reports', icon: 'chart' },
    { key: 'signout', label: 'Sign out', icon: 'logout', onClick: logout, section: 'Account' },
  ];

  return (
    <DashboardLayout
      user={user}
      role={user?.role}
      nav={nav}
      activeKey="reports"
      title="Attendance reports"
      crumb="Reports"
      onLogout={logout}
      actions={
        <Button variant="secondary" size="sm" icon="arrow-left" onClick={() => navigate(homeLink)}>
          Back
        </Button>
      }
    >
      <div className="page-head">
        <div className="page-head__text">
          <h1>Course attendance report</h1>
          <p>Inspect attendance per student, export a CSV, or send targeted warnings.</p>
        </div>
        <div className="page-head__actions">
          {report && (
            <Badge variant="blue" dot>
              {report.type === 'section' ? 'Sections' : 'Lectures'} · {report.total_sessions} held
            </Badge>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card__body">
          <div className="toolbar" style={{ alignItems: 'flex-end' }}>
            <div style={{ minWidth: 280, flex: '1 1 320px' }}>
              <Select
                label="Course"
                icon="book"
                value={selectedCourse}
                onChange={(e) => {
                  setSelectedCourse(e.target.value);
                  loadReport(e.target.value);
                }}
              >
                <option value="">Choose a course…</option>
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
              Export CSV
            </Button>
            <Button
              variant="danger"
              icon="alert"
              loading={sendingWarnings}
              disabled={selectedStudents.length === 0 || sendingWarnings}
              onClick={handleSendWarnings}
            >
              Send warning ({selectedStudents.length})
            </Button>
          </div>
        </div>
      </div>

      {loading && <Loader label="Building report…" />}

      {!loading && !report && (
        <div className="card">
          <div className="card__body">
            <EmptyState
              icon="chart"
              title="Select a course to view its report"
              description="Pick one of your courses above to see per-student attendance, export it, or send warnings."
            />
          </div>
        </div>
      )}

      {report && !loading && (
        <div className="stack">
          <div className="kpi-grid stagger">
            <StatCard
              icon="calendar"
              label={report.type === 'section' ? 'Sections held' : 'Lectures held'}
              value={<AnimatedNumber value={report.total_sessions} />}
              meta={`${report.course.course_code} · ${report.course.course_name}`}
              tone="navy"
            />
            <StatCard
              icon="users"
              label="Students in report"
              value={<AnimatedNumber value={filteredStudents.length} />}
              meta={`${selectedStudents.length} selected`}
              tone="blue"
            />
            <StatCard
              icon="alert"
              label="Below 75%"
              value={<AnimatedNumber value={belowThreshold} />}
              meta="Eligible for a warning"
              tone={belowThreshold > 0 ? 'danger' : 'olive'}
            />
          </div>

          <div className="card">
            <div className="data-bar">
              <div>
                <h2>
                  {report.course.course_code} — {report.course.course_name}
                </h2>
                <p>Select students to send them an attendance warning.</p>
              </div>
              <div className="data-bar__actions">
                <div style={{ minWidth: 220 }}>
                  <Input
                    icon="search"
                    placeholder="Search student name…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    aria-label="Search student name"
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
                        aria-label="Select all students"
                        onChange={toggleAll}
                        checked={allSelected}
                      />
                    </th>
                    <th>Student</th>
                    <th>National ID</th>
                    <th>Attended</th>
                    <th>Absent</th>
                    <th style={{ minWidth: 170 }}>Percentage</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan="6">
                        <EmptyState
                          icon="search"
                          title="No students found"
                          description="Try a different name in the search box."
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
                              aria-label={`Select ${s.full_name}`}
                              checked={selected}
                              onChange={() => toggleStudent(s.student_id)}
                            />
                          </td>
                          <td>
                            <span className="strong">{s.full_name}</span>
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
                  <Icon name="info" size={13} /> Warnings are sent as in-app notifications to the
                  selected students.
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
                  Send to {selectedStudents.length} student(s)
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
