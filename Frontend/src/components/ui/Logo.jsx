import { Link } from 'react-router-dom';

export function Mark({ className = 'h-8 w-8' }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M16 2 4 7v9c0 7 5 12 12 14 7-2 12-7 12-14V7L16 2Z" fill="#0B4DE0" />
      <path
        d="m11 16 3.5 3.5L22 12"
        fill="none"
        stroke="#fff"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Logo({ to = '/', light = false }) {
  return (
    <Link to={to} className="inline-flex items-center gap-2">
      <Mark />
      <span className={`text-lg font-extrabold tracking-tight ${light ? 'text-white' : 'text-primary-dark'}`}>
        TruEntry
      </span>
    </Link>
  );
}
