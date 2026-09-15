/**
 * TruEntry signature backdrop.
 *
 * Soft flowing light-ribbons over the brand indigo. Rendered as inline SVG
 * (no image asset, no JS animation loop) so it stays crisp at any size and
 * costs nothing at runtime. Two tones:
 *
 *   tone="deep"  — indigo panel, white ribbons  (auth panels, CTAs, headers)
 *   tone="light" — near-white surface, indigo ribbons (page backgrounds)
 *
 * It is purely decorative: aria-hidden and pointer-events-none.
 */
export default function BrandBackdrop({ tone = 'deep', className = '' }) {
  const deep = tone === 'deep';
  const stroke = deep ? '#FFFFFF' : '#3538CD';
  const id = deep ? 'deep' : 'light';

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      {deep && <div className="absolute inset-0 bg-brand-gradient" />}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <defs>
          {/* Ribbons fade along their length so they read as light, not lines. */}
          <linearGradient id={`rib-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={deep ? 0 : 0} />
            <stop offset="45%" stopColor={stroke} stopOpacity={deep ? 0.5 : 0.22} />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`rib2-${id}`} x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0" />
            <stop offset="55%" stopColor={stroke} stopOpacity={deep ? 0.32 : 0.14} />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
          {/* Glow pool that the ribbons appear to sweep around. */}
          <radialGradient id={`glow-${id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={stroke} stopOpacity={deep ? 0.30 : 0.10} />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx="880" cy="250" r="300" fill={`url(#glow-${id})`} />
        <circle cx="240" cy="640" r="260" fill={`url(#glow-${id})`} />

        {/* Long sweeping ribbons */}
        <g fill="none" strokeLinecap="round">
          <path d="M-100 620 C 180 470, 330 250, 700 190 C 980 145, 1130 250, 1320 200"
                stroke={`url(#rib-${id})`} strokeWidth="2.5" />
          <path d="M-100 690 C 200 540, 360 320, 730 262 C 1010 218, 1160 322, 1320 272"
                stroke={`url(#rib-${id})`} strokeWidth="1.4" />
          <path d="M-100 756 C 220 610, 400 392, 760 334 C 1040 290, 1190 394, 1320 344"
                stroke={`url(#rib2-${id})`} strokeWidth="1" />
          <path d="M-60 300 C 240 250, 470 470, 760 520 C 1010 562, 1180 470, 1320 500"
                stroke={`url(#rib2-${id})`} strokeWidth="1.6" />
          <path d="M-60 372 C 260 322, 500 540, 790 588 C 1030 628, 1200 540, 1320 570"
                stroke={`url(#rib2-${id})`} strokeWidth="0.9" />
        </g>

        {/* Broad soft sweep for depth */}
        <path
          d="M-100 800 C 260 600, 420 330, 820 250 C 1080 198, 1220 300, 1320 260 L1320 800 Z"
          fill={stroke}
          opacity={deep ? 0.05 : 0.025}
        />
      </svg>
    </div>
  );
}
