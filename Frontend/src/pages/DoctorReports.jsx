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
  
  // ⚡ حالة البحث
  const [searchTerm, setSearchTerm] = useState('');

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
    if (!courseId) {
      setReport(null);
      return;
    }
    setLoading(true);
    setSearchTerm(''); // بنصفّر البحث لما يغير الكورس
    try {
      const { data } = await client.get(`/doctor/courses/${courseId}/report`);
      setReport(data);
    } catch (err) {
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

  // ⚡ فلترة الطلاب بناءً على كلمة البحث
  const filteredStudents = report?.students.filter(s => 
    s.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <header style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Attendance Reports</h1>
        <button onClick={() => navigate('/doctor')} style={{ padding: '8px', cursor: 'pointer' }}>← Back to Dashboard</button>
        <button onClick={logout} style={{ padding: '8px', cursor: 'pointer' }}>Logout</button>
      </header>

      <div style={{ marginBottom: '20px', display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label style={{ marginRight: '10px' }}>Select Course:</label>
          <select 
            value={selectedCourse} 
            onChange={(e) => {
              setSelectedCourse(e.target.value);
              loadReport(e.target.value);
            }}
            style={{ padding: '10px', minWidth: '300px', borderRadius: '5px', border: '1px solid #ccc' }}
          >
            <option value="">-- Choose a course --</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.course_code} - {c.course_name}</option>
            ))}
          </select>
        </div>

        <button 
          onClick={downloadCSV} 
          disabled={!selectedCourse || !report}
          style={{ padding: '10px 20px', background: 'green', color: 'white', border: 'none', borderRadius: '5px', cursor: selectedCourse ? 'pointer' : 'not-allowed', opacity: selectedCourse ? 1 : 0.5 }}
        >
          📥 Export to Excel (CSV)
        </button>
      </div>

      {loading && <p>Loading report...</p>}

      {report && !loading && (
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <div>
              <h2>Report for {report.course.course_code} - {report.course.course_name}</h2>
              <p><b>Total Lectures Held:</b> {report.total_sessions}</p>
            </div>
            
            {/* ⚡ مربع البحث */}
            <div>
              <input 
                type="text" 
                placeholder="🔍 Search by student name..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ padding: '10px', width: '250px', borderRadius: '5px', border: '1px solid #ccc', fontSize: '14px' }}
              />
            </div>
          </div>
          
          <table border="1" cellPadding="10" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
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
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '20px', color: 'gray' }}>
                    {searchTerm ? 'No students found matching your search.' : 'No students enrolled yet.'}
                  </td>
                </tr>
              ) : (
                filteredStudents.map(s => (
                  <tr key={s.student_id}>
                    <td>{s.full_name}</td>
                    <td>{s.national_id}</td>
                    <td>{s.attended}</td>
                    <td>{s.absent}</td>
                    <td style={{ color: s.percentage >= 75 ? 'green' : 'red', fontWeight: 'bold' }}>
                      {s.percentage}%
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}