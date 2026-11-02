import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../ui/Logo';
import Icon from '../ui/Icon';
import { useLanguage } from '../../context/LanguageContext';

export const ROLE_LABELS = {
  en: {
    dean: 'Dean',
    head: 'Head of Department',
    doctor: 'Doctor',
    engineer: 'Engineer',
    student: 'Student',
  },
  ar: {
    dean: 'العميد',
    head: 'رئيس القسم',
    doctor: 'الدكتور',
    engineer: 'المهندس',
    student: 'الطالب',
  },
};

export const getRoleLabel = (role, lang = 'en') => ROLE_LABELS[lang]?.[role] || ROLE_LABELS.en[role] || 'Member';

const NAV_I18N = {
  overview: { en: 'Overview', ar: 'نظرة عامة' },
  dashboard: { en: 'Overview', ar: 'نظرة عامة' },
  courses: { en: 'My Courses', ar: 'مقرراتي' },
  'section-courses': { en: 'Section Courses', ar: 'مقررات الجزء' },
  sessions: { en: 'Active Sessions', ar: 'الجلسات النشطة' },
  performance: { en: 'Staff Performance', ar: 'أداء الموظفين' },
  invite: { en: 'Invite Staff', ar: 'مقترح موظفين' },
  invitations: { en: 'Pending Invitations', ar: 'الدعوات المعلقة' },
  students: { en: 'All Students', ar: 'جميع الطلاب' },
  risk: { en: 'High Risk', ar: 'عالي الخطورة' },
  warning: { en: 'Send Warning', ar: 'إرسال تحذير' },
  pending: { en: 'Pending Students', ar: 'الطلاب المنتظرون' },
  'pending-route': { en: 'Pending Students', ar: 'الطلاب المنتظرون' },
  'pending-students': { en: 'Pending Students', ar: 'الطلاب المنتظرون' },
  doctor: { en: 'Doctor View', ar: 'عرض الدكتور' },
  'doctor-route': { en: 'Doctor View', ar: 'عرض الدكتور' },
  head: { en: 'Head Management', ar: 'إدارة رئيس القسم' },
  dean: { en: 'Dean Console', ar: 'لوحة العميد' },
  live: { en: 'Live Section', ar: 'الجزء المباشر' },
  history: { en: 'Session History', ar: 'سجل الجلسات' },
  reports: { en: 'Attendance Reports', ar: 'تقارير الحضور' },
  'reports-route': { en: 'Reports', ar: 'التقارير' },
  attendance: { en: 'Attendance History', ar: 'سجل الحضور' },
  warnings: { en: 'Warnings', ar: 'التحذيرات' },
  'my-warnings': { en: 'My Warnings', ar: 'تحذيراتي' },
  majors: { en: 'Majors', ar: 'التخصصات' },
  broadcast: { en: 'Broadcast Warning', ar: 'تحذير شامل' },
  staff: { en: 'Manage Staff', ar: 'إدارة الموظفين' },
  analytics: { en: 'Analytics', ar: 'التحليلات' },
  audit: { en: 'Audit Logs', ar: 'سجلات التدقيق' },
  scan: { en: 'Scan Session QR', ar: 'مسح رمز QR للجلسة' },
  'personal-qr': { en: 'My Personal QR', ar: 'رمزي الشخصي' },
  signout: { en: 'Sign out', ar: 'تسجيل الخروج' },
};

const SECTION_I18N = {
  Institution: { en: 'Institution', ar: 'المؤسسة' },
  Department: { en: 'Department', ar: 'القسم' },
  People: { en: 'People', ar: 'الأشخاص' },
  Staff: { en: 'Staff', ar: 'الموظفون' },
  Students: { en: 'Students', ar: 'الطلاب' },
  Insights: { en: 'Insights', ar: 'التحليلات' },
  Account: { en: 'Account', ar: 'الحساب' },
  Teaching: { en: 'Teaching', ar: 'التدريس' },
  Management: { en: 'Management', ar: 'الإدارة' },
  'Section control': { en: 'Section control', ar: 'التحكم بالجزء' },
  'Student workspace': { en: 'Student workspace', ar: 'مساحة الطالب' },
  Workspace: { en: 'Workspace', ar: 'مساحة العمل' },
  'Quick actions': { en: 'Quick actions', ar: 'إجراءات سريعة' },
};

const sectionLabel = (section, lang) => {
  if (section && typeof section === 'object') {
    return section[lang] || section.en || '';
  }
  return SECTION_I18N[section]?.[lang] || SECTION_I18N[section]?.en || section;
};

const initialsOf = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'SA';

/**
 * Shared application shell for every role.
 *
 * nav: [{ key, label, icon, count?, onClick?, to?, section? }]
 * The first item of each `section` renders a sidebar group label.
 */
