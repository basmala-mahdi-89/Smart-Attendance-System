import { useEffect, useRef, useState } from 'react';

/**
 * Scroll-reveal wrapper. Adds `.is-visible` when the element enters the viewport.
 * Usage: <Reveal delay={120}>...</Reveal>
 */
export function Reveal({ children, delay = 0, className = '', as: Tag = 'div', once = true, threshold = 0.15 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) observer.unobserve(node);
        } else if (!once) {
          setVisible(false);
        }
      },
      { threshold }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [once, threshold]);

  return (
    <Tag
      ref={ref}
      className={`reveal ${visible ? 'is-visible' : ''} ${className}`.trim()}
      style={{ '--reveal-delay': `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}

/**
 * Count-up number. Great for dashboard KPIs.
 * Usage: <AnimatedNumber value={92} suffix="%" />
 */
export function AnimatedNumber({ value = 0, duration = 900, decimals = 0, suffix = '', prefix = '' }) {
  const [display, setDisplay] = useState(0);
  const frame = useRef(null);

  useEffect(() => {
    const target = Number(value) || 0;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

    if (reduced) {
      setDisplay(target);
      return undefined;
    }

    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(target * eased);
      if (progress < 1) frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [value, duration]);

  return (
    <span>
      {prefix}
      {display.toFixed(decimals)}
      {suffix}
    </span>
  );
}

/**
 * Simple progress bar with animated fill.
 */
export function ProgressBar({ value = 0, tone = 'blue', showLabel = false, label }) {
  const safe = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="progress">
      <div className={`progress__track progress__track--${tone}`}>
        <span className="progress__fill" style={{ width: `${safe}%` }} />
      </div>
      {showLabel && <span className="progress__label">{label ?? `${Math.round(safe)}%`}</span>}
    </div>
  );
}
