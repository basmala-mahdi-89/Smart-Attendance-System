import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';

export default function HeadDashboard() {
  const { user, logout } = useAuth();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadOverview = async () => {
      try {
        const { data } = await client.get('/head/major/overview');
        if (mounted) setOverview(data);
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadOverview();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <header>
        <h1>Head Dashboard</h1>
        <p>Welcome, {user?.full_name}</p>
        <button onClick={logout}>Logout</button>
      </header>

      {overview && (
        <>
          <section>
            <h2>{overview.major.name}</h2>
            <p>Students: {overview.stats.total_students}</p>
            <p>Courses: {overview.stats.total_courses}</p>
            <p>Sessions: {overview.stats.total_sessions}</p>
          </section>

          <section>
            <h2>Courses ({overview.courses.length})</h2>
            {overview.courses.map(c => (
              <div key={c.id}>
                <h3>{c.course_code} - {c.course_name}</h3>
                <p>Year {c.academic_year} | Students: {c.students}</p>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}