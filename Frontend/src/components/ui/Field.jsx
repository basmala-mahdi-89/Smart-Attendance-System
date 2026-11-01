import { useId, useState } from 'react';
import Icon from './Icon';

function FieldShell({ id, label, hint, error, required, children }) {
  return (
    <div className={`field ${error ? 'field--error' : ''}`.trim()}>
      {label && (
        <label className="field__label" htmlFor={id}>
          {label} {required && <span>*</span>}
        </label>
      )}
      {children}
      {error ? (
        <span className="field__error">{error}</span>
      ) : hint ? (
        <span className="field__hint">{hint}</span>
      ) : null}
    </div>
  );
}

export function Input({
  label,
  hint,
  error,
  icon,
  action,
  required,
  id,
  className = '',
  ...rest
}) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <FieldShell id={inputId} label={label} hint={hint} error={error} required={required}>
      <div className="field__control">
        {icon && (
          <span className="field__icon">
            <Icon name={icon} size={18} />
          </span>
        )}
        <input
          id={inputId}
          className={`input ${icon ? 'input--with-icon' : ''} ${action ? 'input--with-action' : ''} ${className}`.trim()}
          required={required}
          aria-invalid={!!error}
          {...rest}
        />
        {action}
      </div>
    </FieldShell>
  );
}

export function PasswordInput({ label = 'Password', hint, error, icon = 'lock', required, ...rest }) {
  const autoId = useId();
  const [visible, setVisible] = useState(false);
  return (
    <Input
      id={autoId}
      label={label}
      hint={hint}
      error={error}
      icon={icon}
      required={required}
      type={visible ? 'text' : 'password'}
      action={
        <button
          type="button"
          className="input__action"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          <Icon name={visible ? 'eye-off' : 'eye'} size={17} />
        </button>
      }
      {...rest}
    />
  );
}

export function Select({ label, hint, error, icon, required, id, children, className = '', ...rest }) {
  const autoId = useId();
  const selectId = id || autoId;
  return (
    <FieldShell id={selectId} label={label} hint={hint} error={error} required={required}>
      <div className="field__control">
        {icon && (
          <span className="field__icon">
            <Icon name={icon} size={18} />
          </span>
        )}
        <select
          id={selectId}
          className={`select ${icon ? 'input--with-icon' : ''} ${className}`.trim()}
          style={icon ? { paddingLeft: 44 } : undefined}
          required={required}
          aria-invalid={!!error}
          {...rest}
        >
          {children}
        </select>
      </div>
    </FieldShell>
  );
}

export function Textarea({ label, hint, error, required, id, className = '', ...rest }) {
  const autoId = useId();
  const areaId = id || autoId;
  return (
    <FieldShell id={areaId} label={label} hint={hint} error={error} required={required}>
      <textarea
        id={areaId}
        className={`textarea ${className}`.trim()}
        required={required}
        aria-invalid={!!error}
        {...rest}
      />
    </FieldShell>
  );
}
