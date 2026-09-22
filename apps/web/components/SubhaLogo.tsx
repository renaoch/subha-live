export function SubhaLogo({ className = "" }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 400 180" 
      className={className} 
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* The golden/cream gradient for the text */}
        <linearGradient id="textGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFF8E7" />
          <stop offset="40%" stopColor="#FFE4A1" />
          <stop offset="100%" stopColor="#F5A623" />
        </linearGradient>

        {/* The golden gradient for the swoosh */}
        <linearGradient id="swooshGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#F5A623" stopOpacity="0" />
          <stop offset="50%" stopColor="#F5A623" stopOpacity="1" />
          <stop offset="100%" stopColor="#F5A623" stopOpacity="0" />
        </linearGradient>
        
        {/* Glow filter */}
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* The Golden Swoosh behind the text */}
      <path 
        d="M 10 130 C 60 160, 340 160, 390 100" 
        fill="none" 
        stroke="url(#swooshGradient)" 
        strokeWidth="6" 
        strokeLinecap="round"
      />
      
      {/* The Main Text Group */}
      <g 
        filter="url(#glow)"
        style={{
          fontFamily: '"Nunito", "Baloo 2", "Arial Rounded MT Bold", sans-serif',
          fontWeight: 900,
          fontSize: '110px',
          letterSpacing: '-4px',
        }}
      >
        {/* Layer 1: Thick White Outer Stroke */}
        <text 
          x="50%" y="125" 
          textAnchor="middle" 
          fill="#FFFFFF" 
          stroke="#FFFFFF" 
          strokeWidth="16" 
          paintOrder="stroke"
        >
          Subha
        </text>

        {/* Layer 2: Thick Dark Brown Inner Stroke (Creates the 3D cutout effect) */}
        <text 
          x="50%" y="125" 
          textAnchor="middle" 
          fill="none" 
          stroke="#4A2F1D" 
          strokeWidth="6" 
          paintOrder="stroke"
        >
          Subha
        </text>

        {/* Layer 3: The Gradient Fill */}
        <text 
          x="50%" y="125" 
          textAnchor="middle" 
          fill="url(#textGradient)" 
          stroke="none"
        >
          Subha
        </text>
      </g>

      {/* The Sparkle ✦ */}
      <path 
        d="M 360 80 Q 365 95 380 100 Q 365 105 360 120 Q 355 105 340 100 Q 355 95 360 80 Z" 
        fill="#FFC107" 
        filter="url(#glow)"
      />
    </svg>
  );
}