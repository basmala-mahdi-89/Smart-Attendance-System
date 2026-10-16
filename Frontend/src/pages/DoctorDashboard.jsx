import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';

export default function DoctorDashboard() {
  const { user, logout } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      const { data } = await client.get('/doctor/courses');
      setCourses(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <header>
        <h1>Doctor Dashboard</h1>
        <p>Welcome, {user?.full_name}</p>
        <button onClick={logout}>Logout</button>
      </header>

      <section>
        <h2>My Courses ({courses.length})</h2>
        {courses.map(c => (
          <div key={c.id}>
            <h3>{c.course_code} - {c.course_name}</h3>
            <p>Year: {c.academic_year}</p>
            <p>Students: {c.student_count}</p>
            <p>Role: {c.role_in_course}</p>
          </div>
        ))}
      </section>
    </div>
  );
}