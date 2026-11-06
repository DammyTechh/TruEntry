import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api from '../lib/api';

const OnboardingContext = createContext(null);

const STEP_ROUTES = {
  1: '/onboarding/biodata',
  2: '/onboarding/exam-details',
  3: '/onboarding/payment',
};

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function buildStatus(profilePayload, completionPayload) {
  const profile = profilePayload?.profile || {};
  const completion = completionPayload || {};
  const checks = completion.checks || {};
  const steps = completion.steps || {};

  // The backend is the authority. Onboarding captures RECORDS only —
  // verification and payment belong to the application flow, so they are NOT
  // part of onboarding completion.
  const biodataComplete = Boolean(firstDefined(
    steps.biodata?.complete,
    checks.hasBiodata && checks.hasLocation && checks.hasImage && checks.hasNin,
    profile.dateOfBirth && profile.gender && profile.stateOfOrigin && profile.lga &&
      profile.location && profile.profileImageUrl && profile.nin
  ));

  const examDetailsComplete = Boolean(firstDefined(
    steps.examDetails?.complete,
    checks.hasJambRegNo && checks.hasOlevelRecord,
    profile.jambRegNo && profile.olevelRegNo
  ));

  // Onboarding now finishes with the exam-processing payment.
  const paymentComplete = Boolean(firstDefined(
    steps.payment?.complete,
    completion.session?.paymentStatus === 'success'
  ));

  const complete = Boolean(firstDefined(
    completion.onboardingComplete,
    biodataComplete && examDetailsComplete && paymentComplete
  ));

  const derivedCurrentStep = !biodataComplete ? 1 : !examDetailsComplete ? 2 : 3;
  const backendCurrentStep = Number(completion.currentStep);
  const currentStep = [1, 2, 3].includes(backendCurrentStep) ? backendCurrentStep : derivedCurrentStep;

  return {
    complete,
    currentStep: complete ? null : currentStep,
    route: complete ? '/app' : STEP_ROUTES[currentStep],
    steps: {
      biodata: biodataComplete,
      examDetails: examDetailsComplete,
      payment: paymentComplete,
    },
    session: completion.session || null,
    verification: completion.verification || { nin: false, jamb: false, olevel: false },
  };
}


export function OnboardingProvider({ children }) {
  // Safety net matching AuthContext: a stalled status request must never
  // leave the applicant staring at a loading screen.
  const bailTimer = useRef(null);
  const [profile, setProfile] = useState(null);
  const [completion, setCompletion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    // Stop waiting if the status request stalls, so the applicant is never
    // trapped on a loading screen.
    clearTimeout(bailTimer.current);
    bailTimer.current = setTimeout(() => setLoading(false), 12000);
    try {
      const [profileResponse, completionResponse] = await Promise.all([
        api.get('/profile'),
        api.get('/profile/completion'),
      ]);
      setProfile(profileResponse.data?.data || null);
      setCompletion(completionResponse.data?.data || null);
      return {
        profile: profileResponse.data?.data || null,
        completion: completionResponse.data?.data || null,
      };
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      clearTimeout(bailTimer.current);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
    return () => clearTimeout(bailTimer.current);
  }, [refresh]);

  const status = useMemo(
    () => buildStatus(profile, completion),
    [profile, completion]
  );

  const value = useMemo(
    () => ({
      profile,
      completion,
      status,
      loading,
      error,
      refresh,
    }),
    [profile, completion, status, loading, error, refresh]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) throw new Error('useOnboarding must be used within OnboardingProvider');
  return context;
}

export function onboardingRouteForStep(step) {
  return STEP_ROUTES[step] || STEP_ROUTES[1];
}
