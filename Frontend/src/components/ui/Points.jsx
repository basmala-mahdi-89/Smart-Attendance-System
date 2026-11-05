import { useEffect, useState } from 'react';
import Icon from './Icon';
import Button from './Button';
import { Input } from './Field';
import { useLanguage } from '../../context/LanguageContext';

const QUICK_VALUES = [1, 2, 3, 5];

const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'ST';

const studentName = (entry, lang) =>
  (lang === 'ar' && entry?.full_name_ar) || entry?.full_name || '';

const whenLabel = (value, lang) => {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
};

export function PointActions({ onAward, disabled = false, lang }) {
  return (
    <div className="point-actions">
      <button
        type="button"
        className="point-btn point-btn--bonus"
        disabled={disabled}
        onClick={() => onAward('bonus')}
        title={lang === 'ar' ? 'منح بونص لهذا الطالب' : 'Give a bonus to this student'}
      >
        <Icon name="plus" size={13} />
        <span>{lang === 'ar' ? 'بونص' : 'Bonus'}</span>
      </button>
      <button
        type="button"
        className="point-btn point-btn--penalty"
        disabled={disabled}
        onClick={() => onAward('penalty')}
        title={lang === 'ar' ? 'تسجيل خصم لهذا الطالب' : 'Record a minus for this student'}
      >
        <Icon name="minus" size={13} />
        <span>{lang === 'ar' ? 'خصم' : 'Minus'}</span>
      </button>
    </div>
  );
}

