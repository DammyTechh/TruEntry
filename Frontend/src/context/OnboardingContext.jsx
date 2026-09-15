import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../lib/api';

const OnboardingContext = createContext(null);

const STEP_ROUTES = {
  1: '/onboarding/biodata',
  2: '/onboarding/exam-details',
};

const DEV_PROGRESS_PREFIX = 'truentry:dev-onboarding-progress:';

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function devProgressKey(userId) {
  return `${DEV_PROGRESS_PREFIX}${userId}`;
}


//status check for onboarding & env 
function readDevCompletedThrough(userId) {
  if (!import.meta.env.DEV || typeof window === 'undefined' || !userId) return 0;

  const value = Number(window.localStorage.getItem(devProgressKey(userId)) || 0);
  return Number.isFinite(value) ? Math.max(0, Math.min(2, value)) : 0;
}

function writeDevCompletedThrough(userId, step) {
  if (!import.meta.env.DEV || typeof window === 'undefined' || !userId) return;

  const next = Math.max(readDevCompletedThrough(userId), Number(step) || 0);
  window.localStorage.setItem(devProgressKey(userId), String(Math.min(2, next)));
}

function readLegacySessionBypasses() {
  if (!import.meta.env.DEV || typeof window === 'undefined') {
    return { photo: false, nin: false, olevel: false };
  }

  return {
    photo: window.sessionStorage.getItem('truentry:test-bypass-photo') === '1',
    nin: window.sessionStorage.getItem('truentry:test-bypass-nin') === '1',
    olevel: window.sessionStorage.getItem('truentry:test-bypass-olevel') === '1',
  };
}

function clearLegacySessionBypasses() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return;
  window.sessionStorage.removeItem('truentry:test-bypass-photo');
  window.sessionStorage.removeItem('truentry:test-bypass-nin');
  window.sessionStorage.removeItem('truentry:test-bypass-olevel');
}

function buildStatus(profilePayload, completionPayload) {
  const profile = profilePayload?.profile || {};
  const completion = completionPayload || {};
  const checks = completion.checks || {};
  const steps = completion.steps || {};
  const userId = profilePayload?.id;
  const legacyBypasses = readLegacySessionBypasses();

  // Development-only progress, account-scoped, so the flow can be exercised
  // while exam/verification test services are unavailable. Never used in prod.
  const devCompletedThrough = readDevCompletedThrough(userId);

  // The backend is the authority. Onboarding captures RECORDS only —
  // verification and payment belong to the application flow, so they are NOT
  // part of onboarding completion.
  const biodataComplete = Boolean(firstDefined(
    steps.biodata?.complete,
    checks.hasBiodata && checks.hasLocation && checks.hasImage && checks.hasNin,
    profile.dateOfBirth && profile.gender && profile.stateOfOrigin && profile.lga &&
      profile.location && (profile.profileImageUrl || legacyBypasses.photo) &&
      (profile.nin || legacyBypasses.nin)
  )) || devCompletedThrough >= 1;

  const examDetailsComplete = Boolean(firstDefined(
    steps.examDetails?.complete,
    checks.hasJambRegNo && checks.hasOlevelRecord,
    profile.jambRegNo && profile.olevelRegNo
  )) || devCompletedThrough >= 2;

  const complete = Boolean(firstDefined(
    completion.onboardingComplete,
    biodataComplete && examDetailsComplete
  ));

  const derivedCurrentStep = !biodataComplete ? 1 : !examDetailsComplete ? 2 : 2;
  const backendCurrentStep = Number(completion.currentStep);
  const currentStep = [1, 2].includes(backendCurrentStep) ? backendCurrentStep : derivedCurrentStep;

  return {
    complete,
    currentStep: complete ? null : currentStep,
    route: complete ? '/app' : STEP_ROUTES[currentStep],
    steps: {
      biodata: biodataComplete,
      examDetails: examDetailsComplete,
    },
    verification: completion.verification || { nin: false, jamb: false, olevel: false },
    devCompletedThrough,
    legacyBypassDetected: legacyBypasses.photo || legacyBypasses.nin || legacyBypasses.olevel,
  };
}


export function OnboardingProvider({ children }) {
  const [profile, setProfile] = useState(null);
  const [completion, setCompletion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [devProgressVersion, setDevProgressVersion] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
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
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const markDevStepComplete = useCallback((step) => {
    if (!import.meta.env.DEV) return;
    const userId = profile?.id;
    if (!userId) return;

    writeDevCompletedThrough(userId, step);
    setDevProgressVersion((version) => version + 1);
  }, [profile?.id]);

  const status = useMemo(
    () => buildStatus(profile, completion),
    [profile, completion, devProgressVersion]
  );

  // Migrate the older session-only testing bypasses into the new account-scoped
  // local development progress so an applicant who has already tested Steps 1
  // and 2 does not have to repeat them after replacing this file.
  useEffect(() => {
    if (!import.meta.env.DEV || !profile?.id || !status.legacyBypassDetected) return;

    const completedThrough = status.steps.examDetails ? 2 : status.steps.biodata ? 1 : 0;
    if (completedThrough > 0) {
      writeDevCompletedThrough(profile.id, completedThrough);
      clearLegacySessionBypasses();
      setDevProgressVersion((version) => version + 1);
    }
  }, [profile?.id, status.legacyBypassDetected, status.steps.biodata, status.steps.examDetails]);

  const value = useMemo(
    () => ({
      profile,
      completion,
      status,
      loading,
      error,
      refresh,
      markDevStepComplete,
    }),
    [profile, completion, status, loading, error, refresh, markDevStepComplete]
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
