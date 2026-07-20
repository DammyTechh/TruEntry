import { Link } from 'react-router-dom';
import {
  ShieldCheck, BadgeCheck, CreditCard, GraduationCap, ArrowRight, CheckCircle2,
  UserCheck, Building2, Gavel, FileCheck2, Lock, Sparkles, TrendingUp, Clock,
} from 'lucide-react';
import { Button } from '../../components/ui/Primitives';
import { Mark } from '../../components/ui/Logo';

const STATS = [
  { value: '50k+', label: 'Applications processed' },
  { value: '120+', label: 'Institutions' },
  { value: '99.9%', label: 'Uptime' },
  { value: '4', label: 'Verified data sources' },
];

const STEPS = [
  { icon: UserCheck, n: '01', t: 'Create your profile', d: 'Sign up and complete your applicant biodata in minutes.' },
  { icon: BadgeCheck, n: '02', t: 'Verify NIN, JAMB & O-Level', d: 'We confirm your identity and results against source records.' },
  { icon: CreditCard, n: '03', t: 'Apply & pay securely', d: 'Pick an institution and department, accept the policy, pay via Paystack.' },
  { icon: GraduationCap, n: '04', t: 'Track to admission', d: 'Follow every stage through to your JAMB admission — no guesswork.' },
];

const FEATURES = [
  { icon: ShieldCheck, t: 'Verified at the source', d: 'NIN, JAMB and WAEC/NECO/NABTEB records checked against the issuing systems — not self-reported.' },
  { icon: TrendingUp, t: 'Quota-aware decisioning', d: 'Rank candidates on JAMB, Post-UTME and aggregate scores, then select against department quota automatically.' },
  { icon: Lock, t: 'Secure & auditable', d: 'Role-based access and a complete audit trail on every action, from application to admission.' },
  { icon: Clock, t: 'Real-time status', d: 'Applicants see exactly where they stand at every stage — no more waiting in the dark.' },
];

const AUDIENCES = [
  { icon: UserCheck, title: 'For applicants', body: 'One place to verify records, apply, pay, and track your admission end to end.', points: ['Verified identity & results', 'Secure fee payment', 'Live application status'] },
  { icon: Building2, title: 'For institutions', body: 'Officer review, Post-UTME handling and registrar approval with a clean audit trail.', points: ['Quota-aware selection', 'Post-UTME workflow', 'Audit-ready reports'] },
  { icon: Gavel, title: 'For JAMB', body: 'Audit every applicant across institutions and issue final admissions from one console.', points: ['Cross-institution audit', 'Final admission control', 'Regulatory reporting'] },
];

