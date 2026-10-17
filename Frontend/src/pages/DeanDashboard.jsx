import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';

export default function DeanDashboard() {
  const { user, logout } = useAuth();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadOverview = async () => {
      try {
        const { data } = await client.get('/dean/overview');
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
        <h1>Dean Dashboard</h1>
        <p>Welcome, {user?.full_name}</p>
        <button onClick={logout}>Logout</button>
      </header>

      {overview && (
        <>
          <section>
            <h2>Overview</h2>
            <p>Majors: {overview.stats.total_majors}</p>
            <p>Heads: {overview.stats.total_heads}</p>
            <p>Doctors: {overview.stats.total_doctors}</p>
            <p>Students: {overview.stats.total_students}</p>
            <p>Courses: {overview.stats.total_courses}</p>
            <p>Sessions: {overview.stats.total_sessions}</p>
          </section>

          <section>
            <h2>Majors ({overview.majors.length})</h2>
            {overview.majors.map(m => (
              <div key={m.id}>
                <h3>{m.name}</h3>
                <p>Students: {m.students} | Courses: {m.courses}</p>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}