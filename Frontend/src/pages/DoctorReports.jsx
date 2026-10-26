import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';

export default function DoctorReports() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const { data } = await client.get('/doctor/courses');
        setCourses(data);
      } catch (err) { console.error(err); }
    };
    fetchCourses();
  }, []);

    const loadReport = async (courseId) => {
    if (!courseId) return;
    setLoading(true);
    try {
      // ⚡ بنكلم المسار الصح
      const { data } = await client.get(`/doctor/courses/${courseId}/report`);
      setReport(data);
    } catch (err) {
      console.error(err);
      alert('Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = async () => {
    if (!selectedCourse) return;
    try {
      const response = await client.get(`/doctor/courses/${selectedCourse}/export`, { responseType: 'blob' });
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

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <header style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Attendance Reports</h1>
        <button onClick={() => navigate('/doctor')} style={{ padding: '8px' }}>← Back to Dashboard</button>
        <button onClick={logout} style={{ padding: '8px' }}>Logout</button>
      </header>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <label>Select Course:</label>
        <select 
          value={selectedCourse} 
          onChange={(e) => {
            setSelectedCourse(e.target.value);
            loadReport(e.target.value);
          }}
          style={{ padding: '10px', minWidth: '300px' }}
        >
          <option value="">-- Choose a course --</option>
          {courses.map(c => (
            <option key={c.id} value={c.id}>{c.course_code} - {c.course_name}</option>
          ))}
        </select>

        <button 
          onClick={downloadCSV} 
          disabled={!selectedCourse}
          style={{ padding: '10px 20px', background: 'green', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
        >
          📥 Export to Excel (CSV)
        </button>
      </div>

      {loading && <p>Loading report...</p>}

      {report && !loading && (
        <section>
          <h2>Report for {report.course.course_code} - {report.course.course_name}</h2>
          <p><b>Total Lectures Held:</b> {report.total_sessions}</p>
          
          <table border="1" cellPadding="10" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginTop: '20px' }}>
            <thead style={{ background: '#f0f0f0' }}>
              <tr>
                <th>Student Name</th>
                <th>National ID</th>
                <th>Attended</th>
                <th>Absent</th>
                <th>Percentage</th>
              </tr>
            </thead>
            <tbody>
              {report.students.map(s => (
                <tr key={s.student_id}>
                  <td>{s.full_name}</td>
                  <td>{s.national_id}</td>
                  <td>{s.attended}</td>
                  <td>{s.absent}</td>
                  <td style={{ color: s.percentage >= 75 ? 'green' : 'red', fontWeight: 'bold' }}>
                    {s.percentage}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}