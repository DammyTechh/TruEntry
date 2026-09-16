import { ArrowRight, CircleUserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import Logo from '../ui/Logo';
import BrandBackdrop from '../ui/BrandBackdrop';
import { Button } from '../ui/Primitives';
import { useAuth } from '../../context/AuthContext';

export function OnboardingLayout({ step, totalSteps = 2, children }) {
  const { user } = useAuth();
  const firstName = user?.fullName?.trim()?.split(/\s+/)?.[0] || 'there';

  return (
    <div className="relative min-h-screen bg-primary-surface font-sans text-ink">
      <BrandBackdrop tone="light" />

      <header className="relative z-20 border-b border-border bg-white">
        <div className="container-tru flex h-16 items-center justify-between gap-4 lg:h-18">
          <Logo to="/" />
          <Button to="/" variant="secondary" size="sm">Home</Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-3xl px-4 pb-16 pt-7 sm:px-6 sm:pt-8 lg:pb-20">
        <div className="flex min-h-[52px] w-full items-center justify-between gap-4 rounded-full border border-border bg-white px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-white">
              <CircleUserRound className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <p className="min-w-0 truncate text-sm font-semibold text-ink">
              Hello {firstName}, finish setting up your account
            </p>
          </div>
          <p className="shrink-0 text-right text-xs font-medium text-muted">
            <span className="font-semibold text-primary">STEP {step}</span> of {totalSteps}
          </p>
        </div>

        {/* Step progress */}
        <div className="mt-4 flex gap-2">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i < step ? 'bg-primary' : 'bg-primary-100'}`} />
          ))}
        </div>

        <div className="mt-6 sm:mt-8">{children}</div>
      </main>
    </div>
  );
}

export function OnboardingPrimaryButton({ children, className = '', ...props }) {
  return (
    <button
      className={`flex h-[55px] w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-[18px] font-normal text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
      <ArrowRight className="h-6 w-6" strokeWidth={1.8} />
    </button>
  );
}
