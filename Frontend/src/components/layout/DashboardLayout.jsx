import { useEffect, useRef, useState } from 'react';
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
    dean: 'عميد الكلية',
    head: 'رئيس القسم',
    doctor: 'دكتور',
    engineer: 'مهندس',
    student: 'طالب',
  },
};

export const getRoleLabel = (role, lang = 'en') => ROLE_LABELS[lang]?.[role] || ROLE_LABELS.en[role] || 'Member';

const NAV_I18N = {
  overview: { en: 'Overview', ar: 'نظرة عامة' },
  dashboard: { en: 'Overview', ar: 'نظرة عامة' },
  courses: { en: 'My Courses', ar: 'موادي' },
  'section-courses': { en: 'Section Courses', ar: 'مواد السكشن' },
  sessions: { en: 'Active Sessions', ar: 'الجلسات النشطة' },
  performance: { en: 'Staff Performance', ar: 'أداء الموظفين' },
  invite: { en: 'Invite Staff', ar: 'دعوة موظف' },
  invitations: { en: 'Pending Invitations', ar: 'الدعوات المعلقة' },
  students: { en: 'All Students', ar: 'جميع الطلاب' },
  risk: { en: 'High Risk', ar: 'طلاب معرضون للخطر' },
  warning: { en: 'Send Warning', ar: 'إرسال تحذير' },
  pending: { en: 'Pending Students', ar: 'الطلاب المنتظرون' },
  'pending-route': { en: 'Pending Students', ar: 'الطلاب المنتظرون' },
  'pending-students': { en: 'Pending Students', ar: 'الطلاب المنتظرون' },
  doctor: { en: 'Doctor View', ar: 'عرض الدكتور' },
  'doctor-route': { en: 'Doctor View', ar: 'عرض الدكتور' },
  head: { en: 'Head Management', ar: 'إدارة رئيس القسم' },
  dean: { en: 'Dean Console', ar: 'لوحة العميد' },
  live: { en: 'Live Section', ar: 'السكشن المباشر' },
  history: { en: 'Session History', ar: 'سجل الجلسات' },
  reports: { en: 'Attendance Reports', ar: 'تقارير الحضور' },
  'reports-route': { en: 'Reports', ar: 'التقارير' },
  attendance: { en: 'Attendance History', ar: 'سجل الحضور' },
  warnings: { en: 'Warnings', ar: 'التحذيرات' },
  'my-warnings': { en: 'My Warnings', ar: 'تحذيراتي' },
  majors: { en: 'Majors', ar: 'التخصصات' },
  broadcast: { en: 'Broadcast Warning', ar: 'تحذير عام' },
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
  People: { en: 'People', ar: 'الأفراد' },
  Staff: { en: 'Staff', ar: 'الموظفون' },
  Students: { en: 'Students', ar: 'الطلاب' },
  Insights: { en: 'Insights', ar: 'التحليلات' },
  Account: { en: 'Account', ar: 'الحساب' },
  Teaching: { en: 'Teaching', ar: 'التدريس' },
  Management: { en: 'Management', ar: 'الإدارة' },
  'Section control': { en: 'Section control', ar: 'التحكم في السكشن' },
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

const STATUS_META = {
  active: { en: 'Active account', ar: 'حساب نشط', variant: 'success' },
  pending: { en: 'Pending approval', ar: 'بانتظار الموافقة', variant: 'warning' },
  banned: { en: 'Account blocked', ar: 'حساب موقوف', variant: 'danger' },
};

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
  const contentRef = useRef(null);
  const profileRef = useRef(null);
  const t = (value, fallback = value) =>
    value && typeof value === 'object' ? value[lang] || value.en || fallback : value;
  const navLabel = (item) =>
    item.label && typeof item.label === 'object'
      ? item.label[lang] || item.label.en
      : NAV_I18N[item.key]?.[lang] || NAV_I18N[item.key]?.en || item.label;
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 860 : false
  );

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 6);
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  // Replay the page transition whenever the active section changes.
  useEffect(() => {
    const node = contentRef.current;
    if (!node) return;
    node.classList.remove('content--enter');
    void node.offsetWidth;
    node.classList.add('content--enter');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setProfileOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

  useEffect(() => {
    if (!title) return undefined;
    const previous = document.title;
    document.title = `${t(title)} · Smart Attendance`;
    return () => {
      document.title = previous;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, lang]);

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth <= 860;
      setIsMobile(mobile);
      if (!mobile) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setProfileOpen(false);
      }
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  // Dismiss the profile card on an outside click.
  useEffect(() => {
    if (!profileOpen) return undefined;
    const onPointerDown = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
    };
  }, [profileOpen]);

  useEffect(() => {
    if (!isMobile) return undefined;
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open, isMobile]);

  const handleSelect = (item) => {
    setOpen(false);
    setProfileOpen(false);
    if (item.onClick) item.onClick();
    if (item.to) navigate(item.to);
  };

  const ar = lang === 'ar';
  const roleLabel = getRoleLabel(user?.role || role, lang);
  const fullName =
    (ar && user?.full_name_ar ? user?.full_name_ar : user?.full_name) || 'Smart Attendance';
  const isStudent = (user?.role || role) === 'student';
  const isDean = (user?.role || role) === 'dean';
  const status = STATUS_META[user?.status] || STATUS_META.active;

  const detailRows = [
    {
      icon: 'mail',
      label: ar ? 'البريد الإلكتروني' : 'Email',
      value: user?.email || '—',
    },
    {
      icon: 'building',
      label: isStudent ? (ar ? 'التخصص' : 'Major') : ar ? 'القسم' : 'Department',
      value: isDean
        ? ar
          ? 'كل الأقسام'
          : 'All departments'
        : user?.major_name || (ar ? 'لم يُحدَّد بعد' : 'Not assigned yet'),
    },
    ...(isStudent
      ? [
          {
            icon: 'graduation-cap',
            label: ar ? 'السنة الدراسية' : 'Academic year',
            value: user?.academic_year
              ? ar
                ? `السنة ${user.academic_year}`
                : `Year ${user.academic_year}`
              : ar
                ? 'غير متاحة'
                : 'Not available',
          },
          ...(user?.phone
            ? [
                {
                  icon: 'smartphone',
                  label: ar ? 'رقم الهاتف' : 'Phone',
                  value: user.phone,
                },
              ]
            : []),
        ]
      : [
          {
            icon: 'shield-check',
            label: ar ? 'مستوى الصلاحية' : 'Access level',
            value: roleLabel,
          },
        ]),
    {
      icon: 'calendar',
      label: ar ? 'عضو منذ' : 'Member since',
      value: user?.created_at
        ? new Date(user.created_at).toLocaleDateString(ar ? 'ar-EG' : 'en-GB', {
            month: 'short',
            year: 'numeric',
          })
        : '—',
    },
  ];

  const profileCard = profileOpen && (
    <div className="profile-pop" role="dialog" aria-label={ar ? 'ملفك الشخصي' : 'Your profile'}>
      <div className="profile-pop__glow" aria-hidden="true" />
      <div className="profile-pop__head">
        <span className="avatar avatar--lg avatar--ring">{initialsOf(fullName)}</span>
        <div className="profile-pop__identity">
          <strong title={fullName}>{fullName}</strong>
          <span className="profile-pop__role">
            <Icon name={isStudent ? 'graduation-cap' : 'shield'} size={13} /> {roleLabel}
          </span>
          <span className={`badge badge--${status.variant} badge--dot profile-pop__status`}>
            {ar ? status.ar : status.en}
          </span>
        </div>
        <button
          type="button"
          className="profile-pop__close"
          onClick={() => setProfileOpen(false)}
          aria-label={ar ? 'إغلاق الملف الشخصي' : 'Close profile'}
        >
          <Icon name="x" size={15} />
        </button>
      </div>

      <div className="profile-pop__body">
        {detailRows.map((row) => (
          <div className="profile-row" key={row.label}>
            <span className="profile-row__icon">
              <Icon name={row.icon} size={16} />
            </span>
            <span className="profile-row__text">
              <span className="profile-row__label">{row.label}</span>
              <span className={`profile-row__value ${row.mono ? 'profile-row__value--mono' : ''}`.trim()}>
                {row.value}
              </span>
            </span>
          </div>
        ))}
      </div>

      <div className="profile-pop__foot">
        <span className="profile-pop__hint">
          <Icon name="lock" size={13} /> {ar ? 'جلسة محمية بـ JWT' : 'JWT secured session'}
        </span>
        {onLogout && (
          <button type="button" className="btn btn--danger btn--sm" onClick={onLogout}>
            <Icon name="logout" size={15} /> {ar ? 'تسجيل الخروج' : 'Sign out'}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="shell">
      <a className="skip-link" href="#main-content">
        {ar ? 'تخطَّ إلى المحتوى' : 'Skip to content'}
      </a>
      <aside className={`sidebar ${open ? 'is-open' : ''}`} aria-label={ar ? 'التنقل الرئيسي' : 'Main navigation'}>
        <div className="sidebar__brand">
          <Logo variant="white" size="sm" subtitle={ar ? 'منصة الحضور' : 'Attendance Platform'} />
          <button
            type="button"
            className="sidebar__close"
            onClick={() => setOpen(false)}
            aria-label={ar ? 'إغلاق التنقل' : 'Close navigation'}
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        {term && (
          <div className="sidebar__term">
            <Icon name="calendar" size={15} />
            {ar ? 'الفصل الدراسي النشط' : 'Active term'}
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
          <button
            type="button"
            className="sidebar__user-main"
            onClick={() => {
              setProfileOpen((value) => !value);
              setOpen(false);
            }}
            aria-expanded={profileOpen}
            aria-haspopup="dialog"
            title={`${fullName} · ${roleLabel}`}
          >
            <span className="avatar">{initialsOf(fullName)}</span>
            <span className="sidebar__user-info">
              <span className="sidebar__user-name" title={fullName}>
                {fullName}
              </span>
              <span className="sidebar__user-role">{roleLabel}</span>
            </span>
          </button>
          {onLogout && (
            <button
              type="button"
              className="sidebar__logout"
              onClick={onLogout}
              title={ar ? 'تسجيل الخروج' : 'Sign out'}
              aria-label={ar ? 'تسجيل الخروج' : 'Sign out'}
            >
              <Icon name="logout" size={17} />
            </button>
          )}
        </div>
      </aside>

      {open && <div className="sidebar-scrim" onClick={() => setOpen(false)} aria-hidden="true" />}

      <div className="main">
        <header className={`topbar ${scrolled ? 'is-scrolled' : ''}`.trim()}>
          <button
            type="button"
            className="btn btn--icon btn--ghost topbar__menu"
            onClick={() => setOpen((value) => !value)}
            aria-label={ar ? 'فتح التنقل' : 'Toggle navigation'}
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
              title={ar ? 'Switch to English' : 'التبديل إلى العربية'}
              aria-label={ar ? 'Switch to English' : 'التبديل إلى العربية'}
              style={{ fontWeight: 700 }}
            >
              {ar ? 'EN' : 'عربي'}
            </button>
            <div className="topbar__profile" ref={profileRef}>
              <button
                type="button"
                className={`avatar avatar--button ${profileOpen ? 'is-open' : ''}`.trim()}
                onClick={() => setProfileOpen((value) => !value)}
                aria-expanded={profileOpen}
                aria-haspopup="dialog"
                aria-label={ar ? 'افتح ملفك الشخصي' : 'Open your profile'}
                title={`${fullName} · ${roleLabel}`}
              >
                {initialsOf(fullName)}
                <span className="avatar__status" aria-hidden="true" />
              </button>
              {profileCard}
            </div>
          </div>
          <span
            className="scroll-progress"
            style={{ transform: `scaleX(${progress})` }}
            aria-hidden="true"
          />
        </header>

        <main className="content" id="main-content" tabIndex={-1} ref={contentRef}>
          {children}

          <footer className="app-footer">
            <span>
              © {new Date().getFullYear()} Smart Attendance ·{' '}
              {ar ? 'جميع الحقوق محفوظة' : 'All rights reserved'} ·{' '}
              <strong className="app-footer__brand">Juliana.89</strong> 🎈
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
