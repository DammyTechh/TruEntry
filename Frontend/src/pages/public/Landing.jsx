import {
  ShieldCheck, BadgeCheck, CreditCard, GraduationCap, ArrowRight, CheckCircle2,
  UserCheck, Building2, Gavel, FileCheck2, Lock, TrendingUp, Clock,
} from 'lucide-react';
import { Button } from '../../components/ui/Primitives';
import BrandBackdrop from '../../components/ui/BrandBackdrop';

const STATS = [
  { value: '50k+', label: 'Applications processed' },
  { value: '120+', label: 'Institutions' },
  { value: '99.9%', label: 'Uptime' },
  { value: '4', label: 'Verified data sources' },
];

const STEPS = [
  { icon: UserCheck, n: '01', t: 'Create your profile', d: 'Sign up and complete your applicant record in minutes.' },
  { icon: BadgeCheck, n: '02', t: 'Verify NIN, JAMB & O-Level', d: 'Credentials confirmed against the source records.' },
  { icon: CreditCard, n: '03', t: 'Apply & pay securely', d: 'Pick an institution and department, pay via Paystack.' },
  { icon: GraduationCap, n: '04', t: 'Track to admission', d: 'Follow every stage through to JAMB admission.' },
];

const FEATURES = [
  { icon: ShieldCheck, t: 'Verified at the source', d: 'NIN, JAMB and WAEC/NECO/NABTEB records checked against the issuing systems — not self-reported.' },
  { icon: TrendingUp, t: 'Quota-aware decisioning', d: 'Rank candidates on JAMB, Post-UTME and aggregate scores, then select against quota automatically.' },
  { icon: Lock, t: 'Secure & auditable', d: 'Role-based access and a complete audit trail on every action, from application to admission.' },
  { icon: Clock, t: 'Real-time status', d: 'Applicants see exactly where they stand at every stage — no waiting in the dark.' },
];

const AUDIENCES = [
  { icon: UserCheck, title: 'For applicants', body: 'One place to verify records, apply, pay, and track your admission end to end.', points: ['Verified identity & results', 'Secure fee payment', 'Live application status'] },
  { icon: Building2, title: 'For institutions', body: 'Quota configuration, decisioning and registrar approval with a clean audit trail.', points: ['Quota-aware selection', 'Departmental parameters', 'Audit-ready reports'] },
  { icon: Gavel, title: 'For JAMB', body: 'Audit every applicant across institutions and issue final admissions from one console.', points: ['Cross-institution audit', 'Final admission control', 'Regulatory reporting'] },
];

