import { useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';

/**
 * Small real-time clock shown in the topbar.
 * Updates once per second and follows the app language (ar/en).
 * Decorative motion (pulsing dot) is disabled with prefers-reduced-motion.
 */
export default function LiveClock({ showSeconds = true, showDate = true, className = '' }) {
  const { lang } = useLanguage();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const ar = lang === 'ar';
  const locale = ar ? 'ar-EG' : 'en-GB';

  const time = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...(showSeconds ? { second: '2-digit' } : {}),
  }).format(now);

  const date = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(now);

  return (
    <span
      className={`live-clock ${className}`.trim()}
      role="timer"
      aria-label={`${ar ? 'الوقت الآن' : 'Current time'} ${time}${showDate ? ` — ${date}` : ''}`}
      title={date}
    >
      <span className="live-clock__dot" aria-hidden="true" />
      <time className="live-clock__time" dateTime={now.toISOString()}>
        {time}
      </time>
      {showDate && <span className="live-clock__date">{date}</span>}
    </span>
  );
}
