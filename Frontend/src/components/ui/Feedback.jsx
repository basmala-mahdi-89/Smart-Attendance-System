import Icon from './Icon';

const alertIcons = {
  error: 'alert',
  success: 'check-circle',
  info: 'info',
  warning: 'alert',
};

export function Alert({ variant = 'info', children, className = '' }) {
  return (
    <div className={`alert alert--${variant} ${className}`.trim()} role={variant === 'error' ? 'alert' : 'status'}>
      <Icon name={alertIcons[variant] || 'info'} size={18} />
      <span>{children}</span>
    </div>
  );
}

export function Badge({ variant = 'default', dot = false, children, className = '' }) {
  return (
    <span
      className={`badge ${variant !== 'default' ? `badge--${variant}` : ''} ${dot ? 'badge--dot' : ''} ${className}`.trim()}
    >
      {children}
    </span>
  );
}

export function Spinner({ size = 'md' }) {
  return <span className={`spinner ${size === 'lg' ? 'spinner--lg' : ''}`.trim()} aria-hidden="true" />;
}

export function Loader({ label = 'Loading…' }) {  return (
    <div className="loader">
      <span className="spinner spinner--lg" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ icon = 'file', title, description, action }) {
  return (
    <div className="empty">
      {icon && (
        <span className="empty__icon">
          <Icon name={icon} size={26} />
        </span>
      )}
      {title && <h3>{title}</h3>}
      {description && <p>{description}</p>}
      {action && <div className="empty__action">{action}</div>}
    </div>
  );
}

export function StatCard({ icon, label, value, meta, tone = 'default', className = '' }) {
  return (
    <div className={`stat ${tone !== 'default' ? `stat--${tone}` : ''} ${className}`.trim()}>
      {icon && (
        <span className="stat__icon">
          <Icon name={icon} size={22} />
        </span>
      )}
      <div>
        <div className="stat__label">{label}</div>
        <div className="stat__value">{value}</div>
        {meta && <div className="stat__meta">{meta}</div>}
      </div>
    </div>
  );
}

export function Skeleton({ width = '100%', height = 14, radius = 8, className = '' }) {
  return (
    <span
      className={`skeleton ${className}`.trim()}
      style={{ display: 'block', width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}
