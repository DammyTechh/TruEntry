import { useMemo, useState } from 'react';
import { ArrowLeft, Ban, Check, ChevronDown, Info, Loader2, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { OnboardingLayout, OnboardingPrimaryButton } from '../../components/onboarding/OnboardingLayout';
import { useOnboarding } from '../../context/OnboardingContext';
import { useToast } from '../../components/ui/Toast';
import api, { errMessage } from '../../lib/api';
import { OLEVEL_TYPES } from '../../lib/constants';

const SERVER_MULTI_SITTING_MESSAGE =
  'Two O-Level sittings are supported by the updated onboarding design, but this server currently stores only one sitting. Remove the second sitting to continue for now.';

function isOlevelNotFound(error) {
  const code = error?.response?.data?.error?.code || error?.response?.data?.code;
  const message = String(error?.response?.data?.message || error?.response?.data?.error?.message || error?.message || '').toLowerCase();
  return code === 'OLEVEL_NOT_FOUND' || message.includes('o-level record not found') || message.includes('olevel record not found');
}

function enableOlevelTestBypass() {
  return import.meta.env.DEV && typeof window !== 'undefined';
}

function inputClass(hasError = false) {
  return [
    'h-[44px] w-full rounded-xl border bg-white px-3 text-[15px] text-black outline-none transition sm:text-[16px]',
    'shadow-[0_-1px_0.5px_#BBCEFF,0_1px_0.5px_#BBCEFF] placeholder:text-[#6B7280]',
    'focus:border-[#0D57E8] focus:ring-2 focus:ring-[#0D57E8]/10',
    hasError ? 'border-red-500' : 'border-[#BBCEFF]',
  ].join(' ');
}

function FieldShell({ label, error, children }) {
  return (
    <label className="block min-w-0">
      <span className="mb-3 block text-[15px] leading-5 text-black sm:text-[16px]">{label}</span>
      {children}
      {error && <span className="mt-1.5 block text-xs leading-4 text-red-600">{error}</span>}
    </label>
  );
}

function InfoBanner({ children, compact = false }) {
  return (
    <div className={`flex items-start gap-3 rounded-lg bg-[#E8F4FF] px-4 py-2.5 sm:px-5 ${compact ? 'sm:items-center' : ''}`}>
      <span className="mt-0.5 flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-full bg-[#BFE2FF] text-[#0D57E8] sm:mt-0">
        <Info className="h-[17px] w-[17px]" strokeWidth={2} />
      </span>
      <p className="min-w-0 text-[12px] leading-[19px] text-[#0D57E8] sm:text-[14px] sm:leading-[19.2px]">
        {children}
      </p>
    </div>
  );
}

function SittingFields({ sitting, index, errors, onChange }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-[156px_minmax(0,1fr)] sm:items-end sm:gap-3">
      <FieldShell label="Exam" error={errors?.examType}>
        <div className="relative">
          <select
            value={sitting.examType}
            onChange={(event) => onChange(index, 'examType', event.target.value)}
            className={`${inputClass(Boolean(errors?.examType))} appearance-none pr-10 text-[#6B7280]`}
          >
            {OLEVEL_TYPES.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6B7280]"
            strokeWidth={1.8}
          />
        </div>
      </FieldShell>

      <FieldShell label="Registration number" error={errors?.regNo}>
        <div className="relative">
          <input
            value={sitting.regNo}
            onChange={(event) => onChange(index, 'regNo', event.target.value)}
            placeholder="e.g 222333222AB"
            autoCapitalize="characters"
            className={`${inputClass(Boolean(errors?.regNo))} ${sitting.verified ? 'pr-10' : ''}`}
          />
          {sitting.verified && (
            <span className="pointer-events-none absolute right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-green-100 text-green-700">
              <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
            </span>
          )}
        </div>
      </FieldShell>
    </div>
  );
}

function normalizeSitting(profile) {
  return {
    examType: profile?.olevelExamType || 'waec',
    regNo: profile?.olevelRegNo || '',
    verified: Boolean(profile?.olevelVerified),
  };
}

