import { Link } from 'react-router-dom';
import Logo from '../../components/ui/Logo';

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen flex-col bg-primary-surface">
      <div className="container-tru flex h-16 items-center">
        <Logo />
      </div>
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="animate-fade-up w-full max-w-md">
          <div className="card p-7">
            <h1 className="text-2xl font-bold text-primary-dark">{title}</h1>
            {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
            <div className="mt-6">{children}</div>
          </div>
          {footer && <div className="mt-5 text-center text-sm text-muted">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

export function AuthLink({ to, children }) {
  return (
    <Link to={to} className="link">
      {children}
    </Link>
  );
}
