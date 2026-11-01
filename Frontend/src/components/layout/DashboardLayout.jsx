import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../ui/Logo';
import Icon from '../ui/Icon';

export const ROLE_LABEL = {
  dean: 'Dean',
  head: 'Head of Department',
  doctor: 'Doctor',
  engineer: 'Engineer',
  student: 'Student',
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

  const roleLabel = ROLE_LABEL[user?.role] || ROLE_LABEL[role] || 'Member';
  const fullName = user?.full_name || 'Smart Attendance';

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'is-open' : ''}`} aria-label="Main navigation">
        <div className="sidebar__brand">
          <Logo variant="white" size="sm" subtitle="Attendance Platform" />
          <button
            type="button"
            className="sidebar__close"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        {term && (
          <div className="sidebar__term">
            <Icon name="calendar" size={15} />
            Active term
            <strong>{term}</strong>
          </div>
        )}

        <nav className="sidebar__nav" style={{ paddingTop: 10 }}>
          {nav.map((item, index) => {
            const showSection = item.section && item.section !== nav[index - 1]?.section;
            return (
              <div key={item.key} style={{ display: 'contents' }}>
                {showSection && <div className="sidebar__section">{item.section}</div>}
                <button
                  type="button"
                  className={`nav-item ${activeKey === item.key ? 'is-active' : ''}`.trim()}
                  onClick={() => handleSelect(item)}
                  aria-current={activeKey === item.key ? 'page' : undefined}
                >
                  <Icon name={item.icon || 'home'} size={18} />
                  <span>{item.label}</span>
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
              title="Sign out"
              aria-label="Sign out"
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
            aria-label="Toggle navigation"
            aria-expanded={open}
          >
            <Icon name={open ? 'x' : 'menu'} size={19} />
          </button>

          <div style={{ minWidth: 0 }}>
            {crumb && <div className="topbar__crumb">{crumb}</div>}
            <div className="topbar__title">{title}</div>
          </div>

          <div className="topbar__spacer" />
          <div className="topbar__actions">
            {actions}
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
