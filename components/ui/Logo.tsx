interface LogoProps {
  size?: number;
  className?: string;
}

export function Logo({ size = 32, className }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#0d1117" />
          <stop offset="100%" stopColor="#0f1a2e" />
        </linearGradient>
        <linearGradient id="accent" x1="10" y1="8" x2="30" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#ffffff" />
          <stop offset="55%"  stopColor="#7dd3fc" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
        <linearGradient id="blue" x1="10" y1="20" x2="30" y2="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%"   stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
        <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Dark background — rounded square */}
      <rect width="40" height="40" rx="10" fill="url(#bg)" />

      {/* Subtle grid lines */}
      <line x1="20" y1="6"  x2="20" y2="34" stroke="#ffffff" strokeWidth="0.3" opacity="0.06" />
      <line x1="6"  y1="20" x2="34" y2="20" stroke="#ffffff" strokeWidth="0.3" opacity="0.06" />

      {/* Outer precision ring */}
      <circle cx="20" cy="20" r="13" stroke="#38bdf8" strokeWidth="0.6" opacity="0.2" />

      {/* A — left leg */}
      <line
        x1="20" y1="9"
        x2="11" y2="29"
        stroke="url(#accent)"
        strokeWidth="2"
        strokeLinecap="round"
        filter="url(#glow)"
      />

      {/* A — right leg */}
      <line
        x1="20" y1="9"
        x2="29" y2="29"
        stroke="url(#accent)"
        strokeWidth="2"
        strokeLinecap="round"
        filter="url(#glow)"
      />

      {/* A — crossbar */}
      <line
        x1="14.5" y1="22.5"
        x2="25.5" y2="22.5"
        stroke="url(#blue)"
        strokeWidth="1.6"
        strokeLinecap="round"
        filter="url(#glow)"
      />

      {/* Apex glow dot */}
      <circle cx="20" cy="9" r="2.2" fill="#38bdf8" filter="url(#glow)" opacity="0.9" />
      <circle cx="20" cy="9" r="1.2" fill="#ffffff" />

      {/* Bottom tick marks — precision detail */}
      <line x1="11" y1="29" x2="11" y2="31.5" stroke="#38bdf8" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      <line x1="29" y1="29" x2="29" y2="31.5" stroke="#38bdf8" strokeWidth="1" strokeLinecap="round" opacity="0.5" />

      {/* Corner bracket accents */}
      <path d="M4 12 L4 6 L10 6"   stroke="#38bdf8" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.3" />
      <path d="M36 12 L36 6 L30 6" stroke="#38bdf8" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.3" />
      <path d="M4 28 L4 34 L10 34"   stroke="#38bdf8" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.3" />
      <path d="M36 28 L36 34 L30 34" stroke="#38bdf8" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.3" />
    </svg>
  );
}