export function PointsModal({ open, student, mode = 'bonus', onClose, onConfirm, busy = false, lang }) {
  const { lang: ctxLang } = useLanguage();
  const activeLang = lang || ctxLang;
  const [points, setPoints] = useState(1);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) {
      setPoints(1);
      setReason('');
    }
  }, [open, student?.student_id, student?.id, mode]);

  if (!open || !student) return null;

  const isBonus = mode === 'bonus';
  const name = studentName(student, activeLang);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal modal--sm points-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="points-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <div>
            <h2 id="points-modal-title">
              {isBonus
                ? activeLang === 'ar'
                  ? 'منح بونص للطالب'
                  : 'Give the student a bonus'
                : activeLang === 'ar'
                  ? 'تسجيل خصم للطالب'
                  : 'Record a minus for the student'}
            </h2>
            <p>
              {activeLang === 'ar'
                ? 'النقاط تُسجَّل باسمك وتظهر للطالب فورًا.'
                : 'The entry is saved under your name and appears to the student instantly.'}
            </p>
          </div>
          <button
            type="button"
            className="modal__close"
            aria-label={activeLang === 'ar' ? 'إغلاق' : 'Close'}
            onClick={onClose}
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="modal__body">
          <div className={`points-modal__student points-modal__student--${mode}`}>
            <span className="avatar" style={{ width: 42, height: 42, fontSize: '0.82rem' }}>
              {initials(name)}
            </span>
            <div>
              <b>{name}</b>
              <span>
                {student.course_code || ''}
                {student.course_code ? ' · ' : ''}
                {activeLang === 'ar' ? 'الطالب' : 'Student'}
              </span>
            </div>
            <span className={`points-chip points-chip--${mode}`}>
              {isBonus ? '+' : '−'}
              {points}
            </span>
          </div>

          <div>
            <span className="field__label">
              {isBonus
                ? activeLang === 'ar'
                  ? 'عدد نقاط البونص'
                  : 'Bonus points'
                : activeLang === 'ar'
                  ? 'عدد نقاط الخصم'
                  : 'Minus points'}
            </span>
            <div className="points-quick">
              {QUICK_VALUES.map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`points-quick__btn ${points === value ? 'is-active' : ''}`}
                  onClick={() => setPoints(value)}
                >
                  {isBonus ? '+' : '−'}
                  {value}
                </button>
              ))}
              <input
                type="number"
                min="1"
                max="20"
                className="input points-quick__input"
                value={points}
                onChange={(e) => {
                  const next = Number.parseInt(e.target.value, 10);
                  setPoints(Number.isInteger(next) ? Math.min(20, Math.max(1, next)) : 1);
                }}
                aria-label={activeLang === 'ar' ? 'قيمة النقاط' : 'Points value'}
              />
            </div>
          </div>

          <Input
            label={activeLang === 'ar' ? 'السبب (اختياري)' : 'Reason (optional)'}
            placeholder={
              activeLang === 'ar' ? 'مثال: مشاركة ممتازة في المحاضرة' : 'e.g. Excellent participation in the lecture'
            }
            value={reason}
            maxLength={200}
            onChange={(e) => setReason(e.target.value)}
          />

          <div className={`points-modal__hint points-modal__hint--${mode}`}>
            <Icon name={isBonus ? 'award' : 'alert'} size={16} />
            <span>
              {isBonus
                ? activeLang === 'ar'
                  ? 'البونص يتحسب للطالب في سجل المقرر ويظهر في تقريره.'
                  : 'The bonus is stored in the course ledger and the student report.'
                : activeLang === 'ar'
                  ? 'الخصم يتحسب للطالب في سجل المقرر ويظهر في تقريره.'
                  : 'The minus is stored in the course ledger and the student report.'}
            </span>
          </div>
        </div>

        <div className="modal__foot">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {activeLang === 'ar' ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button
            variant={isBonus ? 'success' : 'danger'}
            icon={isBonus ? 'award' : 'minus'}
            loading={busy}
            disabled={busy}
            onClick={() => onConfirm({ points, reason })}
          >
            {isBonus
              ? activeLang === 'ar'
                ? 'تأكيد البونص'
                : 'Confirm bonus'
              : activeLang === 'ar'
                ? 'تأكيد الخصم'
                : 'Confirm minus'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function PointsLedger({ entries = [], onUndo, lang, empty, compact = false }) {
  const { lang: ctxLang } = useLanguage();
  const activeLang = lang || ctxLang;

  if (!entries.length) {
    return (
      <div className="points-empty">
        <span className="points-empty__icon">
          <Icon name="award" size={22} />
        </span>
        <b>{activeLang === 'ar' ? 'لا توجد نقاط مسجّلة بعد' : 'No points recorded yet'}</b>
        <span>
          {empty ||
            (activeLang === 'ar'
              ? 'أضف بونص أو خصمًا من قائمة الطلاب وسيظهر هنا فورًا.'
              : 'Add a bonus or minus from the student list and it will show here instantly.')}
        </span>
      </div>
    );
  }

  return (
    <ul className={`points-ledger ${compact ? 'points-ledger--compact' : ''}`}>
      {entries.map((entry) => {
        const isBonus = entry.type === 'bonus';
        return (
          <li key={entry.id} className={`points-row points-row--${entry.type}`}>
            <span className={`points-row__avatar points-row__avatar--${entry.type}`}>
              {initials(studentName(entry, activeLang))}
            </span>
            <div className="points-row__body">
              <div className="points-row__top">
                <b>{studentName(entry, activeLang)}</b>
                <span className={`points-chip points-chip--${entry.type}`}>
                  {isBonus ? '+' : '−'}
                  {entry.points}
                </span>
              </div>
              <div className="points-row__meta">
                <span>{isBonus ? (activeLang === 'ar' ? 'بونص' : 'Bonus') : activeLang === 'ar' ? 'خصم' : 'Minus'}</span>
                {entry.course_code && <span>{entry.course_code}</span>}
                {entry.reason && <span className="points-row__reason">{entry.reason}</span>}
              </div>
              <div className="points-row__foot">
                <span>{whenLabel(entry.created_at, activeLang)}</span>
                {entry.staff_name && (
                  <span>
                    {activeLang === 'ar' ? 'بواسطة' : 'by'} {entry.staff_name}
                  </span>
                )}
              </div>
            </div>
            {onUndo && (
              <button
                type="button"
                className="points-row__undo"
                onClick={() => onUndo(entry)}
                aria-label={activeLang === 'ar' ? 'حذف هذه النقاط' : 'Remove this entry'}
                title={activeLang === 'ar' ? 'تراجع' : 'Undo'}
              >
                <Icon name="rotate-ccw" size={15} />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function PointsSummary({ rows = [], totals, lang }) {
  const { lang: ctxLang } = useLanguage();
  const activeLang = lang || ctxLang;

  return (
    <div className="points-summary">
      <div className="points-summary__cards">
        <div className="points-summary__card points-summary__card--bonus">
          <span>
            <Icon name="plus" size={14} /> {activeLang === 'ar' ? 'إجمالي البونص' : 'Total bonus'}
          </span>
          <b>+{totals?.bonus ?? 0}</b>
        </div>
        <div className="points-summary__card points-summary__card--penalty">
          <span>
            <Icon name="minus" size={14} /> {activeLang === 'ar' ? 'إجمالي الخصم' : 'Total minus'}
          </span>
          <b>−{totals?.penalty ?? 0}</b>
        </div>
        <div className="points-summary__card points-summary__card--net">
          <span>
            <Icon name="award" size={14} /> {activeLang === 'ar' ? 'الصافي' : 'Net'}
          </span>
          <b>{totals?.net >= 0 ? `+${totals?.net ?? 0}` : `−${Math.abs(totals?.net ?? 0)}`}</b>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="table-wrap points-summary__table">
          <table className="table table--compact">
            <thead>
              <tr>
                <th>{activeLang === 'ar' ? 'الطالب' : 'Student'}</th>
                <th>{activeLang === 'ar' ? 'بونص' : 'Bonus'}</th>
                <th>{activeLang === 'ar' ? 'خصم' : 'Minus'}</th>
                <th>{activeLang === 'ar' ? 'الصافي' : 'Net'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.student_id}>
                  <td>
                    <span className="strong">{studentName(row, activeLang)}</span>
                  </td>
                  <td>
                    <span className="points-chip points-chip--bonus">+{row.bonus}</span>
                  </td>
                  <td>
                    <span className="points-chip points-chip--penalty">−{row.penalty}</span>
                  </td>
                  <td>
                    <span className={`points-chip points-chip--${row.net >= 0 ? 'bonus' : 'penalty'}`}>
                      {row.net >= 0 ? '+' : '−'}
                      {Math.abs(row.net)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
