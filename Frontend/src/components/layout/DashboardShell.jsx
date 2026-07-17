import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import Logo from '../ui/Logo';
import { useAuth } from '../../context/AuthContext';
import { NotificationsBell } from './NotificationsBell';

// Icon set (inline, stroke-based to match the brand).
const Icon = ({ d, className = 'h-5 w-5' }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
    {d.map((p, i) => (
      <path key={i} d={p} strokeLinecap="round" strokeLinejoin="round" />
    ))}
  </svg>
);
const ICONS = {
  home: ['M3 11l9-8 9 8', 'M5 10v10h14V10'],
  user: ['M12 12a4 4 0 100-8 4 4 0 000 8Z', 'M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6'],
  doc: ['M7 3h7l5 5v13H7z', 'M14 3v5h5'],
  list: ['M8 7h12M8 12h12M8 17h12', 'M4 7h.01M4 12h.01M4 17h.01'],
  scale: ['M12 3v18', 'M5 8h14', 'M5 8l-2 6a3 3 0 006 0Z', 'M19 8l-2 6a3 3 0 006 0Z'],
  card: ['M3 7h18v10H3z', 'M3 10h18'],
  building: ['M4 21V5l8-3 8 3v16', 'M9 9h.01M9 13h.01M15 9h.01M15 13h.01'],
  chart: ['M4 20V4', 'M4 20h16', 'M8 16v-4M12 16V8M16 16v-6'],
  shield: ['M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z', 'm9 12 2 2 4-4'],
  cog: ['M12 15a3 3 0 100-6 3 3 0 000 6Z', 'M19 12a7 7 0 00-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 00-1.7-1L14.5 3h-4L10 5a7 7 0 00-1.7 1l-2.4-1-2 3.5L4 10a7 7 0 000 2l-2 1.5 2 3.5 2.4-1a7 7 0 001.7 1l.5 2.5h4l.5-2.5a7 7 0 001.7-1l2.4 1 2-3.5-2-1.5Z'],
  bolt: ['M13 2 4 14h6l-1 8 9-12h-6l1-8Z'],
};

const NAV_BY_ROLE = {
  applicant: [
    { to: '/app', label: 'Dashboard', icon: 'home', end: true },
    { to: '/app/profile', label: 'Profile & verification', icon: 'user' },
    { to: '/app/apply', label: 'Apply', icon: 'bolt' },
    { to: '/app/applications', label: 'My applications', icon: 'doc' },
    { to: '/app/payments', label: 'Payments', icon: 'card' },
  ],
  officer: [
    { to: '/institution', label: 'Dashboard', icon: 'home', end: true },
    { to: '/institution/applications', label: 'Applications', icon: 'doc' },
    { to: '/institution/decisioning', label: 'Decisioning', icon: 'scale' },
    { to: '/institution/departments', label: 'Departments', icon: 'building' },
    { to: '/institution/reports', label: 'Reports', icon: 'chart' },
  ],
  registrar: [
    { to: '/institution', label: 'Dashboard', icon: 'home', end: true },
    { to: '/institution/approvals', label: 'Approvals', icon: 'shield' },
    { to: '/institution/applications', label: 'Applications', icon: 'doc' },
    { to: '/institution/reports', label: 'Reports', icon: 'chart' },
  ],
  jamb: [
    { to: '/jamb', label: 'Dashboard', icon: 'home', end: true },
    { to: '/jamb/applicants', label: 'Applicants', icon: 'list' },
    { to: '/jamb/forwarded', label: 'Awaiting decision', icon: 'shield' },
    { to: '/jamb/admitted', label: 'Admitted', icon: 'doc' },
  ],
  admin: [
    { to: '/admin', label: 'Dashboard', icon: 'home', end: true },
    { to: '/admin/users', label: 'Users', icon: 'user' },
    { to: '/admin/institutions', label: 'Institutions', icon: 'building' },
    { to: '/admin/finances', label: 'Finances', icon: 'card' },
    { to: '/admin/audit', label: 'Audit logs', icon: 'list' },
    { to: '/admin/mock', label: 'Mock data', icon: 'cog' },
  ],
};

const ROLE_LABEL = {
  applicant: 'Applicant',
  officer: 'Admission Officer',
  registrar: 'Registrar',
  jamb: 'JAMB Regulator',
  admin: 'Administrator',
};

export default function DashboardShell() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const items = NAV_BY_ROLE[user?.role] || [];

  const initials = (user?.fullName || '?')
    .split(' ')
    .map((s) => s[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  async function handleLogout() {
    await logout();
    nav('/login');
  }

  return (
    <div className="min-h-screen lg:flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform border-r border-border bg-white transition-transform lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-5">
          <Logo to={items[0]?.to || '/'} />
          <button className="text-muted lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
            <Icon d={['M6 18L18 6M6 6l12 12']} />
          </button>
        </div>
        <div className="px-3 py-4">
          <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted">
            {ROLE_LABEL[user?.role]}
          </div>
          <nav className="space-y-1">
            {items.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    isActive ? 'bg-primary-light text-primary' : 'text-muted hover:bg-primary-surface hover:text-ink'
                  }`
                }
              >
                <Icon d={ICONS[it.icon]} />
                {it.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-40 bg-primary-dark/30 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-white px-4 sm:px-6">
          <button className="text-muted lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Icon d={['M4 6h16M4 12h16M4 18h16']} className="h-6 w-6" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <NotificationsBell />
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <div className="text-sm font-semibold text-ink">{user?.fullName}</div>
                <div className="text-xs text-muted">{user?.email}</div>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                {initials}
              </div>
              <button
                onClick={handleLogout}
                className="rounded-lg p-2 text-muted hover:bg-primary-surface hover:text-danger"
                title="Sign out"
              >
                <Icon d={['M15 12H3', 'M9 6l-6 6 6 6', 'M13 4h6v16h-6']} />
              </button>
            </div>
          </div>
        </header>
        <main className="flex-1 bg-primary-surface p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
