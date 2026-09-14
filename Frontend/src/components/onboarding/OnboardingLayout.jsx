import { ArrowRight, CircleUserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import Logo from '../ui/Logo';
import { useAuth } from '../../context/AuthContext';

export function OnboardingLayout({ step, children }) {
  const { user } = useAuth();
  const firstName = user?.fullName?.trim()?.split(/\s+/)?.[0] || 'there';

  return (
    <div className="onboarding-surface min-h-screen font-sans text-black">
      <header className="relative z-20 border-b border-[#F1F4FA] bg-white">
        <div className="mx-auto flex min-h-[72px] w-full max-w-[1440px] items-center justify-between gap-4 px-4 py-2.5 sm:px-6 lg:px-[60px]">
          <Logo to="/" className="origin-left scale-[0.88] sm:scale-100" />
          <Link
            to="/"
            className="flex h-11 min-w-[108px] items-center justify-center rounded-xl bg-[#0D57E8] px-5 text-[15px] font-normal text-white transition hover:bg-[#0B4FD4] focus-visible:ring-[#0D57E8]/35 sm:h-[55px] sm:min-w-[154px] sm:text-[18px]"
          >
            Home
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-[765px] px-4 pb-16 pt-7 sm:px-6 sm:pt-8 lg:pb-20">
        <div className="flex min-h-[49px] w-full items-center justify-between gap-4 rounded-full border border-[#E4E9F5] bg-white px-3.5 py-2.5 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-full bg-[#0D57E8] text-white">
              <CircleUserRound className="h-[15px] w-[15px]" strokeWidth={2.2} />
            </span>
            <p className="min-w-0 text-[13px] font-bold leading-5 text-black sm:text-[16px]">
              Hello {firstName}, Finish setting up your account
            </p>
          </div>
          <p className="shrink-0 text-right text-[11px] font-medium leading-5 text-[#6B7280] sm:text-[12px]">
            <span className="text-[#0D57E8]">STEP {step}</span> of 3
          </p>
        </div>

        <div className="mt-6 sm:mt-8">{children}</div>
      </main>
    </div>
  );
}

export function OnboardingPrimaryButton({ children, className = '', ...props }) {
  return (
    <button
      className={`flex h-[55px] w-full items-center justify-center gap-2 rounded-xl bg-[#0D57E8] px-5 text-[18px] font-normal text-white transition hover:bg-[#0B4FD4] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
      <ArrowRight className="h-6 w-6" strokeWidth={1.8} />
    </button>
  );
}
