import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import { getMyWarnings } from '../api/students';
import DashboardLayout from '../components/layout/DashboardLayout';
import Button from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import { Badge, EmptyState, Loader } from '../components/ui/Feedback';

export default function Warnings() {
  const { user, logout } = useAuth();
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getMyWarnings();
        setWarnings(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const nav = [
    { key: 'dashboard', label: 'Dashboard', icon: 'home', to: '/student' },
    { key: 'warnings', label: 'Warnings', icon: 'alert-triangle' },
    { key: 'signout', label: 'Sign out', icon: 'logout', onClick: logout, section: 'Account' },
  ];

  if (loading) {
    return (
      <DashboardLayout user={user} role="student" nav={nav} activeKey="warnings" title="Warnings" crumb="Student · Warnings" onLogout={logout}>
        <Loader label="Loading warnings…" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={user} role="student" nav={nav} activeKey="warnings" title="Warnings" crumb="Student · Warnings" onLogout={logout}>
      <div className="card">
        <div className="data-bar">
          <div>
            <h2>My warnings</h2>
            <p>{warnings.length} warning(s) received.</p>
          </div>
          <Badge variant={warnings.length > 0 ? 'danger' : 'success'}>{warnings.length}</Badge>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Course</th>
                <th>Level</th>
                <th>Absence %</th>
                <th>Max allowed</th>
                <th>Sent at</th>
              </tr>
            </thead>
            <tbody>
              {warnings.map((w) => (
                <tr key={w.id}>
                  <td>
                    <b>{w.course_code}</b>
                    <span className="muted-cell"> — {w.course_name}</span>
                  </td>
                  <td>
                    <Badge variant={w.level >= 2 ? 'danger' : 'warning'}>Level {w.level}</Badge>
                  </td>
                  <td className="num">{Number(w.absence_percentage).toFixed(1)}%</td>
                  <td className="num">{w.max_allowed}%</td>
                  <td className="muted-cell nowrap">{w.sent_at ? new Date(w.sent_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
              {warnings.length === 0 && (
                <tr>
                  <td colSpan="5">
                    <EmptyState icon="check-circle" title="No warnings" description="You have no attendance warnings." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}