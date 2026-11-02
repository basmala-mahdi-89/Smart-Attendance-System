import { useRef } from 'react';
import Logo from '../ui/Logo';
import Icon from '../ui/Icon';
import { AnimatedNumber } from '../ui/Motion';
import { useLanguage } from '../../context/LanguageContext';

const points = [
  { icon: 'qr', text: { en: 'Dynamic QR codes that refresh every 5 seconds', ar: 'رموز QR ديناميكية تتجدد كل 5 ثوانٍ' } },
  { icon: 'fingerprint', text: { en: 'Device-bound accounts that stop proxy attendance', ar: 'حسابات مرتبطة بالجهاز تمنع حضور الوسيط' } },
  { icon: 'wifi-off', text: { en: 'Offline personal QR when the network drops', ar: 'رموز QR الشخصية دون اتصال عند انقطاع الشبكة' } },
];

const trust = [
  { icon: 'lock', label: { en: 'JWT secured', ar: 'محمي بـ JWT' } },
  { icon: 'fingerprint', label: { en: 'Device verified', ar: 'متحقق من الجهاز' } },
  { icon: 'shield-check', label: { en: 'Anti-proxy', ar: 'مضاد للوسيط' } },
];

export default function AuthLayout({ children, wide = false }) {
  const cardRef = useRef(null);
  const { lang, toggle } = useLanguage();

  const handlePointer = (event) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${event.clientX - rect.left}px`);
    card.style.setProperty('--my', `${event.clientY - rect.top}px`);
  };

  const resetPointer = () => {
    const card = cardRef.current;
    if (!card) return;
    card.style.removeProperty('--mx');
    card.style.removeProperty('--my');
  };

  return (
    <div className="auth">
      <aside className="auth__brand">
        <div className="auth__deco" aria-hidden="true">
          <span className="auth__orb auth__orb--1" />
          <span className="auth__orb auth__orb--2" />
          <span className="auth__ring" />
        </div>

        <div className="auth__brand-top">
          <Logo variant="white" size="lg" subtitle={lang === 'ar' ? 'منصة الجامعة' : 'University Platform'} />
          <span className="auth__chip">
            <span className="dot-pulse" /> All systems live
          </span>
        </div>

        <div className="auth__brand-body">
          <span className="eyebrow" style={{ color: 'rgba(196,215,242,0.8)' }}>
            <Icon name="sparkles" size={14} /> {lang === 'ar' ? 'ذكي · آمن · في الوقت الفعلي' : 'Smart · Secure · Real-time'}
          </span>
          <h1 className="display" style={{ marginTop: 14 }}>
            {lang === 'ar' ? 'حضور يثبت نفسه.' : <>Attendance that <em>proves itself.</em></>}
          </h1>
          <p>
            {lang === 'ar'
              ? 'منصة واحدة لعميد الكليّة والعميد والطبيب والمهندس والطالب — مع تتبع الجلسات المباشر والتحذيرات التلقائية والحضور غير القابل للتزوير.'
              : 'One platform for deans, heads, doctors, engineers and students — with live session tracking, automatic warnings and tamper-proof check-ins.'}
          </p>

          <ul className="auth__points">
            {points.map((point) => (
              <li key={point.text.en}>
                <span className="auth__point-icon">
                  <Icon name={point.icon} size={18} />
                </span>
                {lang === 'ar' ? point.text.ar : point.text.en}
              </li>
            ))}
          </ul>

          <div className="auth__stage" aria-hidden="true">
            <div className="session-card session-card--main">
              <div className="session-card__head">
                <span className="session-card__course">CS-301 · Database Systems</span>
                <span className="live-badge">
                  <span className="dot-pulse" /> LIVE
                </span>
              </div>
              <div className="session-card__value">
                <AnimatedNumber value={42} /> <small>/ 48 checked in</small>
              </div>
              <div className="session-card__bar">
                <span />
              </div>
              <div className="session-card__foot">
                <span className="avatar-stack">
                  <span>MA</span>
                  <span>SK</span>
                  <span>NH</span>
                  <span>+9</span>
                </span>
                Updated just now · Room B-204
              </div>
            </div>

            <div className="session-card session-card--qr">
              <span className="session-card__icon">
                <Icon name="qr" size={20} />
              </span>
              <div>
                <b>Offline QR verified</b>
                <span>TOTP · expires in 30s</span>
              </div>
              <span className="ok">
                <Icon name="shield-check" size={18} />
              </span>
            </div>
          </div>
        </div>

        <div className="auth__brand-foot">
          <span>
            <Icon name="shield-check" size={15} /> Encrypted & device-verified
          </span>
          <span>© {new Date().getFullYear()} Smart Attendance</span>
        </div>
      </aside>

      <main className="auth__main">
        <button
          type="button"
          onClick={toggle}
          style={{
            position: 'fixed', top: 18, insetInlineEnd: 18, zIndex: 60,
            padding: '8px 14px', borderRadius: 999, border: '1px solid rgba(127,146,179,0.35)',
            background: 'rgba(255,255,255,0.9)', color: '#16233f', fontWeight: 700, cursor: 'pointer',
          }}
        >
          {lang === 'en' ? 'العربية' : 'English'}
        </button>
        <div
          className={`auth__card ${wide ? 'auth__card--wide' : ''}`.trim()}
          ref={cardRef}
          onMouseMove={handlePointer}
          onMouseLeave={resetPointer}
        >
          <div className="auth__mobile-logo">
            <Logo size="md" subtitle={lang === 'ar' ? 'منصة الجامعة' : 'University Platform'} />
          </div>
          {children}
          <div className="auth__trust">
            {trust.map((item) => (
              <span key={item.label.en}>
                <Icon name={item.icon} size={13} /> {lang === 'ar' ? item.label.ar : item.label.en}
              </span>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
