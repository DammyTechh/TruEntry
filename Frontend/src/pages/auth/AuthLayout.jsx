import { Link } from 'react-router-dom';
import { CircleCheck, ShieldCheck, LockKeyhole } from 'lucide-react';
import Logo from '../../components/ui/Logo';
import BrandBackdrop from '../../components/ui/BrandBackdrop';

const HIGHLIGHTS = [
  { icon: CircleCheck, t: 'Verified records', d: 'NIN, JAMB & O-Level checked at the source.' },
  { icon: LockKeyhole, t: 'Secure by design', d: 'Role-based access with a full audit trail.' },
  { icon: ShieldCheck, t: 'Transparent pipeline', d: 'Track every stage to admission.' },
];

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="relative hidden w-1/2 overflow-hidden lg:block">
        <BrandBackdrop tone="deep" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Logo to="/" light />
          <div>
            <h2 className="font-display text-3xl font-bold leading-tight text-white">Admissions you can trust.</h2>
            <p className="mt-3 max-w-sm text-primary-100">From application to JAMB admission — verified, secure and transparent.</p>
            <ul className="mt-8 space-y-4">
              {HIGHLIGHTS.map((h) => (
                <li key={h.t} className="flex items-start gap-3">
                  <h.icon className="mt-0.5 h-5 w-5 shrink-0 text-white/85" strokeWidth={1.6} />
                  <div>
                    <div className="font-semibold text-white">{h.t}</div>
                    <div className="text-sm text-primary-100">{h.d}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-primary-200">© {new Date().getFullYear()} TruEntry. All rights reserved.</p>
        </div>
      </div>

      {/* Form panel */}
      <div className="relative flex flex-1 flex-col bg-primary-surface">
        <BrandBackdrop tone="light" />
        <div className="relative container-tru flex h-16 items-center lg:hidden">
          <Logo />
        </div>
        <div className="relative flex flex-1 items-center justify-center px-4 py-10">
          <div className="animate-fade-up w-full max-w-md">
            <div className="card p-7 shadow-lift sm:p-8">
              <h1 className="font-display text-2xl font-bold text-primary-dark">{title}</h1>
              {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
              <div className="mt-6">{children}</div>
            </div>
            {footer && <div className="mt-5 text-center text-sm text-muted">{footer}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthLink({ to, children }) {
  return <Link to={to} className="link">{children}</Link>;
}
