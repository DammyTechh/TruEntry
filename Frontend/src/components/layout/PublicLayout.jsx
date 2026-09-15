import { useState, useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu, X, ArrowRight, Mail, MapPin, Phone } from 'lucide-react';
import { FaXTwitter, FaLinkedinIn, FaInstagram, FaFacebookF, FaGithub } from 'react-icons/fa6';
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
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`sticky top-0 z-40 transition-all ${scrolled ? 'border-b border-border bg-white/85 backdrop-blur-xl shadow-xs' : 'bg-transparent'}`}>
      <div className="container-tru flex h-16 items-center justify-between lg:h-18">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `rounded-lg px-3.5 py-2 text-sm font-medium transition ${isActive ? 'text-primary' : 'text-muted hover:bg-primary-surface hover:text-ink'}`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <Button to={ROLE_HOME[user.role] || '/app'} size="sm">Dashboard <ArrowRight className="h-4 w-4" /></Button>
          ) : (
            <>
              <Button to="/login" variant="ghost" size="sm">Sign in</Button>
              <Button to="/register" size="sm">Get started</Button>
            </>
          )}
        </div>
        <button className="rounded-lg p-2 text-ink md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="animate-fade-in border-t border-border bg-white md:hidden">
          <div className="container-tru space-y-1 py-4">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) =>
                `block rounded-xl px-4 py-3 text-sm font-medium ${isActive ? 'bg-primary-light text-primary' : 'text-ink hover:bg-primary-surface'}`}>
                {n.label}
              </NavLink>
            ))}
            <div className="flex gap-2 pt-3">
              {user ? (
                <Button to={ROLE_HOME[user.role] || '/app'} className="flex-1">Go to dashboard</Button>
              ) : (
                <>
                  <Button to="/login" variant="secondary" className="flex-1">Sign in</Button>
                  <Button to="/register" className="flex-1">Get started</Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

const SOCIALS = [
  { Icon: FaXTwitter, href: 'https://twitter.com', label: 'X' },
  { Icon: FaLinkedinIn, href: 'https://linkedin.com', label: 'LinkedIn' },
  { Icon: FaInstagram, href: 'https://instagram.com', label: 'Instagram' },
  { Icon: FaFacebookF, href: 'https://facebook.com', label: 'Facebook' },
  { Icon: FaGithub, href: 'https://github.com/DammyTechh/TruEntry', label: 'GitHub' },
];

export function Footer() {
  return (
    <footer className="relative mt-20 overflow-hidden bg-ink text-white">
      <div className="pointer-events-none absolute inset-0  opacity-40" />
      <div className="container-tru relative">
        {/* CTA band */}
        <div className="grid gap-6 border-b border-white/10 py-12 md:grid-cols-2 md:items-center">
          <div>
            <h3 className="font-display text-2xl font-bold">Start your verified admission today.</h3>
            <p className="mt-2 max-w-md text-sm text-white/70">Join thousands of applicants and institutions using TruEntry for transparent, secure admissions.</p>
          </div>
          <div className="flex flex-wrap gap-3 md:justify-end">
            <Button to="/register" variant="gradient" size="lg">Create free account</Button>
            <Button to="/institutions" size="lg" className="!bg-white/10 !text-white hover:!bg-white/20">Browse institutions</Button>
          </div>
        </div>

        {/* Columns */}
        <div className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Logo light />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/65">
              TruEntry Digitalizes and secures tertiary admissions across Nigeria — from application through NIN, JAMB and O-Level verification to final admission.
            </p>
            <div className="mt-5 flex gap-2.5">
              {SOCIALS.map(({ Icon, href, label }) => (
                <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label}
                   className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white/80 transition hover:bg-primary hover:text-white">
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <FooterCol title="Product" links={[['Institutions', '/institutions'], ['How it works', '/how-it-works'], ['FAQ', '/faq'], ['Get started', '/register']]} />
          <FooterCol title="Company" links={[['About', '/how-it-works'], ['Contact', 'mailto:support@truentry.org'], ['Careers', '#'], ['Blog', '#']]} />
          <div>
            <h4 className="text-sm font-semibold text-white">Contact</h4>
            <ul className="mt-4 space-y-3 text-sm text-white/70">
              <li className="flex items-center gap-2.5"><Mail className="h-4 w-4 text-primary-300" /> support@truentry.org</li>
              <li className="flex items-center gap-2.5"><Phone className="h-4 w-4 text-primary-300" /> +234 800 000 0000</li>
              <li className="flex items-start gap-2.5"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary-300" /> Lagos, Nigeria</li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col items-center justify-between gap-3 border-t border-white/10 py-6 text-xs text-white/55 sm:flex-row">
          <span>© {new Date().getFullYear()} TruEntry. All rights reserved.</span>
          <div className="flex gap-5">
            <Link to="#" className="hover:text-white">Privacy Policy</Link>
            <Link to="#" className="hover:text-white">Terms of Service</Link>
            <Link to="#" className="hover:text-white">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-white">{title}</h4>
      <ul className="mt-4 space-y-2.5">
        {links.map(([label, to]) => (
          <li key={label}>
            {to.startsWith('mailto') || to === '#' ? (
              <a href={to} className="text-sm text-white/70 transition hover:text-white">{label}</a>
            ) : (
              <Link to={to} className="text-sm text-white/70 transition hover:text-white">{label}</Link>
            )}
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
