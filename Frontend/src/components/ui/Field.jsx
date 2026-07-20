import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export function Field({ label, error, hint, required, children }) {
  return (
    <div>
      {label && (
        <label className="label">
          {label} {required && <span className="text-danger">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1 text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ label, error, hint, required, className = '', ...props }) {
  return (
    <Field label={label} error={error} hint={hint} required={required}>
      <input className={`input ${error ? 'border-danger focus:ring-danger/25' : ''} ${className}`} {...props} />
    </Field>
  );
}

export function Select({ label, error, hint, required, children, className = '', ...props }) {
  return (
    <Field label={label} error={error} hint={hint} required={required}>
      <select className={`input ${error ? 'border-danger' : ''} ${className}`} {...props}>
        {children}
      </select>
    </Field>
  );
}

export function Textarea({ label, error, hint, required, className = '', ...props }) {
  return (
    <Field label={label} error={error} hint={hint} required={required}>
      <textarea className={`input min-h-[96px] ${error ? 'border-danger' : ''} ${className}`} {...props} />
    </Field>
  );
}

// Password field with a show/hide toggle.
export function PasswordInput({ label, error, hint, required, className = '', ...props }) {
  const [show, setShow] = useState(false);
  return (
    <Field label={label} error={error} hint={hint} required={required}>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          className={`input pr-11 ${error ? 'border-danger focus:ring-danger/25' : ''} ${className}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-muted transition hover:bg-primary-surface hover:text-ink"
          aria-label={show ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          {show ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
        </button>
      </div>
    </Field>
  );
}
