import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import { connectSocket, disconnectSocket, getSocket } from '../api/socket';

export default function DoctorDashboard() {
  const { user, logout } = useAuth();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liveUpdates, setLiveUpdates] = useState([]);
  const [activeSession, setActiveSession] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadCourses = async () => {
      try {
        const { data } = await client.get('/doctor/courses');
        if (mounted) setCourses(data);
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadCourses();

    const socket = connectSocket();

    const handleUpdate = (data) => {
      console.log('⚡ Live update:', data);
      setLiveUpdates(prev => [data, ...prev].slice(0, 20));
    };

    socket.on('attendance-update', handleUpdate);

    return () => {
      mounted = false;
      socket.off('attendance-update', handleUpdate);
      disconnectSocket();
    };
  }, []);

  const startSession = async (courseId) => {
    try {
      const { data } = await client.post('/doctor/sessions', { course_id: courseId });
      setActiveSession(data.session);
      
      // Join socket room
      const socket = getSocket();
      if (socket) {
        socket.emit('join-session', data.session.id);
        console.log('Joined session:', data.session.id);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to start session');
    }
  };

  const endSession = async () => {
    if (!activeSession) return;
    try {
      await client.post(`/doctor/sessions/${activeSession.id}/end`);
      
      const socket = getSocket();
      if (socket) {
        socket.emit('leave-session', activeSession.id);
      }
      
      setActiveSession(null);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to end session');
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

      {activeSession && (
        <section style={{ border: '2px solid green', padding: '15px', margin: '15px 0', background: '#e6ffe6' }}>
          <h2>🟢 Active Session</h2>
          <p>Session ID: <b>{activeSession.id}</b></p>
          <p>Course ID: {activeSession.course_id}</p>
          <p>Started: {new Date(activeSession.start_time).toLocaleTimeString()}</p>
          <button onClick={endSession} style={{ background: 'red', color: 'white', padding: '10px' }}>
            End Session
          </button>
        </section>
      )}

      <section>
        <h2>My Courses ({courses.length})</h2>
        {courses.map(c => (
          <div key={c.id} style={{ border: '1px solid #ccc', padding: '15px', margin: '10px 0' }}>
            <h3>{c.course_code} - {c.course_name}</h3>
            <p>Major: {c.major_name}</p>
            <p>Year: {c.academic_year}</p>
            <p>Students: {c.student_count}</p>
            <p>Role: {c.role_in_course}</p>
            
            {!activeSession && (
              <button 
                onClick={() => startSession(c.id)}
                style={{ background: 'green', color: 'white', padding: '10px 20px' }}
              >
                ▶ Start Session
              </button>
            )}
          </div>
        ))}
      </section>

      <section>
        <h2>⚡ Live Attendance Updates ({liveUpdates.length})</h2>
        {liveUpdates.length === 0 ? (
          <p>No live updates yet. Start a session and have a student scan.</p>
        ) : (
          liveUpdates.map((u, i) => (
            <div key={i} style={{ border: '1px solid #ccc', padding: '10px', margin: '5px 0', background: '#f0f8ff' }}>
              <p>👤 <b>{u.full_name}</b></p>
              <p>Method: {u.method}</p>
              <p>Session: {u.session_id}</p>
              <p>Time: {new Date(u.at).toLocaleTimeString()}</p>
            </div>
          ))
        )}
      </section>
    </div>
  );
}