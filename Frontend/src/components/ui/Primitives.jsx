import { Link } from 'react-router-dom';

export function Spinner({ className = 'h-4 w-4' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

const VARIANTS = {
  primary: 'bg-primary text-white hover:bg-primary-hover shadow-sm',
  secondary: 'bg-white text-ink border border-border hover:bg-primary-surface',
  ghost: 'text-primary hover:bg-primary-light',
  danger: 'bg-danger text-white hover:bg-red-700',
  subtle: 'bg-primary-light text-primary hover:bg-primary-light/70',
};
const SIZES = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2.5 text-sm', lg: 'px-5 py-3 text-base' };

export function Button({
  as = 'button',
  to,
  href,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  className = '',
  children,
  ...props
}) {
  const cls = `inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition
    disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
  const content = (
    <>
      {loading && <Spinner />}
      {children}
    </>
  );
  if (to) return <Link to={to} className={cls} {...props}>{content}</Link>;
  if (href) return <a href={href} className={cls} {...props}>{content}</a>;
  const Comp = as;
  return (
    <Comp className={cls} disabled={disabled || loading} {...props}>
      {content}
    </Comp>
  );
}

export function Badge({ children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>
      {children}
    </span>
  );
}

export function Card({ className = '', children, ...props }) {
  return (
    <div className={`card p-5 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function StatCard({ label, value, hint, accent = 'text-primary' }) {
  return (
    <div className="card p-5">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-2 text-3xl font-bold ${accent}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function EmptyState({ title, message, action }) {
  return (
    <div className="card flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-light text-primary">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 7h16M4 12h10M4 17h6" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-muted">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
