import { Navigate, useLocation } from 'react-router-dom';
import { PageLoader } from '../ui/Misc';
import { Button } from '../ui/Primitives';
import { useOnboarding, onboardingRouteForStep } from '../../context/OnboardingContext';

function StatusError() {
  const { refresh } = useOnboarding();
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F6F8FE] px-4">
      <div className="w-full max-w-md rounded-2xl border border-[#E4E9F5] bg-white p-6 text-center shadow-card">
        <h1 className="text-lg font-semibold text-[#0A2B72]">We couldn't check your onboarding status</h1>
        <p className="mt-2 text-sm text-[#66799D]">Please retry before continuing.</p>
        <Button onClick={() => refresh().catch(() => {})} className="mt-5">Retry</Button>
      </div>
    </div>
  );
}

export function OnboardingEntry() {
  const location = useLocation();
  const { status, loading, error } = useOnboarding();

  if (loading) return <PageLoader label="Checking your account setup…" />;
  if (error) return <StatusError />;

  if (status.complete) {
    const requested = location.state?.from?.pathname;
    const destination = requested?.startsWith('/app') ? requested : '/app';
    return <Navigate to={destination} replace />;
  }

  return <Navigate to={status.route} replace />;
}

export function OnboardingStepGate({ step, children }) {
  const { status, loading, error } = useOnboarding();

  if (loading) return <PageLoader label="Loading your onboarding…" />;
  if (error) return <StatusError />;
  if (status.complete) return <Navigate to="/app" replace />;

  // Users may return to an earlier step to review/edit it, but they cannot skip
  // ahead of the first incomplete step.
  if (step > status.currentStep) {
    return <Navigate to={onboardingRouteForStep(status.currentStep)} replace />;
  }

  return children;
}

export function ApplicantDashboardGate({ children }) {
  const { status, loading, error } = useOnboarding();

  if (loading) return <PageLoader label="Checking your account setup…" />;
  if (error) return <StatusError />;
  if (!status.complete) return <Navigate to="/onboarding" replace />;

  return children;
}
