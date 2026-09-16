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
  { icon: CreditCard, n: '02', t: 'Apply & pay', d: "Choose one or two O'Level sittings and pay the processing fee." },
  { icon: BadgeCheck, n: '03', t: 'Credentials verified', d: 'Your JAMB and O\u2019Level records are checked at the source.' },
  { icon: GraduationCap, n: '04', t: 'Pick your course', d: 'Your JAMB choices load automatically — apply and track to admission.' },
]

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
      <section className="relative overflow-hidden bg-[#F5F3FE]">
        <BrandBackdrop tone="light" />

        <div className="relative mx-auto grid w-full max-w-[1500px] items-center gap-10 px-4 pt-12 sm:px-6 lg:grid-cols-[minmax(0,44%)_minmax(0,56%)] lg:gap-6 lg:px-0 lg:pl-10 lg:pt-4 xl:pl-16">
          {/* ---- Copy ---- */}
          <div className="animate-fade-up lg:py-16">
            <span className="chip border border-border bg-white text-ink shadow-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> Admissions, made simpler
            </span>

            <h1 className="mt-6 font-display text-[2.75rem] font-extrabold leading-[1.04] tracking-[-0.03em] text-ink sm:text-6xl">
              Your next<br />chapter starts<br />
              <span className="text-primary">here.</span>
            </h1>

            <p className="mt-6 max-w-md text-[1.0625rem] leading-relaxed text-muted">
              TruEntry digitises, secures and automates tertiary admissions in Nigeria — from application
              through to JAMB admission.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button to="/register" size="lg">Apply now <ArrowRight className="h-5 w-5" /></Button>
              <Button to="/institutions" size="lg" variant="secondary">Explore institutions</Button>
            </div>

            <div className="mt-10 flex flex-wrap gap-3">
              {['NIN verified', 'JAMB integrated', 'WAEC / NECO / NABTEB'].map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm font-medium text-ink shadow-xs"
                >
                  <CheckCircle2 className="h-4.5 w-4.5 text-success" /> {t}
                </span>
              ))}
            </div>

            <p className="mt-10 text-[0.7rem] font-medium uppercase tracking-[0.28em] text-muted/45">
              Same dreams. A brighter tomorrow.
            </p>
          </div>

          {/* ---- Artwork: scaled so its edges leave the viewport instead of
               stopping on a visible line ---- */}
          <div className="relative overflow-hidden lg:-mr-10 lg:-mb-6 xl:-mr-16">
            <img
              src="/brand/hero.jpg"
              srcSet="/brand/hero-1200.jpg 1200w, /brand/hero.jpg 1672w"
              sizes="(max-width: 1024px) 100vw, 56vw"
              alt="Applicants tracking a verified TruEntry admission together"
              className="h-auto w-full origin-bottom-right object-contain lg:scale-[1.06]"
              width="1672"
              height="941"
              fetchPriority="high"
            />
            {/* Feather every inner edge into the section colour so the artwork
                dissolves into the page instead of ending on a seam. */}
            <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-[#F5F3FE] to-transparent sm:w-28" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#F5F3FE] to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#F5F3FE] via-[#F5F3FE]/60 to-transparent" />
          </div>
        </div>
      </section>

      {/* ============ STATS ============ */}
      <section className="border-b border-border bg-white">
        <div className="container-tru grid grid-cols-2 gap-8 py-12 sm:grid-cols-4">
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
