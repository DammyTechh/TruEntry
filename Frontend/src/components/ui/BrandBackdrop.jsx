/**
 * TruEntry signature backdrop.
 *
 * Luminous, thin light-arcs that sweep and cross one another, each with a
 * bloom halo — the look of light bending through glass rather than painted
 * shapes. Built from stroked bezier curves drawn twice: a wide, heavily
 * blurred pass for the glow and a fine bright pass for the filament core.
 *
 *   tone="deep"  — indigo panel, white-blue filaments (auth panel, CTA, footer)
 *   tone="light" — near-white surface, faint indigo filaments (page bodies)
 *
 * Purely decorative: aria-hidden and pointer-events-none.
 */
export default function BrandBackdrop({ tone = 'deep', className = '' }) {
  const deep = tone === 'deep';
  const id = deep ? 'd' : 'l';

  // Filament colours: a cool white core over a blue halo on dark panels.
  const core = deep ? '#F2ECFF' : '#5121E0';
  const halo = deep ? '#A98BFF' : '#7644F0';

  const coreOpacity = deep ? 1 : 0.16;
  const haloOpacity = deep ? 0.8 : 0.11;
  const wideOpacity = deep ? 0.38 : 0.05;

  // Arcs are placed to sweep the lower-left and upper-right, leaving the
  // middle band — where headlines and forms sit — comparatively clear.
  const ARCS = [
    // Long sweeps crossing the lower half
    'M-160 420 C 180 560, 420 720, 460 1060',
    'M-160 500 C 220 620, 470 780, 520 1080',
    'M-140 660 C 300 600, 700 690, 1080 590 C 1250 545, 1340 470, 1400 410',
    'M-140 740 C 320 690, 720 790, 1100 680 C 1260 634, 1350 560, 1400 500',
    // Counter-sweeps from the top right, forming the lens crossings
    'M1360 120 C 1080 280, 900 500, 940 820',
    'M1300 80 C 1010 260, 820 500, 860 860',
    // Broad low band
    'M-120 880 C 320 760, 760 820, 1120 730 C 1270 692, 1350 630, 1420 580',
    // A single bright filament arcing through the middle-lower third
    'M-80 980 C 260 800, 520 640, 880 640 C 1120 640, 1300 700, 1420 760',
  ];

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      {deep && <div className="absolute inset-0 bg-brand-gradient" />}

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1200 1000"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
      >
        <defs>
          {/* Bloom passes: wide diffuse, then tighter, then the bright core. */}
          <filter id={`bloomWide-${id}`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="30" />
          </filter>
          <filter id={`bloom-${id}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="9" />
          </filter>
          <filter id={`bloomTight-${id}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.2" />
          </filter>

          {/* Filaments brighten mid-sweep and fade at both ends. */}
          <linearGradient id={`fade-${id}`} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor={core} stopOpacity="0" />
            <stop offset="38%" stopColor={core} stopOpacity="1" />
            <stop offset="72%" stopColor={core} stopOpacity="0.55" />
            <stop offset="100%" stopColor={core} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`fadeHalo-${id}`} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor={halo} stopOpacity="0" />
            <stop offset="45%" stopColor={halo} stopOpacity="1" />
            <stop offset="100%" stopColor={halo} stopOpacity="0" />
          </linearGradient>

          {/* Pooled light where the arcs converge. */}
          <radialGradient id={`pool-${id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={halo} stopOpacity={deep ? 0.30 : 0.07} />
            <stop offset="100%" stopColor={halo} stopOpacity="0" />
          </radialGradient>
        </defs>

        <ellipse cx="240" cy="700" rx="420" ry="300" fill={`url(#pool-${id})`} />
        <ellipse cx="1020" cy="520" rx="360" ry="300" fill={`url(#pool-${id})`} />

        {/* 1. Wide diffuse halo */}
        <g filter={`url(#bloomWide-${id})`} opacity={wideOpacity} stroke={`url(#fadeHalo-${id})`} fill="none" strokeLinecap="round">
          {ARCS.map((d, i) => (
            <path key={`w${i}`} d={d} strokeWidth={i % 2 ? 26 : 18} />
          ))}
        </g>

        {/* 2. Mid glow */}
        <g filter={`url(#bloom-${id})`} opacity={haloOpacity} stroke={`url(#fadeHalo-${id})`} fill="none" strokeLinecap="round">
          {ARCS.map((d, i) => (
            <path key={`m${i}`} d={d} strokeWidth={i % 2 ? 7 : 5} />
          ))}
        </g>

        {/* 3. Bright filament core */}
        <g filter={`url(#bloomTight-${id})`} opacity={coreOpacity} stroke={`url(#fade-${id})`} fill="none" strokeLinecap="round">
          {ARCS.map((d, i) => (
            <path key={`c${i}`} d={d} strokeWidth={i % 3 === 0 ? 1.6 : 1} />
          ))}
        </g>
      </svg>
    </div>
  );
}
