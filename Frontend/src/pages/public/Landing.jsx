import { Button } from '../../components/ui/Primitives';
import { Mark } from '../../components/ui/Logo';

const STEPS = [
  { n: '01', t: 'Create your profile', d: 'Sign up and set up your applicant profile in minutes.' },
  { n: '02', t: 'Verify NIN, JAMB & O-Level', d: 'We confirm your identity and results against the source records.' },
  { n: '03', t: 'Apply & pay', d: 'Pick an institution and department, accept the policy, pay the fee.' },
  { n: '04', t: 'Track to admission', d: 'Follow every stage through to your JAMB admission — no guesswork.' },
];

const PIPE = ['Applied', 'Reviewed', 'Post-UTME', 'Recommended', 'Approved', 'Admitted'];

const AUDIENCES = [
  {
    title: 'For applicants',
    body: 'One place to verify your records, apply, pay, and see exactly where your admission stands.',
    icon: ['M12 12a4 4 0 100-8 4 4 0 000 8Z', 'M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6'],
  },
  {
    title: 'For institutions',
    body: 'Quota-aware decisioning, Post-UTME handling, and registrar approval — with a clean audit trail.',
    icon: ['M4 21V5l8-3 8 3v16', 'M9 9h.01M9 13h.01M15 9h.01M15 13h.01'],
  },
  {
    title: 'For JAMB',
    body: 'Audit every applicant across institutions and issue final admissions from audit-ready reports.',
    icon: ['M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z', 'm9 12 2 2 4-4'],
  },
];

export default function Landing() {
  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary-light/60 to-primary-surface" />
        <div className="container-tru grid items-center gap-12 py-16 lg:grid-cols-2 lg:py-24">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1 text-xs font-semibold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              JAMB · WAEC/NECO/NABTEB · NIN verified
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight text-primary-dark sm:text-5xl">
              Admissions you can trust.
            </h1>
            <p className="mt-4 max-w-lg text-lg text-muted">
              TruEntry digitises, secures and automates tertiary admissions in Nigeria — from application all
              the way to JAMB admission.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button to="/register" size="lg">
                Apply now
              </Button>
              <Button to="/institutions" size="lg" variant="secondary">
                Explore institutions
              </Button>
            </div>
          </div>

          {/* Signature: the verified-admission pipeline */}
          <div className="animate-scale-in">
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mark className="h-6 w-6" />
                  <span className="text-sm font-semibold text-ink">Application status</span>
                </div>
                <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-success">
                  Admitted
                </span>
              </div>
              <div className="mt-6 space-y-4">
                {PIPE.map((label, i) => {
                  const done = i < PIPE.length;
                  return (
                    <div key={label} className="flex items-center gap-3">
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                          done ? 'bg-primary text-white' : 'bg-primary-surface text-muted'
                        }`}
                      >
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-ink">{label}</div>
                        <div className="h-1 rounded-full bg-primary-light">
                          <div className="h-1 rounded-full bg-primary" style={{ width: `${100 - i * 4}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="container-tru py-16">
        <h2 className="text-2xl font-bold text-primary-dark">How it works</h2>
        <p className="mt-1 text-muted">Four steps from sign-up to admission.</p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="card p-5">
              <div className="text-sm font-bold text-primary">{s.n}</div>
              <h3 className="mt-2 font-semibold text-ink">{s.t}</h3>
              <p className="mt-1 text-sm text-muted">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Audiences */}
      <section className="bg-white py-16">
        <div className="container-tru grid gap-6 lg:grid-cols-3">
          {AUDIENCES.map((a) => (
            <div key={a.title} className="rounded-2xl border border-border p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-light text-primary">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                  {a.icon.map((p, i) => (
                    <path key={i} d={p} strokeLinecap="round" strokeLinejoin="round" />
                  ))}
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-ink">{a.title}</h3>
              <p className="mt-1.5 text-sm text-muted">{a.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container-tru py-16">
        <div className="overflow-hidden rounded-2xl bg-primary-dark px-8 py-12 text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">Ready to begin?</h2>
          <p className="mx-auto mt-2 max-w-lg text-primary-light">
            Create your account and start a verified, transparent admission today.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button to="/register" size="lg">
              Get started
            </Button>
            <Button to="/institutions" size="lg" variant="secondary" className="!bg-white/10 !text-white !border-white/20 hover:!bg-white/20">
              Browse institutions
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
