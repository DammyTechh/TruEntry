const STEPS = [
  ['Create your profile', 'Sign up as an applicant and complete your biodata.'],
  ['Verify your records', 'Confirm your NIN, JAMB score and O-Level results against source records.'],
  ['Apply & pay', 'Choose an institution and department, accept the admission policy, and pay the application fee.'],
  ['Institution review', 'The admission officer reviews you, runs Post-UTME where required, and recommends you.'],
  ['Registrar approval', 'The institution head approves and forwards successful candidates to JAMB.'],
  ['JAMB admission', 'JAMB audits and issues the final admission. Download your admission letter.'],
];

export default function HowItWorks() {
  return (
    <div className="container-tru py-14">
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
  );
}
