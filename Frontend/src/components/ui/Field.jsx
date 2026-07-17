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
