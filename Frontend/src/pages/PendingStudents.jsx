import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';

export default function PendingStudents() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadPending = async () => {
      try {
        const { data } = await client.get('/head/students/pending');
        if (mounted) setStudents(data);
      } catch (err) {
        console.error(err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadPending();

    return () => {
      mounted = false;
    };
  }, []);

  const approveStudent = async (studentId) => {
    setActionLoading(studentId);
    try {
      await client.post(`/head/students/${studentId}/approve`);
      setStudents(prev => prev.filter(s => s.id !== studentId));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  };

  const rejectStudent = async (studentId) => {
    setActionLoading(studentId);
    try {
      await client.post(`/head/students/${studentId}/reject`);
      setStudents(prev => prev.filter(s => s.id !== studentId));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <header style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Pending Students ({students.length})</h1>
        <button onClick={() => navigate('/head')}>← Back to Head</button>
        <button onClick={logout}>Logout</button>
      </header>

      {students.length === 0 ? (
        <p>✅ No pending students. All caught up!</p>
      ) : (
        students.map(s => (
          <div key={s.id} style={{ border: '1px solid #ccc', padding: '15px', margin: '10px 0' }}>
            <h3>{s.full_name}</h3>
            <p>National ID: {s.national_id}</p>
            <p>Email: {s.email}</p>
            <p>Phone: {s.phone}</p>
            <p>Year: {s.academic_year}</p>
            <p>Status: <b>{s.status}</b></p>

            <div style={{ marginTop: '10px' }}>
              <button
                onClick={() => approveStudent(s.id)}
                disabled={actionLoading === s.id}
                style={{ background: 'green', color: 'white', padding: '10px', marginRight: '10px' }}
              >
                {actionLoading === s.id ? '...' : '✅ Approve'}
              </button>
              <button
                onClick={() => rejectStudent(s.id)}
                disabled={actionLoading === s.id}
                style={{ background: 'red', color: 'white', padding: '10px' }}
              >
                ❌ Reject
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}