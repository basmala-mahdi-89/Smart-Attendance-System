import Icon from './Icon';

export default function Button({
  children,
  variant = 'primary',
  size,
  icon,
  iconRight,
  loading = false,
  block = false,
  className = '',
  type = 'button',
  ...rest
}) {
  const classes = [
    'btn',
    variant !== 'primary' && `btn--${variant}`,
    size && `btn--${size}`,
    block && 'btn--block',
    loading && 'is-loading',
    !children && icon && 'btn--icon',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const iconSize = size === 'sm' ? 15 : size === 'lg' ? 19 : 17;

  return (
    <button type={type} className={classes} {...rest}>
      {loading ? <span className="spinner" aria-hidden="true" /> : icon ? <Icon name={icon} size={iconSize} /> : null}
      {children}
      {iconRight && !loading ? <Icon name={iconRight} size={iconSize} /> : null}
    </button>
  );
}