export default function Landing() {
  return (
    <div className="overflow-hidden">
      {/* ============ HERO ============ */}
      <section className="relative">
        <div className="absolute inset-0 -z-10 bg-brand-soft" />
        <div className="absolute inset-0 -z-10 bg-mesh" />
        <div className="container-tru grid items-center gap-14 py-16 lg:grid-cols-2 lg:py-24">
          <div className="animate-fade-up">
            <span className="chip border border-primary/15 bg-white text-primary shadow-xs">
              <Sparkles className="h-3.5 w-3.5" /> Admissions Quality Assurance
            </span>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-primary-dark sm:text-5xl lg:text-6xl">
              Admissions <br className="hidden sm:block" />you can <span className="bg-brand-gradient bg-clip-text text-transparent">trust</span>.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted">
              TruEntry digitises, secures and automates tertiary admissions in Nigeria — from application all the way to JAMB admission.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button to="/register" variant="gradient" size="lg">Apply now <ArrowRight className="h-5 w-5" /></Button>
              <Button to="/institutions" size="lg" variant="secondary">Explore institutions</Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
              {['NIN verified', 'JAMB integrated', 'WAEC / NECO / NABTEB'].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" /> {t}</span>
              ))}
            </div>
          </div>

          {/* Floating status card cluster */}
          <div className="relative animate-scale-in lg:h-[440px]">
            <div className="relative mx-auto max-w-md">
              <div className="card animate-float-slow p-6 shadow-pop">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Mark className="h-8 w-8" />
                    <div>
                      <div className="text-sm font-semibold text-ink">Application status</div>
                      <div className="text-xs text-muted">UNILAG · Computer Science</div>
                    </div>
                  </div>
                  <span className="chip bg-green-50 text-success">Admitted</span>
                </div>
                <div className="mt-6 space-y-3.5">
                  {['Applied', 'Reviewed', 'Post-UTME', 'Recommended', 'Approved', 'Admitted'].map((label, i, arr) => (
                    <div key={label} className="flex items-center gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-xs font-medium text-ink">{label}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-primary-light">
                          <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${100 - (arr.length - 1 - i) * 6}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* floating chips */}
              <div className="absolute -left-6 top-10 hidden animate-float rounded-2xl border border-border bg-white p-3 shadow-float sm:block">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-50 text-success"><BadgeCheck className="h-5 w-5" /></div>
                  <div>
                    <div className="text-xs font-semibold text-ink">JAMB verified</div>
                    <div className="text-[11px] text-muted">Score 298</div>
                  </div>
                </div>
              </div>
              <div className="absolute -right-4 bottom-8 hidden animate-float rounded-2xl border border-border bg-white p-3 shadow-float [animation-delay:1.5s] sm:block">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-light text-primary"><Lock className="h-5 w-5" /></div>
                  <div>
                    <div className="text-xs font-semibold text-ink">Payment secured</div>
                    <div className="text-[11px] text-muted">₦2,500 · Paystack</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="container-tru relative pb-6">
          <div className="grid grid-cols-2 gap-4 rounded-3xl border border-border bg-white/70 p-6 backdrop-blur-xl sm:grid-cols-4 sm:p-8">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <div className="font-display text-3xl font-extrabold text-primary-dark sm:text-4xl">{s.value}</div>
                <div className="mt-1 text-xs font-medium text-muted sm:text-sm">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section className="container-tru py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="chip bg-primary-light text-primary">Why TruEntry</span>
          <h2 className="mt-4 font-display text-3xl font-bold text-primary-dark sm:text-4xl">Built for trust at every step</h2>
          <p className="mt-3 text-muted">Every record verified, every decision auditable, every applicant informed.</p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.t} className="card card-hover p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-float">
                <f.icon className="h-6 w-6" strokeWidth={1.9} />
              </div>
              <h3 className="mt-5 font-semibold text-ink">{f.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section className="relative bg-white py-20">
        <div className="container-tru">
          <div className="mx-auto max-w-2xl text-center">
            <span className="chip bg-primary-light text-primary">How it works</span>
            <h2 className="mt-4 font-display text-3xl font-bold text-primary-dark sm:text-4xl">From sign-up to admission</h2>
            <p className="mt-3 text-muted">Four clear steps — the whole journey in one transparent pipeline.</p>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={s.n} className="relative">
                {i < STEPS.length - 1 && (
                  <div className="absolute left-[3.25rem] top-7 hidden h-px w-[calc(100%-2rem)] bg-gradient-to-r from-primary/30 to-transparent lg:block" />
                )}
                <div className="card card-hover h-full p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-light text-primary">
                      <s.icon className="h-6 w-6" strokeWidth={1.9} />
                    </div>
                    <span className="font-display text-2xl font-extrabold text-primary/20">{s.n}</span>
                  </div>
                  <h3 className="mt-4 font-semibold text-ink">{s.t}</h3>
                  <p className="mt-1.5 text-sm text-muted">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ AUDIENCES ============ */}
      <section className="container-tru py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="chip bg-primary-light text-primary">One platform, three roles</span>
          <h2 className="mt-4 font-display text-3xl font-bold text-primary-dark sm:text-4xl">Made for everyone in admissions</h2>
        </div>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {AUDIENCES.map((a) => (
            <div key={a.title} className="card card-hover flex flex-col p-7">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-float">
                <a.icon className="h-6 w-6" strokeWidth={1.9} />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-ink">{a.title}</h3>
              <p className="mt-2 text-sm text-muted">{a.body}</p>
              <ul className="mt-5 space-y-2.5 border-t border-border pt-5">
                {a.points.map((p) => (
                  <li key={p} className="flex items-center gap-2.5 text-sm text-ink">
                    <CheckCircle2 className="h-4.5 w-4.5 text-success" /> {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="container-tru pb-8">
        <div className="relative overflow-hidden rounded-3xl bg-brand-gradient px-8 py-16 text-center shadow-pop sm:px-16">
          <div className="pointer-events-none absolute inset-0 bg-mesh opacity-50" />
          <div className="relative mx-auto max-w-2xl">
            <FileCheck2 className="mx-auto h-12 w-12 text-white/90" strokeWidth={1.5} />
            <h2 className="mt-5 font-display text-3xl font-bold text-white sm:text-4xl">Ready to begin your admission?</h2>
            <p className="mx-auto mt-3 max-w-lg text-primary-100">Create your account and start a verified, transparent admission today.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button to="/register" size="lg" className="!bg-white !text-primary hover:!bg-primary-50">Get started free</Button>
              <Button to="/institutions" size="lg" className="!bg-white/10 !text-white hover:!bg-white/20">Browse institutions</Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
