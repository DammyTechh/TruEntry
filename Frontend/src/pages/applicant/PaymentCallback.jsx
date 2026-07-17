import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, Button, Spinner } from '../../components/ui/Primitives';
import api, { errMessage } from '../../lib/api';

// Paystack redirects here: /payment/callback?reference=...&trxref=...
// There is no application id in the URL, so we resolve it from the verify response.
export default function PaymentCallback() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [state, setState] = useState('verifying'); // verifying | success | failed
  const [message, setMessage] = useState('');
  const [appId, setAppId] = useState(null);

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
        setAppId(data?.data?.payment?.applicationId || null);
        setState('success');
      } catch (err) {
        setState('failed');
        setMessage(errMessage(err, 'We could not confirm your payment.'));
      }
    })();
  }, [params]);

  const goToApp = () => nav(appId ? `/app/applications/${appId}` : '/app/applications');

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
            <p className="mt-1 text-sm text-muted">Your application has been submitted.</p>
            <Button onClick={goToApp} className="mt-5 w-full">View application</Button>
          </>
        )}
        {state === 'failed' && (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-lg text-danger">!</div>
            <h2 className="mt-4 text-lg font-semibold text-ink">Payment not confirmed</h2>
            <p className="mt-1 text-sm text-muted">{message}</p>
            <Button onClick={goToApp} variant="secondary" className="mt-5 w-full">Back to my applications</Button>
          </>
        )}
      </Card>
    </div>
  );
}