export default function Landing() {
  return (
    <div>
      {/* ============ HERO ============ */}
      <section className="relative overflow-hidden border-b border-border bg-white">
        <BrandBackdrop tone="light" />
        <div className="relative container-tru grid items-center gap-16 py-16 lg:grid-cols-[1.05fr,0.95fr] lg:py-24">
          <div className="animate-fade-up">
            <span className="chip border border-border bg-primary-surface text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> Admissions Quality Assurance
            </span>
            <h1 className="mt-6 font-display text-[2.6rem] font-extrabold leading-[1.05] tracking-tight text-ink sm:text-6xl">
              Admissions you<br className="hidden sm:block" /> can trust.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted">
              TruEntry digitises, secures and automates tertiary admissions in Nigeria — from application through to JAMB admission.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button to="/register" size="lg">Apply now <ArrowRight className="h-5 w-5" /></Button>
              <Button to="/institutions" size="lg" variant="secondary">Explore institutions</Button>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-border pt-6 text-sm text-muted">
              {['NIN verified', 'JAMB integrated', 'WAEC / NECO / NABTEB'].map((t) => (
                <span key={t} className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> {t}</span>
              ))}
            </div>
          </div>

          {/* Calm, static status panel — no floating overlays */}
          <div className="animate-fade-up lg:pl-6">
            <div className="overflow-hidden rounded-3xl border border-border bg-white shadow-lift">
              <div className="flex items-center justify-between border-b border-border bg-primary-surface px-6 py-4">
                <div>
                  <div className="text-sm font-semibold text-ink">Application status</div>
                  <div className="text-xs text-muted">University of Lagos · Computer Science</div>
                </div>
                <span className="chip bg-green-50 text-success">Admitted</span>
              </div>
              <div className="space-y-4 px-6 py-6">
                {[['Applied', 100], ['Reviewed', 100], ['Post-UTME', 100], ['Recommended', 100], ['Approved', 100], ['Admitted', 100]].map(([label, pct]) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="mb-1.5 text-xs font-medium text-ink">{label}</div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-primary-100">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-px border-t border-border bg-border">
                <div className="bg-white px-6 py-4">
                  <div className="text-xs text-muted">JAMB verified</div>
                  <div className="mt-0.5 font-semibold text-ink">Score 298</div>
                </div>
                <div className="bg-white px-6 py-4">
                  <div className="text-xs text-muted">Payment</div>
                  <div className="mt-0.5 font-semibold text-ink">₦2,500 · Paid</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ STATS ============ */}
      <section className="border-b border-border bg-white">
        <div className="container-tru grid grid-cols-2 gap-8 py-10 sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label}>
              <div className="font-display text-3xl font-extrabold text-ink sm:text-4xl">{s.value}</div>
              <div className="mt-1 text-sm text-muted">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section className="container-tru py-20">
        <div className="max-w-2xl">
          <span className="chip bg-primary-light text-primary">Why TruEntry</span>
          <h2 className="mt-4 font-display text-3xl font-bold text-ink sm:text-[2.5rem]">Built for trust at every step</h2>
          <p className="mt-3 text-muted">Every record verified, every decision auditable, every applicant informed.</p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.t} className="card card-hover p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-light text-primary">
                <f.icon className="h-5.5 w-5.5" strokeWidth={2} />
              </div>
              <h3 className="mt-5 font-semibold text-ink">{f.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section className="border-y border-border bg-white py-20">
        <div className="container-tru">
          <div className="max-w-2xl">
            <span className="chip bg-primary-light text-primary">How it works</span>
            <h2 className="mt-4 font-display text-3xl font-bold text-ink sm:text-[2.5rem]">From sign-up to admission</h2>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="border-l-2 border-primary/20 pl-5">
                <div className="flex items-center gap-3">
                  <span className="font-display text-sm font-bold text-primary">{s.n}</span>
                  <s.icon className="h-5 w-5 text-primary" strokeWidth={2} />
                </div>
                <h3 className="mt-3 font-semibold text-ink">{s.t}</h3>
                <p className="mt-1.5 text-sm text-muted">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ AUDIENCES ============ */}
      <section className="container-tru py-20">
        <div className="max-w-2xl">
          <span className="chip bg-primary-light text-primary">One platform, every role</span>
          <h2 className="mt-4 font-display text-3xl font-bold text-ink sm:text-[2.5rem]">Made for everyone in admissions</h2>
        </div>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {AUDIENCES.map((a) => (
            <div key={a.title} className="card flex flex-col p-7">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white">
                <a.icon className="h-5.5 w-5.5" strokeWidth={2} />
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
      <section className="container-tru pb-20">
        <div className="relative overflow-hidden rounded-3xl px-8 py-16 text-center sm:px-16">
          <BrandBackdrop tone="deep" />
          <div className="relative">
          <FileCheck2 className="mx-auto h-11 w-11 text-white/90" strokeWidth={1.6} />
          <h2 className="mt-5 font-display text-3xl font-bold text-white sm:text-4xl">Ready to begin your admission?</h2>
          <p className="mx-auto mt-3 max-w-lg text-primary-100">Create your account and start a verified, transparent admission today.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button to="/register" size="lg" className="!bg-white !text-primary hover:!bg-primary-50">Get started</Button>
            <Button to="/institutions" size="lg" className="!bg-white/10 !text-white hover:!bg-white/20">Browse institutions</Button>
          </div>
          </div>
        </div>
      </section>
    </div>
  );
}
