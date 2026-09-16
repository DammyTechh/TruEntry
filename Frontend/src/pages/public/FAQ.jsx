import BrandBackdrop from '../../components/ui/BrandBackdrop';
import { useState } from 'react';

const FAQS = [
  ['Who can use TruEntry?', 'Prospective students applying to Nigerian tertiary institutions, the institutions themselves, and the JAMB regulator.'],
  ['What do I need to apply?', 'Your NIN, your JAMB registration number, and your O\u2019Level (WAEC/NECO/NABTEB) registration number(s). You complete your biodata and upload a passport photograph when you sign up.'],
  ['Why do I pay before my results are checked?', 'Verifying your JAMB and O\u2019Level records costs money per result, so the processing fee is collected first. You see the exact amount before paying.'],
  ['What is the difference between one and two sittings?', 'One sitting verifies a single O\u2019Level result. Two sittings verifies a second result as well and costs more \u2014 the best grade in each subject is then used.'],
  ['How do I choose where to apply?', 'After verification, the institutions and courses you selected when registering for JAMB load automatically. You apply to one you qualify for.'],
  ['What if I do not meet an institution\u2019s requirements?', 'You are told immediately, with the specific reason \u2014 for example a JAMB score below the cut-off or an O\u2019Level grade short of the minimum.'],
  ['How do I know my status?', 'Every application has a live status you can track from your dashboard, and updates are emailed to you automatically.'],
  ['Is my data secure?', 'Yes. Access is role-based, sensitive records are verified against source systems, and every action is logged.'],
]

export default function FAQ() {
  const [open, setOpen] = useState(0);
  return (
    <div className="relative overflow-hidden">
      <BrandBackdrop tone="light" />
      <div className="container-tru relative py-14">
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
    </div>
  );
}
