import { ArrowLeft, Info, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OnboardingLayout, OnboardingPrimaryButton } from '../../components/onboarding/OnboardingLayout';
import { useOnboarding } from '../../context/OnboardingContext';
import { useToast } from '../../components/ui/Toast';
import api, { errMessage } from '../../lib/api';
import { naira } from '../../lib/constants';

const PROFILE_COMPLETION_FEE = 20000;
const SECOND_SITTING_FEE = 10000;
const QUOTE_ENDPOINT = '/payments/profile-completion/quote';

function InfoBanner({ children }) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-primary-light px-4 py-2.5 sm:px-5">
      <span className="mt-0.5 flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
        <Info className="h-[17px] w-[17px]" strokeWidth={2} />
      </span>
      <p className="min-w-0 text-[12px] leading-[19px] text-primary sm:text-[14px] sm:leading-[19.2px]">
        {children}
      </p>
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

function getPersistedSittingCount(profile, completion) {
  const profileSittings = Array.isArray(profile?.olevelSittings)
    ? profile.olevelSittings.filter((sitting) => sitting && sitting.verified !== false)
    : [];

  if (profileSittings.length) return Math.min(profileSittings.length, 2);

  const completionCount = Number(
    completion?.sittingCount ??
    completion?.olevelSittingCount ??
    completion?.steps?.examDetails?.sittingCount
  );
  if (completionCount === 2) return 2;

  return profile?.olevelVerified ? 1 : 1;
}

function fallbackQuote(sittingCount) {
  const twoSittings = sittingCount === 2;
  return {
    sittingCount,
    sittingType: twoSittings ? 'Two Sittings' : 'One Sitting',
    items: [
      { key: 'exam-processing', label: 'Exam processing fee', amount: PROFILE_COMPLETION_FEE },
      ...(twoSittings
        ? [{ key: 'second-sitting', label: 'Second sitting fee', amount: SECOND_SITTING_FEE }]
        : []),
    ],
    total: PROFILE_COMPLETION_FEE + (twoSittings ? SECOND_SITTING_FEE : 0),
    serverVerified: false,
  };
}

function normalizeQuote(payload, fallback) {
  const source = payload?.quote || payload?.paymentQuote || payload || {};
  const sittingCount = Number(source.sittingCount || source.olevelSittingCount || fallback.sittingCount);
  const rawItems = Array.isArray(source.items) ? source.items : [];
  const items = rawItems.length
    ? rawItems.map((item, index) => ({
        key: item.key || item.code || `item-${index}`,
        label: item.label || item.name || 'Processing fee',
        amount: Number(item.amount ?? item.amountNaira ?? 0),
      }))
    : fallback.items;
  const total = Number(source.total ?? source.totalAmount ?? source.amountNaira ?? fallback.total);

  return {
    sittingCount: sittingCount === 2 ? 2 : 1,
    sittingType: source.sittingType || (sittingCount === 2 ? 'Two Sittings' : 'One Sitting'),
    items,
    total: Number.isFinite(total) ? total : fallback.total,
    serverVerified: true,
  };
}

export default function PaymentSummaryStep() {
  const navigate = useNavigate();
  const toast = useToast();
  const { profile: profilePayload, completion, status } = useOnboarding();
  const profile = profilePayload?.profile || {};

  const sittingCount = useMemo(
    () => getPersistedSittingCount(profile, completion),
    [profile, completion]
  );
  const provisionalQuote = useMemo(() => fallbackQuote(sittingCount), [sittingCount]);
  const [quote, setQuote] = useState(provisionalQuote);
  const [quoteState, setQuoteState] = useState('loading'); // loading | ready | unavailable
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    let active = true;
    setQuote(provisionalQuote);
    setQuoteState('loading');

    const embeddedQuote = completion?.paymentQuote || completion?.quote || completion?.steps?.payment?.quote;
    if (embeddedQuote) {
      setQuote(normalizeQuote(embeddedQuote, provisionalQuote));
      setQuoteState('ready');
      return () => {
        active = false;
      };
    }

    // The current backend has no Screen 3 contract yet. Avoid deliberately
    // generating a 404 on every page load. Once /profile/completion exposes
    // steps.payment (even as false), the frontend knows the new backend
    // contract exists and can request its server-authoritative quote.
    if (!status.backendPaymentStateAvailable) {
      setQuoteState('unavailable');
      return () => {
        active = false;
      };
    }

    (async () => {
      try {
        const response = await api.get(QUOTE_ENDPOINT);
        if (!active) return;
        setQuote(normalizeQuote(response.data?.data, provisionalQuote));
        setQuoteState('ready');
      } catch (error) {
        if (!active) return;
        const status = error?.response?.status;
        if (status !== 404 && status !== 405) {
          // Keep the visual summary usable even if the quote service is temporarily unavailable.
          // Payment itself remains blocked until a server-authoritative quote exists.
          console.warn('Profile-completion quote could not be loaded:', errMessage(error));
        }
        setQuote(provisionalQuote);
        setQuoteState('unavailable');
      }
    })();

    return () => {
      active = false;
    };
  }, [completion, provisionalQuote, status.backendPaymentStateAvailable]);

  async function proceedToPayment() {
    if (!quote.serverVerified || quoteState !== 'ready') {
      toast.info('Profile-completion payment is waiting for the backend payment endpoint. Your details are safe, and no payment has been started.');
      return;
    }

    setPaying(true);
    try {
      const response = await api.post('/payments/initialize', { purpose: 'profile_completion' });
      const authorizationUrl = response.data?.data?.authorizationUrl;
      if (!authorizationUrl) throw new Error('The payment gateway did not return a checkout URL.');
      window.location.assign(authorizationUrl);
    } catch (error) {
      toast.error(errMessage(error, 'We could not start the payment. Please try again.'));
      setPaying(false);
    }
  }

  const twoSittings = quote.sittingCount === 2;

  return (
    <OnboardingLayout step={3}>
      <section className="rounded-xl border border-border bg-white px-5 py-6 sm:px-8 sm:py-7 lg:px-10 lg:py-[30px]">
        <div>
          <h1 className="text-[26px] font-bold leading-[30px] text-primary-dark sm:text-[28px]">Payment Summary</h1>
          <p className="mt-2 text-[15px] leading-5 text-muted sm:text-[16px]">Review charges before making payment</p>
        </div>

        <div className="mt-3.5">
          <InfoBanner>
            <strong>NOTE:</strong> Please ensure all details are correct before payment. Incorrect information may invalidate your application, and corrections may incur additional charges.
          </InfoBanner>
        </div>

        <div className="mt-4 space-y-7 sm:mt-5 sm:space-y-[38px]">
          <div className="space-y-7 sm:space-y-[38px]">
            {quote.items.map((item) => (
              <SummaryRow key={item.key} label={item.label} value={naira(item.amount)} />
            ))}
          </div>

          <div className="border-t border-[#D6DCE8]" />

          <div className="space-y-7 sm:space-y-[38px]">
            <SummaryRow label="Sitting Type" value={quote.sittingType} />
            <SummaryRow label="Total Amount" value={naira(quote.total)} emphasized />
          </div>

          {twoSittings && (
            <InfoBanner>
              You selected two O-Level sittings. The second-sitting processing charge has been included in your invoice.
            </InfoBanner>
          )}
        </div>

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

          <OnboardingPrimaryButton type="button" onClick={proceedToPayment} disabled={paying}>
            {paying ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Redirecting…
              </>
            ) : (
              'Proceed to Payment'
            )}
          </OnboardingPrimaryButton>
        </div>
      </section>
    </OnboardingLayout>
  );
}
