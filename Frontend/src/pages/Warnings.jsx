import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import { getMyWarnings } from '../api/students';
import DashboardLayout from '../components/layout/DashboardLayout';
import Button from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import { Badge, EmptyState, Loader } from '../components/ui/Feedback';
import { useLanguage } from '../context/LanguageContext';

export default function Warnings() {
  const { user, logout } = useAuth();
  const { lang } = useLanguage();
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
      <DashboardLayout user={user} role="student" nav={nav} activeKey="warnings" title={{ en: 'Warnings', ar: 'التحذيرات' }} crumb={{ en: 'Student · Warnings', ar: 'الطالب · التحذيرات' }} onLogout={logout}>
        <Loader label={lang === 'ar' ? 'جارٍ تحميل التحذيرات…' : 'Loading warnings…'} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={user} role="student" nav={nav} activeKey="warnings" title={{ en: 'Warnings', ar: 'التحذيرات' }} crumb={{ en: 'Student · Warnings', ar: 'الطالب · التحذيرات' }} onLogout={logout}>
      <div className="card">
        <div className="data-bar">
          <div>
            <h2>{lang === 'ar' ? 'تحذيراتي' : 'My warnings'}</h2>
            <p>{warnings.length} {lang === 'ar' ? 'تحذير' : 'warning(s)'}.</p>
          </div>
          <Badge variant={warnings.length > 0 ? 'danger' : 'success'}>{warnings.length}</Badge>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{lang === 'ar' ? 'المقرر' : 'Course'}</th>
                <th>{lang === 'ar' ? 'المستوى' : 'Level'}</th>
                <th>{lang === 'ar' ? 'نسبة الغياب' : 'Absence %'}</th>
                <th>{lang === 'ar' ? 'الحد المسموح' : 'Max allowed'}</th>
                <th>{lang === 'ar' ? 'أُرسل في' : 'Sent at'}</th>
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
                    <Badge variant={w.level >= 2 ? 'danger' : 'warning'}>{lang === 'ar' ? `المستوى ${w.level}` : `Level ${w.level}`}</Badge>
                  </td>
                  <td className="num">{Number(w.absence_percentage).toFixed(1)}%</td>
                  <td className="num">{w.max_allowed}%</td>
                  <td className="muted-cell nowrap">{w.sent_at ? new Date(w.sent_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
              {warnings.length === 0 && (
                <tr>
                  <td colSpan="5">
                    <EmptyState icon="check-circle" title={lang === 'ar' ? 'لا توجد تحذيرات' : 'No warnings'} description={lang === 'ar' ? 'لا توجد لديك تحذيرات حضور.' : 'You have no attendance warnings.'} />
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