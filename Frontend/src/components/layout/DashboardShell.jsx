import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Target,
  Wallet,
  LayoutDashboard, UserCircle, FileText, ListChecks, Scale, CreditCard,
  Building2, BarChart3, ShieldCheck, Settings, Zap, LogOut, Menu, X, ChevronsUpDown,
} from 'lucide-react';
import Logo from '../ui/Logo';
import BrandBackdrop from '../ui/BrandBackdrop';
import { useAuth } from '../../context/AuthContext';
import { NotificationsBell } from './NotificationsBell';

const NAV_BY_ROLE = {
  applicant: [
    { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/app/profile', label: 'Profile & verification', icon: UserCircle },
    { to: '/app/apply', label: 'Apply', icon: Zap },
    { to: '/app/applications', label: 'My applications', icon: FileText },
    { to: '/app/payments', label: 'Payments', icon: CreditCard },
  ],
  institution: [
    { to: '/institution', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/institution/applications', label: 'Applications', icon: FileText },
    { to: '/institution/quotas', label: 'Quota', icon: Target },
    { to: '/institution/decisioning', label: 'Decisioning', icon: Scale },
    { to: '/institution/approvals', label: 'Admissions', icon: ShieldCheck },
    { to: '/institution/departments', label: 'Departments', icon: Building2 },
    { to: '/institution/reports', label: 'Reports', icon: BarChart3 },
  ],
  officer: [
    { to: '/institution', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/institution/applications', label: 'Applications', icon: FileText },
    { to: '/institution/decisioning', label: 'Decisioning', icon: Scale },
    { to: '/institution/departments', label: 'Departments', icon: Building2 },
    { to: '/institution/reports', label: 'Reports', icon: BarChart3 },
  ],
  registrar: [
    { to: '/institution', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/institution/approvals', label: 'Approvals', icon: ShieldCheck },
    { to: '/institution/applications', label: 'Applications', icon: FileText },
    { to: '/institution/reports', label: 'Reports', icon: BarChart3 },
  ],
  jamb: [
    { to: '/jamb', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/jamb/applicants', label: 'Applicants', icon: ListChecks },
    { to: '/jamb/forwarded', label: 'Awaiting decision', icon: ShieldCheck },
    { to: '/jamb/admitted', label: 'Admitted', icon: FileText },
  ],
  admin: [
    { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/admin/users', label: 'Users', icon: UserCircle },
    { to: '/admin/institutions', label: 'Institutions', icon: Building2 },
    { to: '/admin/finances', label: 'Finances', icon: CreditCard },
    { to: '/admin/fee-settings', label: 'Application fees', icon: Wallet },
    { to: '/admin/audit', label: 'Audit logs', icon: ListChecks },
    { to: '/admin/mock', label: 'Mock data', icon: Settings },
  ],
};

const ROLE_LABEL = {
  applicant: 'Applicant',
  institution: 'Institution', officer: 'Admission Officer', registrar: 'Registrar',
  jamb: 'JAMB Regulator', admin: 'Administrator',
};

export default function DashboardShell() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const items = NAV_BY_ROLE[user?.role] || [];

  const initials = (user?.fullName || '?').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();

  async function handleLogout() {
    await logout();
    nav('/login');
  }

  const SidebarContent = (
    <>
      <div className="flex h-16 items-center justify-between border-b border-border px-5">
        <Logo to={items[0]?.to || '/'} />
        <button className="text-muted lg:hidden" onClick={() => setOpen(false)} aria-label="Close"><X className="h-5 w-5" /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-5">
        <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">{ROLE_LABEL[user?.role]}</div>
        <nav className="space-y-1">
          {items.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end} onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-primary-light text-primary shadow-xs' : 'text-muted hover:bg-primary-surface hover:text-ink'
                }`}>
              {({ isActive }) => (
                <>
                  <it.icon className={`h-5 w-5 ${isActive ? 'text-primary' : 'text-muted group-hover:text-ink'}`} strokeWidth={1.9} />
                  {it.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-sm font-semibold text-white shadow-xs">{initials}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-ink">{user?.fullName}</div>
            <div className="truncate text-xs text-muted">{user?.email}</div>
          </div>
          <button onClick={handleLogout} className="rounded-lg p-2 text-muted transition hover:bg-red-50 hover:text-danger" title="Sign out"><LogOut className="h-4.5 w-4.5" /></button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-primary-surface lg:flex">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 flex-col border-r border-border bg-white lg:flex">
        {SidebarContent}
      </aside>

      {/* Mobile sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-white transition-transform lg:hidden ${open ? 'translate-x-0 shadow-pop' : '-translate-x-full'}`}>
        {SidebarContent}
      </aside>
      {open && <div className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main column */}
      <div className="flex min-h-screen flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-white/85 px-4 backdrop-blur-xl sm:px-6">
          <button className="text-ink lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-6 w-6" /></button>
          <div className="hidden text-sm font-medium text-muted lg:block">{ROLE_LABEL[user?.role]} workspace</div>
          <div className="flex flex-1 items-center justify-end gap-2">
            <NotificationsBell />
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-sm font-semibold text-white lg:hidden">{initials}</div>
          </div>
        </header>
        <main className="relative flex-1 p-4 sm:p-6 lg:p-8">
          <BrandBackdrop tone="light" />
          <div className="relative mx-auto max-w-7xl animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
