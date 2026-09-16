import BrandBackdrop from '../../components/ui/BrandBackdrop';
const STEPS = [
  ['Create your profile', 'Sign up, complete your biodata and upload your documents for record.'],
  ['Start your application', "Choose whether you're submitting one or two O'Level sittings — two covers an extra result."],
  ['Pay the processing fee', 'Verification is charged per result, so payment comes before your credentials are checked.'],
  ['We verify your credentials', 'Your JAMB and O\u2019Level records are confirmed against the source systems.'],
  ['Choose from your JAMB choices', 'The institutions and courses you picked at JAMB registration load automatically — pick one you qualify for.'],
  ['Track to admission', 'Follow every stage through to your JAMB admission, with email updates at each step.'],
]

export default function HowItWorks() {
  return (
    <div className="relative overflow-hidden">
      <BrandBackdrop tone="light" />
      <div className="container-tru relative py-14">
      <h1 className="text-3xl font-bold text-primary-dark">How TruEntry works</h1>
      <p className="mt-2 max-w-2xl text-muted">
        A single, transparent pipeline from application to admission — every stage verified and auditable.
      </p>
      <ol className="mt-10 space-y-4">
        {STEPS.map(([t, d], i) => (
          <li key={t} className="card flex gap-4 p-5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
              {i + 1}
            </div>
            <div>
              <h3 className="font-semibold text-ink">{t}</h3>
              <p className="mt-0.5 text-sm text-muted">{d}</p>
            </div>
          </li>
        ))}
      </ol>
      </div>
    </div>
  );
}
