import logoNavy from '../../assets/brand/logo-navy.png';
import logoWhite from '../../assets/brand/logo-white.png';

/**
 * Official brand lockup. `variant="white"` for dark surfaces.
 */
export default function Logo({
  variant = 'navy',
  size = 'md',
  showText = true,
  subtitle = 'University Platform',
  className = '',
}) {
  const isWhite = variant === 'white';
  return (
    <span className={`logo ${size !== 'md' ? `logo--${size}` : ''} ${className}`.trim()}>
      <img src={isWhite ? logoWhite : logoNavy} alt="Smart Attendance logo" />
      {showText && (
        <span className="logo__text">
          <span className="logo__name" style={isWhite ? { color: '#fff' } : undefined}>
            Smart Attendance
          </span>
          <span
            className="logo__tag"
            style={isWhite ? { color: 'rgba(255,255,255,0.55)' } : undefined}
          >
            {subtitle}
          </span>
        </span>
      )}
    </span>
  );
}
