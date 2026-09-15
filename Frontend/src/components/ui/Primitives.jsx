import { Link } from 'react-router-dom';
import { Loader2, Inbox } from 'lucide-react';

export function Spinner({ className = 'h-4 w-4' }) {
  return <Loader2 className={`animate-spin ${className}`} aria-hidden="true" />;
}

const VARIANTS = {
  primary: 'bg-primary text-white hover:bg-primary-hover shadow-xs',
  gradient: 'bg-brand-gradient text-white shadow-soft',
  secondary: 'bg-white text-ink border border-border hover:bg-primary-surface hover:border-primary/30',
  ghost: 'text-primary hover:bg-primary-light',
  danger: 'bg-danger text-white hover:bg-red-700',
  subtle: 'bg-primary-light text-primary hover:bg-primary-100',
  dark: 'bg-ink text-white hover:bg-primary-950',
}
const SIZES = { sm: 'px-3.5 py-2 text-sm', md: 'px-5 py-2.5 text-sm', lg: 'px-6 py-3.5 text-base' };

export function Button({
  as = 'button', to, href, variant = 'primary', size = 'md',
  loading = false, disabled = false, className = '', children, ...props
}) {
  const cls = `inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
  const content = (<>{loading && <Spinner />}{children}</>);
  if (to) return <Link to={to} className={cls} {...props}>{content}</Link>;
  if (href) return <a href={href} className={cls} {...props}>{content}</a>;
  const Comp = as;
  return <Comp className={cls} disabled={disabled || loading} {...props}>{content}</Comp>;
}

export function Badge({ children, className = '' }) {
  return <span className={`chip ${className}`}>{children}</span>;
}

export function Card({ className = '', hover = false, children, ...props }) {
  return (
    <div className={`card p-5 ${hover ? 'card-hover' : ''} ${className}`} {...props}>
      {children}
    </div>
  );
}

export function StatCard({ label, value, hint, icon: Icon, accent = 'text-primary', tone = 'primary' }) {
  const tones = {
    primary: 'bg-primary-light text-primary',
    success: 'bg-green-50 text-success',
    warning: 'bg-amber-50 text-warning',
    danger: 'bg-red-50 text-danger',
  };
  return (
    <div className="card card-hover p-5">
      <div className="flex items-start justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
        {Icon && (
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${tones[tone]}`}>
            <Icon className="h-4.5 w-4.5" strokeWidth={2} />
          </div>
        )}
      </div>
      <div className={`mt-3 text-3xl font-bold tracking-tight ${accent}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function EmptyState({ title, message, action, icon: Icon = Inbox }) {
  return (
    <div className="card flex flex-col items-center justify-center py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light text-primary shadow-xs">
        <Icon className="h-7 w-7" strokeWidth={1.75} />
      </div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {message && <p className="mt-1.5 max-w-sm text-sm text-muted">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
