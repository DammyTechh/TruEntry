import { Link } from 'react-router-dom';

/**
 * The TruEntry mark. On dark/indigo surfaces the standard blue shield
 * disappears into the background, so a solid-white variant is used instead.
 */
export function Mark({ className = 'h-9 w-9', light = false }) {
  return (
    <img
      src={light ? '/brand/truentry-mark-light.png' : '/brand/truentry-mark.png'}
      alt="TruEntry"
      className={`${className} object-contain`}
      draggable="false"
    />
  );
}

export default function Logo({ to = '/', light = false, className = '' }) {
  return (
    <Link to={to} className={`inline-flex items-center gap-2.5 ${className}`}>
      <Mark className="h-9 w-9" light={light} />
      <span className={`font-display text-[1.35rem] font-extrabold tracking-tight ${light ? 'text-white' : 'text-primary-dark'}`}>
        Tru<span className={light ? 'text-primary-200' : 'text-primary'}>Entry</span>
      </span>
    </Link>
  );
}
