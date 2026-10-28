import { ArrowLeft, Info, Loader2, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OnboardingLayout, OnboardingPrimaryButton } from '../../components/onboarding/OnboardingLayout';
import { useOnboarding } from '../../context/OnboardingContext';
import { useToast } from '../../components/ui/Toast';
import api, { errMessage } from '../../lib/api';
import { naira } from '../../lib/constants';

const QUOTE_ENDPOINT = '/sessions/quote';

function InfoBanner({ children, tone = 'primary' }) {
  const tones = {
    primary: 'bg-primary-light text-primary',
    success: 'bg-green-50 text-success',
  };
  return (
    <div className={`flex items-start gap-3 rounded-lg px-4 py-2.5 sm:px-5 ${tones[tone]}`}>
      <span className="mt-0.5 flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-full">
        {tone === 'success'
          ? <ShieldCheck className="h-[17px] w-[17px]" strokeWidth={2} />
          : <Info className="h-[17px] w-[17px]" strokeWidth={2} />}
      </span>
      <p className="min-w-0 text-[12px] leading-[19px] sm:text-[14px] sm:leading-[19.2px]">{children}</p>
    </div>
  );
}

function SummaryRow({ label, value, emphasized = false }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 sm:gap-4">
      <span className={`shrink-0 text-[15px] leading-5 text-ink sm:text-[18px] ${emphasized ? 'font-medium' : ''}`}>
        {label}
      </span>
      <span aria-hidden="true" className="min-w-4 flex-1 border-b border-dotted border-border" />
      <span
        className={`shrink-0 text-right leading-5 ${
          emphasized
            ? 'text-[20px] font-bold text-primary sm:text-[24px]'
            : 'text-[15px] text-ink sm:text-[18px]'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * How many O'Level sittings the applicant recorded on the exam-details step.
 * The server is authoritative: /profile/completion reports it, and /profile
 * carries the sittings themselves. Guessing is what previously made two
 * sittings price as one.
 */
function recordedSittingCount(profile, completion) {
  const fromCompletion = Number(
    completion?.sittingCount ?? completion?.steps?.examDetails?.sittingCount
  );
  if (fromCompletion === 2) return 2;
  if (fromCompletion === 1) return 1;

  const sittings = Array.isArray(profile?.olevelSittings) ? profile.olevelSittings : [];
  return sittings.length >= 2 ? 2 : 1;
}

export default function PaymentSummaryStep() {
  const navigate = useNavigate();
  const toast = useToast();
  const { profile: profilePayload, completion, refresh } = useOnboarding();
  const profile = profilePayload?.profile || {};

  const sittingCount = useMemo(
    () => recordedSittingCount(profile, completion),
    [profile, completion]
  );
  const sittingKey = sittingCount === 2 ? 'two' : 'one';

  const [pricing, setPricing] = useState(null);     // { one, two, testMode }
  const [loadingQuote, setLoadingQuote] = useState(true);
  const [quoteError, setQuoteError] = useState('');
  const [paying, setPaying] = useState(false);

  const loadQuote = useCallback(async () => {
    setLoadingQuote(true);
    setQuoteError('');
    try {
      // Prices are whatever the admin set under Admin → Fees. Always ask the
      // server: a hard-coded fallback is how a changed fee goes unnoticed.
      const response = await api.get(QUOTE_ENDPOINT);
      const data = response.data?.data;
      if (!data?.one || !data?.two) throw new Error('No fee quote returned');
      setPricing(data);
    } catch (error) {
      setQuoteError(errMessage(error, 'We could not load the current fees. Please try again.'));
    } finally {
      setLoadingQuote(false);
    }
  }, []);

  useEffect(() => { loadQuote(); }, [loadQuote]);

  const selected = pricing?.[sittingKey] || null;
  const twoSittings = sittingCount === 2;
  const testMode = !!pricing?.testMode;

  const lines = selected
    ? [
        { key: 'exam-processing', label: 'Exam processing fee', amount: selected.examProcessingNaira },
        ...(twoSittings
          ? [{ key: 'second-sitting', label: 'Second sitting fee', amount: selected.secondSittingNaira }]
          : []),
      ]
    : [];

  async function proceedToPayment() {
    if (!selected) return;
    setPaying(true);
    try {
      const sittingType = sittingKey;

      // Reuse the applicant's existing session if there is one, so a retry
      // never creates a second charge.
      const current = await api.get('/sessions/current').then((r) => r.data?.data).catch(() => null);
      let session = current && current.status === 'pending_payment' ? current : null;

      if (!session) {
        const created = await api.post('/sessions', { sittingType });
        session = created.data?.data;
      }
      // Re-price the session against what this page is showing, so the amount
      // charged always matches the total the applicant just read.
      if (session.sittingType !== sittingType) {
        const updated = await api.patch(`/sessions/${session.id}/sitting-type`, { sittingType });
        session = updated.data?.data;
      }

      const pay = await api.post('/payments/session/initialize', { sessionId: session.id });
      const authorizationUrl = pay.data?.data?.authorizationUrl;
      if (!authorizationUrl) throw new Error('The payment gateway did not return a checkout URL.');
      window.location.assign(authorizationUrl);
    } catch (error) {
      toast.error(errMessage(error, 'We could not start the payment. Please try again.'));
      setPaying(false);
      refresh().catch(() => {});
    }
  }

  return (
    <OnboardingLayout step={3}>
      <section className="rounded-xl border border-border bg-white px-5 py-6 sm:px-8 sm:py-7 lg:px-10 lg:py-[30px]">
        <div>
          <h1 className="text-[26px] font-bold leading-[30px] text-primary-dark sm:text-[28px]">Payment Summary</h1>
          <p className="mt-2 text-[15px] leading-5 text-muted sm:text-[16px]">Review charges before making payment</p>
        </div>

        <div className="mt-3.5 space-y-3">
          <InfoBanner>
            <strong>NOTE:</strong> Please ensure all details are correct before payment. Incorrect information may invalidate your application, and corrections may incur additional charges.
          </InfoBanner>

          {testMode && (
            <InfoBanner tone="success">
              <strong>Test mode:</strong> no money will be taken. Continue and your application will be
              unlocked straight away so you can try the rest of the flow.
            </InfoBanner>
          )}
        </div>

        {loadingQuote ? (
          <div className="mt-8 flex items-center gap-3 text-[15px] text-muted">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            Loading the current fees…
          </div>
        ) : quoteError ? (
          <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] leading-5 text-red-800">
            <p>{quoteError}</p>
            <button
              type="button"
              onClick={loadQuote}
              className="mt-2 font-medium text-red-900 underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-7 sm:mt-5 sm:space-y-[38px]">
            <div className="space-y-7 sm:space-y-[38px]">
              {lines.map((line) => (
                <SummaryRow key={line.key} label={line.label} value={naira(line.amount)} />
              ))}
            </div>

            <div className="border-t border-[#D6DCE8]" />

            <div className="space-y-7 sm:space-y-[38px]">
              <SummaryRow label="Sitting Type" value={twoSittings ? 'Two Sittings' : 'One Sitting'} />
              <SummaryRow label="Total Amount" value={naira(selected.totalNaira)} emphasized />
            </div>

            {twoSittings ? (
              <InfoBanner>
                You recorded two O-Level sittings, so the {naira(selected.secondSittingNaira)} second-sitting
                processing charge has been added to your invoice.{' '}
                <button
                  type="button"
                  onClick={() => navigate('/onboarding/exam-details')}
                  className="font-semibold underline underline-offset-2"
                >
                  Change sittings
                </button>
              </InfoBanner>
            ) : (
              <InfoBanner>
                You recorded one O-Level sitting.{' '}
                <button
                  type="button"
                  onClick={() => navigate('/onboarding/exam-details')}
                  className="font-semibold underline underline-offset-2"
                >
                  Add a second sitting
                </button>{' '}
                to have another result verified — it adds {naira(pricing.two.secondSittingNaira)}.
              </InfoBanner>
            )}
          </div>
        )}

        <div className="mt-7 grid grid-cols-1 gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-8">
          <button
            type="button"
            onClick={() => navigate('/onboarding/exam-details')}
            disabled={paying}
            className="flex h-[55px] w-full items-center justify-center gap-2 rounded-xl border border-border bg-white px-5 text-[18px] text-ink transition hover:bg-primary-surface disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ArrowLeft className="h-6 w-6" strokeWidth={1.8} />
            Back
          </button>

          <OnboardingPrimaryButton
            type="button"
            onClick={proceedToPayment}
            disabled={paying || loadingQuote || !selected}
          >
            {paying ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {testMode ? 'Continuing…' : 'Redirecting…'}
              </>
            ) : testMode ? (
              'Continue'
            ) : (
              'Proceed to Payment'
            )}
          </OnboardingPrimaryButton>
        </div>
      </section>
    </OnboardingLayout>
  );
}
