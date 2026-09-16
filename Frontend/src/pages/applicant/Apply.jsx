import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CreditCard, ShieldCheck, ListChecks, CheckCircle2, AlertTriangle, Info,
  ArrowRight, Building2,
} from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, Button, Badge } from '../../components/ui/Primitives';
import { Input, Select } from '../../components/ui/Field';
import { PageLoader } from '../../components/ui/Misc';
import { useToast } from '../../components/ui/Toast';
import api, { errMessage } from '../../lib/api';

const STEPS = [
  { key: 'pay', label: 'Choose & pay', icon: CreditCard },
  { key: 'verify', label: 'Verify credentials', icon: ShieldCheck },
  { key: 'choose', label: 'Select course', icon: ListChecks },
];

/** Map the session status to the step the applicant is on. */
function stepFor(session) {
  if (!session) return 0;
  if (session.status === 'pending_payment') return 0;
  if (['paid', 'verifying', 'verification_failed'].includes(session.status)) return 1;
  return 2; // verified | completed
}

export default function Apply() {
  const toast = useToast();
  const nav = useNavigate();
  const [params] = useSearchParams();

  const [session, setSession] = useState(null);
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [q, cur] = await Promise.all([
        api.get('/sessions/quote'),
        api.get('/sessions/current'),
      ]);
      setQuote(q.data.data);
      setSession(cur.data.data);
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    if (params.get('paid') === '1') {
      toast.info('Confirming your payment…');
      setTimeout(load, 1500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <PageLoader />;

  const step = stepFor(session);

  return (
    <div>
      <PageHeader
        title="Apply"
        subtitle="Pay, verify your credentials, then choose from your JAMB choices."
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <div
              key={s.key}
              className={`flex flex-1 items-center gap-3 rounded-xl border px-4 py-3 ${
                active ? 'border-primary bg-primary-light' : done ? 'border-border bg-white' : 'border-border bg-white opacity-60'
              }`}
            >
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                done ? 'bg-success text-white' : active ? 'bg-primary text-white' : 'bg-primary-surface text-muted'
              }`}>
                {done ? <CheckCircle2 className="h-4.5 w-4.5" /> : <s.icon className="h-4 w-4" />}
              </div>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted">Step {i + 1}</div>
                <div className={`text-sm font-semibold ${active ? 'text-primary' : 'text-ink'}`}>{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {step === 0 && <PayStep session={session} quote={quote} onChanged={load} busy={busy} setBusy={setBusy} />}
      {step === 1 && <VerifyStep session={session} onVerified={load} />}
      {step === 2 && <ChoicesStep session={session} onApplied={() => nav('/app/applications')} />}
    </div>
  );
}

/* ------------------------------ Step 1: pay ------------------------------ */

function PayStep({ session, quote, onChanged, busy, setBusy }) {
  const toast = useToast();
  const [sittingType, setSittingType] = useState(session?.sittingType || 'one');
  const selected = quote?.[sittingType];

  async function startAndPay() {
    setBusy(true);
    try {
      let s = session;
      if (!s) {
        const { data } = await api.post('/sessions', { sittingType });
        s = data.data;
      } else if (s.sittingType !== sittingType) {
        const { data } = await api.patch(`/sessions/${s.id}/sitting-type`, { sittingType });
        s = data.data;
      }

      const { data: pay } = await api.post('/payments/session/initialize', { sessionId: s.id });
      const url = pay.data?.authorizationUrl;
      if (url) {
        window.location.href = url;
      } else {
        toast.error('Could not start payment');
        onChanged();
      }
    } catch (err) {
      toast.error(errMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr,1fr]">
      <Card className="p-6">
        <h2 className="font-display text-lg font-bold text-primary">O'Level sittings</h2>
        <p className="mt-1 text-sm text-muted">
          Choose how many O'Level results you want verified. A second sitting costs more because an extra
          result must be checked.
        </p>

        <div className="mt-5 space-y-3">
          {['one', 'two'].map((type) => {
            const q = quote?.[type];
            const active = sittingType === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => setSittingType(type)}
                className={`flex w-full items-center justify-between rounded-xl border p-4 text-left transition ${
                  active ? 'border-primary bg-primary-light' : 'border-border bg-white hover:border-primary/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                    active ? 'border-primary' : 'border-border'
                  }`}>
                    {active && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                  </span>
                  <div>
                    <div className="font-semibold text-ink">
                      {type === 'one' ? "O'Level — one sitting" : "O'Level — two sittings"}
                    </div>
                    <div className="text-xs text-muted">
                      {type === 'one'
                        ? 'One result (WAEC, NECO or NABTEB)'
                        : 'Two results combined — best grade per subject is used'}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-ink">₦{(q?.totalNaira || 0).toLocaleString()}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex gap-2.5 rounded-xl border border-border bg-primary-surface p-3.5">
          <Info className="mt-0.5 h-4.5 w-4.5 shrink-0 text-primary" />
          <p className="text-sm text-muted">
            Please make sure your details are correct before paying. Verification is charged per result, and
            corrections may incur additional charges.
          </p>
        </div>
      </Card>

      <Card className="h-fit p-6">
        <h2 className="font-display text-lg font-bold text-primary">Payment summary</h2>
        <p className="mt-1 text-sm text-muted">Review charges before making payment.</p>

        <dl className="mt-5 space-y-3 text-sm">
          <Row label="Exam processing fee" value={`₦${(selected?.examProcessingNaira || 0).toLocaleString()}`} />
          {sittingType === 'two' && (
            <Row label="Second sitting fee" value={`₦${(selected?.secondSittingNaira || 0).toLocaleString()}`} />
          )}
          <div className="border-t border-border pt-3">
            <Row label="Sitting type" value={sittingType === 'two' ? 'Two sittings' : 'One sitting'} muted />
          </div>
          <div className="flex items-center justify-between border-t border-border pt-3">
            <dt className="font-semibold text-ink">Total amount</dt>
            <dd className="font-display text-xl font-bold text-primary">
              ₦{(selected?.totalNaira || 0).toLocaleString()}
            </dd>
          </div>
        </dl>

        {sittingType === 'two' && (
          <p className="mt-4 rounded-xl bg-primary-surface p-3 text-xs leading-relaxed text-muted">
            You selected two O'Level sittings. The second-sitting processing charge has been included in your invoice.
          </p>
        )}

        <Button className="mt-5 w-full" onClick={startAndPay} loading={busy}>
          Proceed to payment <ArrowRight className="h-4 w-4" />
        </Button>
      </Card>
    </div>
  );
}

function Row({ label, value, muted }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted">{label}</dt>
      <dd className={muted ? 'text-ink' : 'font-semibold text-ink'}>{value}</dd>
    </div>
  );
}

/* ---------------------------- Step 2: verify ----------------------------- */

function VerifyStep({ session, onVerified }) {
  const toast = useToast();
  const expected = session?.sittings || 1;
  const [jambRegNo, setJambRegNo] = useState('');
  const [rows, setRows] = useState(
    Array.from({ length: expected }, () => ({ examType: 'waec', regNo: '' }))
  );
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(session?.verification?.error || null);

  function setRow(i, key, value) {
    setRows((r) => r.map((x, idx) => (idx === i ? { ...x, [key]: value } : x)));
  }

  async function submit() {
    if (!jambRegNo.trim()) return toast.error('Enter your JAMB registration number');
    if (rows.some((r) => !r.regNo.trim())) return toast.error('Enter every O’Level registration number');

    setBusy(true);
    setFailure(null);
    try {
      await api.post(`/sessions/${session.id}/verify`, {
        jambRegNo: jambRegNo.trim(),
        olevel: rows.map((r) => ({ examType: r.examType, regNo: r.regNo.trim() })),
      });
      toast.success('Credentials verified');
      onVerified();
    } catch (err) {
      const msg = errMessage(err);
      setFailure(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="max-w-2xl p-6">
      <div className="flex items-center gap-2">
        <Badge className="bg-green-50 text-success"><CheckCircle2 className="h-3.5 w-3.5" /> Payment received</Badge>
        <span className="text-sm text-muted">₦{(session?.fees?.totalNaira || 0).toLocaleString()}</span>
      </div>

      <h2 className="mt-4 font-display text-lg font-bold text-primary">Verify your credentials</h2>
      <p className="mt-1 text-sm text-muted">
        Enter the registration numbers exactly as they appear on your JAMB and O'Level records. We check them
        against the source records — your JAMB choices will then load automatically.
      </p>

      {failure && (
        <div className="mt-4 flex gap-3 rounded-xl border border-danger/30 bg-red-50 p-3.5">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
          <div className="text-sm">
            <p className="font-semibold text-danger">Verification failed</p>
            <p className="mt-0.5 text-ink">{failure}</p>
            <p className="mt-1 text-muted">Check the details and try again — you will not be charged twice.</p>
          </div>
        </div>
      )}

      <div className="mt-5 space-y-4">
        <Input
          label="JAMB registration number" required
          value={jambRegNo}
          onChange={(e) => setJambRegNo(e.target.value)}
          placeholder="e.g. 202412345678AB"
        />

        <div>
          <p className="label">
            O'Level result{expected > 1 ? 's' : ''} <span className="text-muted">({expected} paid for)</span>
          </p>
          <div className="space-y-3">
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[130px,1fr] gap-3">
                <Select value={r.examType} onChange={(e) => setRow(i, 'examType', e.target.value)}>
                  <option value="waec">WAEC</option>
                  <option value="neco">NECO</option>
                  <option value="nabteb">NABTEB</option>
                </Select>
                <Input
                  value={r.regNo}
                  onChange={(e) => setRow(i, 'regNo', e.target.value)}
                  placeholder={`Sitting ${i + 1} registration number`}
                />
              </div>
            ))}
          </div>
          {expected > 1 && (
            <p className="mt-2 text-xs text-muted">
              Both sittings are combined — the best grade for each subject is used.
            </p>
          )}
        </div>

        <Button className="w-full" onClick={submit} loading={busy}>
          Verify and continue <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

/* ---------------------------- Step 3: choices ---------------------------- */

function ChoicesStep({ session, onApplied }) {
  const toast = useToast();
  const [choices, setChoices] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applyingId, setApplyingId] = useState(null);

  async function load() {
    try {
      const { data } = await api.get(`/sessions/${session.id}/choices`);
      setChoices(data.data || []);
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function apply(choice) {
    setApplyingId(choice.institutionId + choice.choicePosition);
    try {
      await api.post(`/sessions/${session.id}/apply`, {
        institutionId: choice.institutionId,
        departmentId: choice.departmentId,
        choicePosition: choice.choicePosition,
      });
      toast.success('Application submitted');
      onApplied();
    } catch (err) {
      const details = err?.response?.data?.error?.details;
      if (Array.isArray(details) && details.length) toast.error(details[0]);
      else toast.error(errMessage(err));
    } finally {
      setApplyingId(null);
    }
  }

  if (loading) return <PageLoader label="Loading your JAMB choices…" />;

  const LABELS = {
    national_merit: 'National Merit',
    catchment: 'Catchment Area',
    elds: 'Educationally Less Developed State',
  };

  return (
    <div>
      <div className="mb-5 flex gap-3 rounded-xl border border-border bg-white p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" />
        <div className="text-sm">
          <p className="font-semibold text-ink">Credentials verified</p>
          <p className="text-muted">
            JAMB score <strong className="text-ink">{session?.verification?.jambScore ?? '—'}</strong>. These are the
            choices you made when registering for JAMB.
          </p>
        </div>
      </div>

      {(!choices || choices.length === 0) && (
        <Card className="p-8 text-center">
          <p className="text-muted">No JAMB choices were returned for your registration number.</p>
        </Card>
      )}

      <div className="space-y-4">
        {(choices || []).map((c) => {
          const key = c.institutionId + c.choicePosition;
          return (
            <Card key={key} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-ink">{c.institutionName}</h3>
                      <Badge className="bg-primary-surface text-muted">
                        {['1st', '2nd', '3rd', '4th'][c.choicePosition - 1] || `#${c.choicePosition}`} choice
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-muted">{c.courseName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {c.eligible ? (
                    <Badge className="bg-green-50 text-success"><CheckCircle2 className="h-3.5 w-3.5" /> Eligible</Badge>
                  ) : (
                    <Badge className="bg-red-50 text-danger"><AlertTriangle className="h-3.5 w-3.5" /> Not eligible</Badge>
                  )}
                  <Button
                    size="sm"
                    disabled={!c.eligible || !c.departmentId}
                    loading={applyingId === key}
                    onClick={() => apply(c)}
                  >
                    Apply <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {!c.eligible && c.reasons?.length > 0 && (
                <ul className="mt-4 space-y-1.5 border-t border-border pt-4">
                  {c.reasons.map((r, i) => (
                    <li key={i} className="flex gap-2 text-sm text-muted">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-danger" />
                      {r}
                    </li>
                  ))}
                </ul>
              )}

              {c.eligible && c.admissionCategory && (
                <p className="mt-3 border-t border-border pt-3 text-xs text-muted">
                  Admission category: <strong className="text-ink">{LABELS[c.admissionCategory]}</strong>
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
