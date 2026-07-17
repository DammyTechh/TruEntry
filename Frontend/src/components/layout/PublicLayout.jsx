import { Link, NavLink, Outlet } from 'react-router-dom';
import Logo from '../ui/Logo';
import { Button } from '../ui/Primitives';
import { useAuth } from '../../context/AuthContext';
import { ROLE_HOME } from '../../lib/constants';

const NAV = [
  { to: '/institutions', label: 'Institutions' },
  { to: '/how-it-works', label: 'How it works' },
  { to: '/faq', label: 'FAQ' },
];

export function PublicNav() {
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/85 backdrop-blur">
      <div className="container-tru flex h-16 items-center justify-between">
        <Logo />
        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `text-sm font-medium ${isActive ? 'text-primary' : 'text-muted hover:text-ink'}`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <Button to={ROLE_HOME[user.role] || '/app'} size="sm">
              Go to dashboard
            </Button>
          ) : (
            <>
              <Button to="/login" variant="ghost" size="sm">
                Sign in
              </Button>
              <Button to="/register" size="sm">
                Get started
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border bg-white">
      <div className="container-tru grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted">
            Admissions you can trust. Digitising and securing tertiary admissions across Nigeria.
          </p>
        </div>
        <FooterCol title="Product" links={[['Institutions', '/institutions'], ['How it works', '/how-it-works'], ['FAQ', '/faq']]} />
        <FooterCol title="Get started" links={[['Create account', '/register'], ['Sign in', '/login']]} />
        <div>
          <h4 className="text-sm font-semibold text-ink">Contact</h4>
          <a href="mailto:support@truentry.org" className="mt-3 block text-sm text-muted hover:text-primary">
            support@truentry.org
          </a>
        </div>
      </div>
      <div className="border-t border-border py-5 text-center text-xs text-muted">
        © {new Date().getFullYear()} TruEntry. All rights reserved.
      </div>
    </footer>
  );
}

function FooterCol({ title, links }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-ink">{title}</h4>
      <ul className="mt-3 space-y-2">
        {links.map(([label, to]) => (
          <li key={to}>
            <Link to={to} className="text-sm text-muted hover:text-primary">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
