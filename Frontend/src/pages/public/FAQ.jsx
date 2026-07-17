import { useState } from 'react';

const FAQS = [
  ['Who can use TruEntry?', 'Prospective students applying to Nigerian tertiary institutions, the institutions themselves, and the JAMB regulator.'],
  ['What do I need to apply?', 'A verified NIN, your JAMB registration number, and your O-Level (WAEC/NECO/NABTEB) results. You upload a passport photograph and complete your biodata.'],
  ['How much is the application fee?', 'The fee is set per institution and shown before you pay. Payment is handled securely via Paystack.'],
  ['How do I know my status?', 'Every application has a live status you can track from your dashboard, from submission through to JAMB admission.'],
  ['Is my data secure?', 'Yes. Access is role-based, sensitive records are verified against source systems, and every action is logged.'],
];

export default function FAQ() {
  const [open, setOpen] = useState(0);
  return (
    <div className="container-tru py-14">
      <h1 className="text-3xl font-bold text-primary-dark">Frequently asked questions</h1>
      <div className="mt-8 max-w-2xl space-y-3">
        {FAQS.map(([q, a], i) => (
          <div key={q} className="card overflow-hidden">
            <button
              onClick={() => setOpen(open === i ? -1 : i)}
              className="flex w-full items-center justify-between px-5 py-4 text-left"
            >
              <span className="font-medium text-ink">{q}</span>
              <svg
                className={`h-5 w-5 text-muted transition ${open === i ? 'rotate-180' : ''}`}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              >
                <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {open === i && <p className="px-5 pb-5 text-sm text-muted">{a}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
