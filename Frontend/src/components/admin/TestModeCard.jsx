import { useEffect, useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { Card, Button, Badge } from '../ui/Primitives';
import { useToast } from '../ui/Toast';
import api, { errMessage } from '../../lib/api';

/**
 * The one switch for free onboarding while the team tests:
 *   ON  → NIN is accepted without the Dojah lookup, and the exam-processing
 *         fee settles without going to Paystack.
 *   OFF → live NIN lookup and live Paystack checkout.
 * Backed by GET/PATCH /admin/test-mode (services/testMode.service.js).
 */
export default function TestModeCard() {
  const toast = useToast();
  const [state, setState] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/admin/test-mode')
      .then((r) => setState(r.data?.data || null))
      .catch(() => setState(null));
  }, []);

  async function toggle() {
    const next = !state?.enabled;
    if (!next || window.confirm('Turn testing mode ON? Applicants will skip NIN lookup and pay nothing.')) {
      setSaving(true);
      try {
        const { data } = await api.patch('/admin/test-mode', { enabled: next });
        setState(data.data);
        toast.success(next ? 'Testing mode is on' : 'Testing mode is off — live NIN and payments are back');
      } catch (err) {
        toast.error(errMessage(err));
      } finally {
        setSaving(false);
      }
    }
  }

  if (!state) return null;
  const on = state.enabled;

  return (
    <Card className={`mb-6 border ${on ? 'border-amber-300 bg-amber-50/60' : 'border-border'}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${on ? 'bg-amber-100 text-warning' : 'bg-primary-light text-primary'}`}>
            <FlaskConical className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-base font-bold text-primary">Testing mode</h2>
              <Badge className={on ? 'bg-amber-100 text-warning' : 'bg-green-50 text-success'}>
                {on ? 'ON — no NIN lookup, no payment' : 'OFF — live'}
              </Badge>
            </div>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              While on, applicants finish onboarding without the Dojah NIN lookup and without paying the
              exam-processing fee. Everything else (JAMB/O’Level checks, eligibility, admissions) runs normally.
              Test records are tagged so they can be cleaned up. Turn this off before going live.
            </p>
            {state.forcedByEnvironment && (
              <p className="mt-2 text-xs text-warning">
                Forced on by TEST_MODE_FREE_ONBOARDING in the server environment — remove that variable to control it here.
              </p>
            )}
          </div>
        </div>
        <Button
          onClick={toggle}
          loading={saving}
          disabled={state.forcedByEnvironment}
          variant={on ? 'secondary' : 'primary'}
        >
          {on ? 'Turn off' : 'Turn on'}
        </Button>
      </div>
    </Card>
  );
}
