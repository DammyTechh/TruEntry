/**
 * TruEntry signature backdrop.
 *
 * Broad, soft light-bands sweeping low across the brand indigo — deliberately
 * weighted to the lower and outer thirds so the centre stays clear for
 * headlines and form content. Rendered as inline SVG with real Gaussian blur
 * (no image asset, no animation), so it stays crisp at any size.
 *
 *   tone="deep"  — indigo panel, soft white bands (auth panel, CTA, footer)
 *   tone="light" — near-white surface, barely-there indigo bands (page bodies)
 *
 * Purely decorative: aria-hidden and pointer-events-none.
 */
export default function BrandBackdrop({ tone = 'deep', className = '' }) {
  const deep = tone === 'deep';
  const stroke = deep ? '#FFFFFF' : '#3538CD';
  const id = deep ? 'd' : 'l';

  // The light tone sits under body content, so it is kept very faint.
  const band = deep ? 0.40 : 0.07;
  const bandSoft = deep ? 0.24 : 0.04;
  const glow = deep ? 0.26 : 0.05;

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      {deep && <div className="absolute inset-0 bg-brand-gradient" />}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1200 900"
        preserveAspectRatio="xMidYMax slice"
        fill="none"
      >
        <defs>
          {/* Real blur is what makes these read as light rather than lines. */}
          <filter id={`soft-${id}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="14" />
          </filter>
          <filter id={`softer-${id}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="34" />
          </filter>

          {/* Bands fade out before they reach the centre of the panel. */}
          <linearGradient id={`band-${id}`} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor={stroke} stopOpacity={band} />
            <stop offset="55%" stopColor={stroke} stopOpacity={band * 0.55} />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`band2-${id}`} x1="0" y1="1" x2="1" y2="0.2">
            <stop offset="0%" stopColor={stroke} stopOpacity={bandSoft} />
            <stop offset="70%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
          <radialGradient id={`pool-${id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={stroke} stopOpacity={glow} />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Soft pools of light, low and to the edges */}
        <ellipse cx="180" cy="800" rx="420" ry="300" fill={`url(#pool-${id})`} />
        <ellipse cx="1080" cy="880" rx="360" ry="240" fill={`url(#pool-${id})`} />

        {/* Broad sweeping bands across the lower half only */}
        <g filter={`url(#soft-${id})`}>
          <path
            d="M-200 760 C 120 620, 340 540, 700 560 C 980 576, 1120 660, 1400 640 L1400 760 C 1120 780, 980 700, 700 684 C 340 664, 120 744, -200 884 Z"
            fill={`url(#band-${id})`}
          />
          <path
            d="M-200 900 C 160 740, 420 636, 780 656 C 1040 670, 1200 740, 1400 724 L1400 820 C 1200 836, 1040 768, 780 754 C 420 734, 160 838, -200 1000 Z"
            fill={`url(#band2-${id})`}
          />
        </g>

        {/* One wider, very diffuse sweep for depth */}
        <g filter={`url(#softer-${id})`}>
          <path
            d="M-200 640 C 200 470, 520 420, 900 470 C 1120 498, 1280 560, 1400 540 L1400 660 C 1280 680, 1120 616, 900 590 C 520 540, 200 596, -200 780 Z"
            fill={stroke}
            opacity={deep ? 0.10 : 0.02}
          />
        </g>

        {/* Gentle floor wash */}
        <path
          d="M-200 900 L1400 900 L1400 700 C 1060 760, 640 800, -200 820 Z"
          fill={stroke}
          opacity={deep ? 0.07 : 0.015}
          filter={`url(#softer-${id})`}
        />
      </svg>
    </div>
  );
}
