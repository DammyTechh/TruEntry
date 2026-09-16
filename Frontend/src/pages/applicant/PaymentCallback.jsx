import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { Card, Button, Spinner } from '../../components/ui/Primitives';
import api, { errMessage } from '../../lib/api';

/**
 * Paystack redirects here: /payment/callback?reference=…&trxref=…
 *
 * The reference covers either an application fee or a session's exam-processing
 * fee, so the verify response decides where to send the applicant next. The
 * webhook settles the payment server-side regardless — this screen just gives
 * the applicant immediate feedback.
 */
export default function PaymentCallback() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [state, setState] = useState('verifying'); // verifying | success | failed
  const [message, setMessage] = useState('');
  const [next, setNext] = useState('/app/applications');

  useEffect(() => {
    const reference = params.get('reference') || params.get('trxref');
    if (!reference) {
      setState('failed');
      setMessage('No payment reference was provided.');
      return;
    }
    (async () => {
      try {
        const { data } = await api.get(`/payments/verify/${reference}`);
        const payment = data?.data?.payment || data?.data;

        if (payment?.purpose === 'verification' || payment?.sessionId) {
          // Exam-processing fee — continue the application flow at verification.
          setNext('/app/apply?paid=1');
        } else if (payment?.applicationId) {
          setNext(`/app/applications/${payment.applicationId}`);
        }
        setState('success');
      } catch (err) {
        setState('failed');
        setMessage(errMessage(err, 'We could not confirm your payment.'));
      }
    })();
  }, [params]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary-surface p-4">
      <Card className="max-w-md p-8 text-center">
        {state === 'verifying' && (
          <>
            <Spinner className="mx-auto h-8 w-8 text-primary" />
            <h2 className="mt-4 text-lg font-semibold text-ink">Confirming your payment…</h2>
            <p className="mt-1 text-sm text-muted">This only takes a moment.</p>
          </>
        )}
        {state === 'success' && (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-success">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-ink">Payment confirmed</h2>
            <p className="mt-1 text-sm text-muted">You can now continue your application.</p>
            <Button onClick={() => nav(next)} className="mt-6 w-full">Continue</Button>
          </>
        )}
        {state === 'failed' && (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-danger">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-ink">Payment not confirmed</h2>
            <p className="mt-1 text-sm text-muted">{message}</p>
            <p className="mt-2 text-xs text-muted">
              If you were charged, your payment will still be recorded automatically — check back shortly.
            </p>
            <Button onClick={() => nav('/app/apply')} variant="secondary" className="mt-6 w-full">
              Back to application
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
