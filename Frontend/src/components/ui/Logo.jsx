import { Link } from 'react-router-dom';

// Uses the real TruEntry mark. `light` renders the wordmark in white for dark surfaces.
export function Mark({ className = 'h-9 w-9' }) {
  return (
    <img
      src="/brand/truentry-mark.png"
      alt="TruEntry"
      className={`${className} object-contain drop-shadow-sm`}
      draggable="false"
    />
  );
}

export default function Logo({ to = '/', light = false, className = '' }) {
  return (
    <Link to={to} className={`inline-flex items-center gap-2.5 ${className}`}>
      <Mark className="h-9 w-9" />
      <span className={`font-display text-[1.35rem] font-extrabold tracking-tight ${light ? 'text-white' : 'text-primary-dark'}`}>
        Tru<span className={light ? 'text-primary-200' : 'text-primary'}>Entry</span>
      </span>
    </Link>
  );
}
