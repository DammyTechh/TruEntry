import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * A labelled form control.
 *
 * The label is tied to the control with htmlFor/id, and any error or hint is
 * linked through aria-describedby. Without that a screen reader announces an
 * unnamed box, clicking the label does not focus the field, and the error text
 * is never read out. `children` is a function so the control receives the
 * generated ids; passing an element still works for anything custom.
 */
export function Field({ label, error, hint, required, children, controlId }) {
  const generated = useId();
  const id = controlId || generated;
  const messageId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  const control = typeof children === 'function'
    ? children({ id, 'aria-describedby': messageId, 'aria-invalid': error ? true : undefined })
    : children;

  return (
    <div>
      {label && (
        <label className="label" htmlFor={id}>
          {label} {required && <span className="text-danger">*</span>}
        </label>
      )}
      {control}
      {error ? (
        <p id={messageId} role="alert" className="mt-1 text-xs text-danger">{error}</p>
      ) : hint ? (
        <p id={messageId} className="mt-1 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ label, error, hint, required, className = '', ...props }) {
  return (
    <Field label={label} error={error} hint={hint} required={required} controlId={props.id}>
      {(a11y) => (
        <input
          {...a11y}
          className={`input ${error ? 'border-danger focus:ring-danger/25' : ''} ${className}`}
          {...props}
        />
      )}
    </Field>
  );
}

export function Select({ label, error, hint, required, children, className = '', ...props }) {
  return (
    <Field label={label} error={error} hint={hint} required={required} controlId={props.id}>
      {(a11y) => (
        <select {...a11y} className={`input ${error ? 'border-danger' : ''} ${className}`} {...props}>
          {children}
        </select>
      )}
    </Field>
  );
}

export function Textarea({ label, error, hint, required, className = '', ...props }) {
  return (
    <Field label={label} error={error} hint={hint} required={required} controlId={props.id}>
      {(a11y) => (
        <textarea
          {...a11y}
          className={`input min-h-[96px] ${error ? 'border-danger' : ''} ${className}`}
          {...props}
        />
      )}
    </Field>
  );
}

// Password field with a show/hide toggle.
export function PasswordInput({ label, error, hint, required, className = '', ...props }) {
  const [show, setShow] = useState(false);
  return (
    <Field label={label} error={error} hint={hint} required={required} controlId={props.id}>
      {(a11y) => (
      <div className="relative">
        <input
          {...a11y}
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
      )}
    </Field>
  );
}