export default function ExamDetailsStep() {
  const navigate = useNavigate();
  const toast = useToast();
  const { profile, refresh, markDevStepComplete } = useOnboarding();
  const p = profile?.profile || {};

  const [jambRegNo, setJambRegNo] = useState(p.jambRegNo || '');
  const [sittings, setSittings] = useState(() => [normalizeSitting(p)]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [serverLimitation, setServerLimitation] = useState('');

  const jambVerified = useMemo(
    () => Boolean(p.jambVerified && p.jambRegNo && p.jambRegNo.trim() === jambRegNo.trim()),
    [p.jambVerified, p.jambRegNo, jambRegNo]
  );

  function changeJamb(event) {
    setJambRegNo(event.target.value);
    setErrors((current) => ({ ...current, jambRegNo: undefined }));
  }

  function changeSitting(index, key, value) {
    setSittings((current) => current.map((sitting, sittingIndex) => (
      sittingIndex === index
        ? { ...sitting, [key]: value, verified: false }
        : sitting
    )));
    setErrors((current) => ({
      ...current,
      sittings: {
        ...(current.sittings || {}),
        [index]: { ...(current.sittings?.[index] || {}), [key]: undefined },
      },
    }));
    setServerLimitation('');
  }

  function addSitting() {
    if (sittings.length >= 2) return;
    setSittings((current) => [...current, { examType: 'waec', regNo: '', verified: false }]);
    setServerLimitation('');
  }

  function removeSitting() {
    if (sittings.length <= 1) return;
    setSittings((current) => current.slice(0, 1));
    setErrors((current) => ({ ...current, sittings: { 0: current.sittings?.[0] || {} } }));
    setServerLimitation('');
  }

  function validate() {
    const next = { sittings: {} };
    const jamb = jambRegNo.trim();
    if (jamb.length < 6) next.jambRegNo = 'Enter a valid JAMB registration number.';

    sittings.forEach((sitting, index) => {
      const sittingErrors = {};
      if (!sitting.examType) sittingErrors.examType = 'Select an exam type.';
      if (sitting.regNo.trim().length < 6) sittingErrors.regNo = 'Enter a valid registration number.';
      if (Object.keys(sittingErrors).length) next.sittings[index] = sittingErrors;
    });

    if (
      sittings.length === 2 &&
      sittings[0].examType === sittings[1].examType &&
      sittings[0].regNo.trim().toLowerCase() === sittings[1].regNo.trim().toLowerCase() &&
      sittings[0].regNo.trim()
    ) {
      next.sittings[1] = {
        ...(next.sittings[1] || {}),
        regNo: 'The second sitting must be different from the first.',
      };
    }

    const hasErrors = Boolean(next.jambRegNo || Object.keys(next.sittings).length);
    setErrors(next);
    return !hasErrors;
  }

  async function submit(event) {
    event.preventDefault();
    setServerLimitation('');
    if (!validate()) return;

    // The attached backend persists one O-Level record only. Submitting the
    // second row to the existing endpoint would overwrite the first sitting,
    // so we deliberately stop here rather than fake multi-sitting support in
    // browser storage or corrupt server data.
    if (sittings.length === 2) {
      setServerLimitation(SERVER_MULTI_SITTING_MESSAGE);
      return;
    }

    setSaving(true);
    try {
      const jamb = jambRegNo.trim();
      const firstSitting = sittings[0];
      const jambChanged = !p.jambVerified || p.jambRegNo?.trim() !== jamb;
      const olevelChanged =
        !p.olevelVerified ||
        p.olevelExamType !== firstSitting.examType ||
        p.olevelRegNo?.trim() !== firstSitting.regNo.trim();

      if (jambChanged) {
        await api.post('/profile/verify-jamb', { jambRegNo: jamb });
      }

      if (olevelChanged) {
        try {
          await api.post('/profile/verify-olevel', {
            examType: firstSitting.examType,
            regNo: firstSitting.regNo.trim(),
          });
        } catch (error) {
          if (isOlevelNotFound(error) && enableOlevelTestBypass()) {
            // Persist Step 2 progress for this account in local development so
            // logout/login resumes at the first incomplete onboarding step.
            markDevStepComplete(2);
            await refresh();
            toast.success('O-Level verification was bypassed for local testing.');
            navigate('/onboarding/payment');
            return;
          }
          throw error;
        }
      }

      markDevStepComplete(2);
      await refresh();
      toast.success('Exam details verified. Review your payment summary next.');
      navigate('/onboarding/payment');
    } catch (error) {
      toast.error(errMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <OnboardingLayout step={2}>
      <form
        onSubmit={submit}
        className="rounded-xl border border-[#E4E9F5] bg-white px-5 py-6 sm:px-8 sm:py-7 lg:px-10 lg:py-[30px]"
      >
        <div>
          <h1 className="text-[26px] font-bold leading-[30px] text-[#0A2B72] sm:text-[28px]">Exam details</h1>
          <p className="mt-2 text-[15px] leading-5 text-[#66799D] sm:text-[16px]">Enter your JAMB and O’level information</p>
        </div>

        <div className="mt-3.5">
          <InfoBanner>
            <strong>NOTE:</strong> Please ensure all details are correct before payment. Incorrect information may invalidate your application, and corrections may incur additional charges.
          </InfoBanner>
        </div>

        <div className="mt-4 sm:mt-5">
          <FieldShell label="JAMB reg number" error={errors.jambRegNo}>
            <div className="relative">
              <input
                value={jambRegNo}
                onChange={changeJamb}
                placeholder="e.g 222333222AB"
                autoCapitalize="characters"
                className={`${inputClass(Boolean(errors.jambRegNo))} ${jambVerified ? 'pr-10' : ''}`}
              />
              {jambVerified && (
                <span className="pointer-events-none absolute right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-green-100 text-green-700">
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
              )}
            </div>
          </FieldShell>
        </div>

        <section className="mt-5 sm:mt-6">
          <h2 className="text-[22px] font-bold leading-[30px] text-[#0A2B72] sm:text-[24px]">O’level details</h2>

          <div className="mt-4">
            <InfoBanner compact>
              Entering two sittings will require an additional processing fee.
            </InfoBanner>
          </div>

          <div className="mt-5 space-y-5 sm:mt-6 sm:space-y-4">
            {sittings.map((sitting, index) => (
              <SittingFields
                key={index}
                sitting={sitting}
                index={index}
                errors={errors.sittings?.[index]}
                onChange={changeSitting}
              />
            ))}
          </div>

          <div className="mt-4 flex justify-stretch sm:justify-end">
            {sittings.length === 1 ? (
              <button
                type="button"
                onClick={addSitting}
                className="flex h-[55px] w-full items-center justify-center gap-2 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] px-4 text-[16px] text-[#2563EB] transition hover:bg-[#E8F2FF] sm:w-[226px] sm:text-[18px]"
              >
                Add another sitting
                <Plus className="h-6 w-6" strokeWidth={1.8} />
              </button>
            ) : (
              <button
                type="button"
                onClick={removeSitting}
                className="flex h-[55px] w-full items-center justify-center gap-2 rounded-xl border border-[#D6E4FF] bg-[#F5F8FF] px-4 text-[16px] text-[#344054] transition hover:bg-[#EDF3FF] sm:w-[226px] sm:text-[18px]"
              >
                Remove sitting
                <Ban className="h-6 w-6" strokeWidth={1.8} />
              </button>
            )}
          </div>

          {serverLimitation && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] leading-5 text-amber-900 sm:text-[13px]">
              {serverLimitation}
            </div>
          )}
        </section>

        <div className="mt-7 grid grid-cols-1 gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-8">
          <button
            type="button"
            onClick={() => navigate('/onboarding/biodata')}
            disabled={saving}
            className="flex h-[55px] w-full items-center justify-center gap-2 rounded-xl border border-[#BFC4D0] bg-white px-5 text-[18px] text-black transition hover:bg-[#F9FBFF] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ArrowLeft className="h-6 w-6" strokeWidth={1.8} />
            Back
          </button>

          <OnboardingPrimaryButton type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Verifying…
              </>
            ) : (
              'Continue'
            )}
          </OnboardingPrimaryButton>
        </div>
      </form>
    </OnboardingLayout>
  );
}
