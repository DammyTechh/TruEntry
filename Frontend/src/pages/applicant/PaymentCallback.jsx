import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, Button, Spinner } from '../../components/ui/Primitives';
import api, { errMessage } from '../../lib/api';

// Paystack redirects here: /payment/callback?reference=...&trxref=...
// The same callback supports application payments today and is ready for the
// future profile-completion payment purpose used by onboarding Step 3.
export default function PaymentCallback() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [state, setState] = useState('verifying'); // verifying | success | failed
  const [message, setMessage] = useState('');
  const [payment, setPayment] = useState(null);
  const [destination, setDestination] = useState('/onboarding');

  useEffect(() => {
    const reference = params.get('reference') || params.get('trxref');
    if (!reference) {
      setState('failed');
      setMessage('No payment reference was provided.');
      return;
    }

    let active = true;
    (async () => {
      try {
        const { data } = await api.get(`/payments/verify/${reference}`);
        if (!active) return;

        const verifiedPayment = data?.data?.payment || null;
        setPayment(verifiedPayment);

        if (verifiedPayment?.purpose === 'profile_completion') {
          // Verification is the point at which the backend should mark Step 3
          // complete. Re-check the server source of truth instead of trusting
          // the browser or the Paystack redirect alone.
          try {
            const completionResponse = await api.get('/profile/completion');
            const complete = completionResponse.data?.data?.complete === true;
            setDestination(complete ? '/app' : '/onboarding');
          } catch {
            setDestination('/onboarding');
          }
        } else {
          const appId = verifiedPayment?.applicationId;
          setDestination(appId ? `/app/applications/${appId}` : '/app/applications');
        }

        setState('success');
      } catch (err) {
        if (!active) return;
        setState('failed');
        setMessage(errMessage(err, 'We could not confirm your payment.'));
        // Preserve the existing application-payment return path. If this was
        // an onboarding payment, the applicant dashboard guard will redirect
        // an incomplete user back into onboarding.
        setDestination('/app/applications');
      }
    })();

    return () => {
      active = false;
    };
  }, [params]);

  const isProfileCompletion = payment?.purpose === 'profile_completion';

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary-surface p-4">
      <Card className="max-w-md text-center">
        {state === 'verifying' && (
          <>
            <Spinner className="mx-auto h-8 w-8 text-primary" />
            <h2 className="mt-4 text-lg font-semibold text-ink">Confirming your payment…</h2>
            <p className="mt-1 text-sm text-muted">This only takes a moment.</p>
          </>
        )}

        {state === 'success' && (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-lg text-success">✓</div>
            <h2 className="mt-4 text-lg font-semibold text-ink">Payment confirmed</h2>
            <p className="mt-1 text-sm text-muted">
              {isProfileCompletion
                ? 'Your account setup payment has been confirmed.'
                : 'Your application has been submitted.'}
            </p>
            <Button onClick={() => nav(destination)} className="mt-5 w-full">
              {isProfileCompletion ? 'Continue' : 'View application'}
            </Button>
          </>
        )}

        {state === 'failed' && (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-lg text-danger">!</div>
            <h2 className="mt-4 text-lg font-semibold text-ink">Payment not confirmed</h2>
            <p className="mt-1 text-sm text-muted">{message}</p>
            <Button onClick={() => nav(destination)} variant="secondary" className="mt-5 w-full">
              Return to account
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
