import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import * as studentApi from '../api/students';

export default function StudentDashboard() {
  const { logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [courses, setCourses] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        const [p, c, w] = await Promise.all([
          studentApi.getMyProfile(),
          studentApi.getMyCourses(),
          studentApi.getMyWarnings()
        ]);
        if (mounted) {
          setProfile(p);
          setCourses(c);
          setWarnings(w);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <header>
        <h1>Student Dashboard</h1>
        <p>Welcome, {profile?.full_name}</p>
        <button onClick={logout}>Logout</button>
      </header>

      <section>
        <h2>My Profile</h2>
        <p>National ID: {profile?.national_id}</p>
        <p>Email: {profile?.email}</p>
        <p>Major: {profile?.major_name}</p>
        <p>Academic Year: {profile?.academic_year}</p>
      </section>

      <section>
        <h2>My Courses ({courses.length})</h2>
        {courses.map(c => (
          <div key={c.id}>
            <h3>{c.course_code} - {c.course_name}</h3>
            <p>Attended: {c.attended_sessions} / {c.total_sessions}</p>
          </div>
        ))}
      </section>

      <section>
        <h2>Warnings ({warnings.length})</h2>
        {warnings.map(w => (
          <div key={w.id}>
            <p>Level {w.level} - {w.course_code}</p>
            <p>Absence: {w.absence_percentage}%</p>
          </div>
        ))}
      </section>
    </div>
  );
}