export default function DashboardLayout({
  user,
  role,
  nav = [],
  activeKey,
  title,
  crumb,
  term,
  actions,
  onLogout,
  children,
}) {
  const navigate = useNavigate();
  const { lang, toggle } = useLanguage();
  const t = (value, fallback = value) =>
    value && typeof value === 'object' ? value[lang] || value.en || fallback : value;
  const navLabel = (item) =>
    item.label && typeof item.label === 'object'
      ? item.label[lang] || item.label.en
      : NAV_I18N[item.key]?.[lang] || NAV_I18N[item.key]?.en || item.label;

  const [open, setOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 860 : false
  );

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth <= 860;
      setIsMobile(mobile);
      if (!mobile) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  useEffect(() => {
    if (!isMobile) return undefined;
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open, isMobile]);

  const handleSelect = (item) => {
    setOpen(false);
    if (item.onClick) item.onClick();
    if (item.to) navigate(item.to);
  };

  const roleLabel = getRoleLabel(user?.role || role, lang);
  const fullName = (lang === 'ar' && user?.full_name_ar ? user?.full_name_ar : user?.full_name) || 'Smart Attendance';

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'is-open' : ''}`} aria-label={lang === 'ar' ? 'التنقل الرئيسي' : 'Main navigation'}>
        <div className="sidebar__brand">
          <Logo variant="white" size="sm" subtitle={lang === 'ar' ? 'منصة الحضور' : 'Attendance Platform'} />
          <button
            type="button"
            className="sidebar__close"
            onClick={() => setOpen(false)}
            aria-label={lang === 'ar' ? 'إغلاق التنقل' : 'Close navigation'}
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        {term && (
          <div className="sidebar__term">
            <Icon name="calendar" size={15} />
            {lang === 'ar' ? 'الفصل الدراسي النشط' : 'Active term'}
            <strong>{term}</strong>
          </div>
        )}

        <nav className="sidebar__nav" style={{ paddingTop: 10 }}>
          {nav.map((item, index) => {
            const showSection = item.section && sectionLabel(item.section, lang) !== sectionLabel(nav[index - 1]?.section, lang);
            return (
              <div key={item.key} style={{ display: 'contents' }}>
                {showSection && <div className="sidebar__section">{sectionLabel(item.section, lang)}</div>}
                <button
                  type="button"
                  className={`nav-item ${activeKey === item.key ? 'is-active' : ''}`.trim()}
                  onClick={() => handleSelect(item)}
                  aria-current={activeKey === item.key ? 'page' : undefined}
                >
                  <Icon name={item.icon || 'home'} size={18} />
                  <span>{navLabel(item)}</span>
                  {item.count > 0 && <span className="nav-item__count">{item.count}</span>}
                </button>
              </div>
            );
          })}
        </nav>

        <div className="sidebar__spacer" />

        <div className="sidebar__user">
          <span className="avatar">{initialsOf(fullName)}</span>
          <div className="sidebar__user-info">
            <div className="sidebar__user-name" title={fullName}>
              {fullName}
            </div>
            <div className="sidebar__user-role">{roleLabel}</div>
          </div>
          {onLogout && (
            <button
              type="button"
              className="sidebar__logout"
              onClick={onLogout}
              title={lang === 'ar' ? 'تسجيل الخروج' : 'Sign out'}
              aria-label={lang === 'ar' ? 'تسجيل الخروج' : 'Sign out'}
            >
              <Icon name="logout" size={17} />
            </button>
          )}
        </div>
      </aside>

      {open && <div className="sidebar-scrim" onClick={() => setOpen(false)} aria-hidden="true" />}

      <div className="main">
        <header className="topbar">
          <button
            type="button"
            className="btn btn--icon btn--ghost topbar__menu"
            onClick={() => setOpen((value) => !value)}
            aria-label={lang === 'ar' ? 'فتح التنقل' : 'Toggle navigation'}
            aria-expanded={open}
          >
            <Icon name={open ? 'x' : 'menu'} size={19} />
          </button>

          <div style={{ minWidth: 0 }}>
            {crumb && <div className="topbar__crumb">{t(crumb)}</div>}
            <div className="topbar__title">{t(title)}</div>
          </div>

          <div className="topbar__spacer" />
          <div className="topbar__actions">
            {actions}
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={toggle}
              title={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
              aria-label={lang === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
              style={{ fontWeight: 700 }}
            >
              {lang === 'ar' ? 'EN' : 'عربي'}
            </button>
            <span className="avatar" title={`${fullName} · ${roleLabel}`}>
              {initialsOf(fullName)}
            </span>
          </div>
        </header>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}
