import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronDown, CloudUpload, Info, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { OnboardingLayout, OnboardingPrimaryButton } from '../../components/onboarding/OnboardingLayout';
import { useOnboarding } from '../../context/OnboardingContext';
import { useToast } from '../../components/ui/Toast';
import api, { errMessage } from '../../lib/api';
import { NIGERIAN_STATES } from '../../lib/constants';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function FieldShell({ label, error, children }) {
  return (
    <label className="block min-w-0">
      <span className="mb-3.5 block text-[15px] font-normal leading-none text-black sm:text-[16px]">{label}</span>
      {children}
      {error && <span className="mt-1.5 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

const fieldClass = (error) =>
  `h-11 w-full rounded-xl border bg-white px-3 text-[16px] text-black shadow-[0_-1px_0.5px_#BBCEFF,0_1px_0.5px_#BBCEFF] outline-none transition placeholder:text-[#6B7280] focus:border-[#0D57E8] focus:ring-4 focus:ring-[#0D57E8]/10 ${
    error ? 'border-red-500' : 'border-[#BBCEFF]'
  }`;

function SelectField({ label, value, onChange, error, children }) {
  return (
    <FieldShell label={label} error={error}>
      <div className="relative">
        <select value={value} onChange={onChange} className={`${fieldClass(error)} appearance-none pr-10`}>
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6B7280]" strokeWidth={1.8} />
      </div>
    </FieldShell>
  );
}

function TextField({ label, error, className = '', ...props }) {
  return (
    <FieldShell label={label} error={error}>
      <input className={`${fieldClass(error)} ${className}`} {...props} />
    </FieldShell>
  );
}

export default function BiodataStep() {
  const navigate = useNavigate();
  const toast = useToast();
  const { profile: profilePayload, refresh, markDevStepComplete } = useOnboarding();
  const p = profilePayload?.profile || {};
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    dateOfBirth: p.dateOfBirth ? String(p.dateOfBirth).slice(0, 10) : '',
    gender: p.gender || '',
    stateOfOrigin: p.stateOfOrigin || '',
    lga: p.lga || '',
    nin: p.ninVerified ? p.nin || '' : '',
    location: p.location || '',
  });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(p.profileImageUrl || null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return () => {
      if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const hasExistingPhoto = Boolean(p.profileImageUrl);
  const photoReady = hasExistingPhoto || Boolean(file);

  const photoLabel = useMemo(() => {
    if (file) return file.name;
    if (hasExistingPhoto) return 'Passport photograph uploaded';
    return 'Upload passport photograph';
  }, [file, hasExistingPhoto]);

  const set = (key) => (event) => {
    const value = event.target.value;
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  function chooseFile(event) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (!ALLOWED_IMAGE_TYPES.includes(selected.type)) {
      setErrors((current) => ({ ...current, photo: 'Use a JPG, PNG or WebP image.' }));
      return;
    }
    if (selected.size > MAX_IMAGE_SIZE) {
      setErrors((current) => ({ ...current, photo: 'Image must be 5MB or smaller.' }));
      return;
    }

    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setErrors((current) => ({ ...current, photo: undefined }));
  }

  function validate() {
    const next = {};
    if (!form.dateOfBirth) next.dateOfBirth = 'Enter your date of birth.';
    if (!form.gender) next.gender = 'Select your gender.';
    if (!form.stateOfOrigin) next.stateOfOrigin = 'Select your state of origin.';
    if (!form.lga.trim()) next.lga = 'Enter your LGA.';
    if (!form.location.trim()) next.location = 'Enter your city or area.';
    if (!p.ninVerified && !/^\d{11}$/.test(form.nin.trim())) next.nin = 'NIN must be 11 digits.';
    if (!photoReady) next.photo = 'Upload a passport photograph.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event) {
    event.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      await api.put('/profile', {
        dateOfBirth: form.dateOfBirth,
        gender: form.gender,
        stateOfOrigin: form.stateOfOrigin,
        lga: form.lga.trim(),
        location: form.location.trim(),
      });

      let ninBypassedForTesting = false;
      if (!p.ninVerified) {
        try {
          await api.post('/profile/verify-nin', { nin: form.nin.trim() });
        } catch (error) {
          const status = error?.response?.status;
          const message = errMessage(error);
          const ninNotFound = status === 404 || /nin.*not found|not found.*nin|validation service/i.test(message);

          if (import.meta.env.DEV && ninNotFound) {
            // Temporary local-development escape hatch so onboarding can be
            // tested while the deployed backend has no seeded demo NINs.
            ninBypassedForTesting = true;
          } else {
            throw error;
          }
        }
      }

      let photoBypassedForTesting = false;
      if (file) {
        const body = new FormData();
        body.append('image', file);
        try {
          await api.post('/profile/image', body);
        } catch (error) {
          const status = error?.response?.status;
          if (import.meta.env.DEV && status === 502) {
            // Temporary local-development escape hatch so the remaining
            // onboarding screens can be tested while backend image storage is
            // unavailable. This is deliberately disabled in production builds.
            photoBypassedForTesting = true;
          } else {
            const message = `Your biodata was saved, but your passport photo could not be uploaded. ${errMessage(error)}`;
            setErrors((current) => ({ ...current, photo: message }));
            toast.error(message);
            return;
          }
        }
      }

      // In local development, remember that this account completed Step 1.
      // This survives logout/login so returning-applicant routing can be tested
      // even while the backend image/NIN services are unavailable.
      markDevStepComplete(1);
      await refresh();
      if (photoBypassedForTesting || ninBypassedForTesting) {
        const bypassed = [
          photoBypassedForTesting ? 'passport photo upload' : null,
          ninBypassedForTesting ? 'NIN verification' : null,
        ].filter(Boolean).join(' and ');
        toast.info(`${bypassed} ${photoBypassedForTesting && ninBypassedForTesting ? 'are' : 'is'} temporarily bypassed in local development so you can test the remaining onboarding screens.`);
      } else {
        toast.success('Biodata saved. Continue with your exam details.');
      }
      navigate('/onboarding/exam-details');
    } catch (error) {
      toast.error(errMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <OnboardingLayout step={1}>
      <form
        onSubmit={submit}
        className="rounded-xl border border-[#E4E9F5] bg-white px-5 py-6 sm:px-8 sm:py-7 lg:px-10"
      >
        <div>
          <h1 className="text-[26px] font-bold leading-[30px] text-[#0A2B72] sm:text-[28px]">Biodata</h1>
          <p className="mt-2 text-[15px] leading-5 text-[#66799D] sm:text-[16px]">Enter your personal details</p>
        </div>

        <div className="mt-3.5 flex items-start gap-3 rounded-lg bg-[#E8F4FF] px-4 py-2.5 sm:px-5">
          <span className="mt-0.5 flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-full bg-[#BFE2FF] text-[#0D57E8]">
            <Info className="h-[17px] w-[17px]" strokeWidth={2} />
          </span>
          <p className="text-[12px] leading-[19px] text-[#0D57E8] sm:text-[14px] sm:leading-[19.2px]">
            <strong>NOTE:</strong> Please ensure all details are correct before payment. Incorrect information may invalidate your application, and corrections may incur additional charges.
          </p>
        </div>

        <div className="mt-3.5">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={chooseFile}
            className="sr-only"
            id="passport-photo"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`flex min-h-[186px] w-full flex-col items-center justify-center rounded-lg border border-dashed bg-white px-5 py-4 text-center transition hover:bg-[#F9FBFF] ${errors.photo ? 'border-red-500' : 'border-[#0D57E8]'}`}
          >
            {preview ? (
              <img src={preview} alt="Passport preview" className="mb-2 h-16 w-16 rounded-xl object-cover ring-1 ring-[#E4E9F5]" />
            ) : (
              <span className="mb-2 flex h-[47px] w-[55px] items-center justify-center rounded-lg bg-[#E8F4FF] text-[#0D57E8]">
                <CloudUpload className="h-8 w-8" strokeWidth={2} />
              </span>
            )}
            <span className="text-[14px] font-bold text-black sm:text-[16px]">{photoLabel}</span>
            <span className="mt-1 max-w-[310px] text-[11px] leading-4 text-black sm:text-[12px]">
              Upload a clear passport photo of yourself on a white background
            </span>
            <span className="mt-2.5 rounded border border-[#E4E9F5] bg-white px-3 py-2 text-[12px] text-black">
              {preview ? 'Change file' : 'Browse files'}
            </span>
          </button>
          {errors.photo && <p className="mt-1.5 text-xs text-red-600">{errors.photo}</p>}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 sm:gap-y-6">
          <FieldShell label="Date of birth" error={errors.dateOfBirth}>
            <div className="relative">
              <input
                type="date"
                value={form.dateOfBirth}
                onChange={set('dateOfBirth')}
                className={`${fieldClass(errors.dateOfBirth)} pr-10`}
              />
              <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6B7280] sm:hidden" strokeWidth={1.7} />
            </div>
          </FieldShell>

          <SelectField label="Gender" value={form.gender} onChange={set('gender')} error={errors.gender}>
            <option value="">Select</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </SelectField>

          <SelectField label="State of origin" value={form.stateOfOrigin} onChange={set('stateOfOrigin')} error={errors.stateOfOrigin}>
            <option value="">Select</option>
            {NIGERIAN_STATES.map((state) => (
              <option key={state} value={state}>{state}</option>
            ))}
          </SelectField>

          <TextField label="LGA" value={form.lga} onChange={set('lga')} error={errors.lga} />

          <FieldShell label="NIN" error={errors.nin}>
            <div className="relative">
              <input
                value={form.nin}
                onChange={(event) => {
                  if (p.ninVerified) return;
                  setForm((current) => ({ ...current, nin: event.target.value.replace(/\D/g, '').slice(0, 11) }));
                  setErrors((current) => ({ ...current, nin: undefined }));
                }}
                placeholder="11 digits"
                inputMode="numeric"
                readOnly={p.ninVerified}
                className={`${fieldClass(errors.nin)} ${p.ninVerified ? 'pr-10 text-[#344054]' : ''}`}
              />
              {p.ninVerified && (
                <span className="absolute right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-green-100 text-green-700" title="NIN verified">
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                </span>
              )}
            </div>
          </FieldShell>

          <TextField label="Location" value={form.location} onChange={set('location')} error={errors.location} placeholder="City / area" />
        </div>

        <div className="mt-7 sm:mt-8">
          <OnboardingPrimaryButton type="submit" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Saving…
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
