interface RaceDayFlagProps {
  className?: string;
}

/**
 * Strakke geruite race-vlag in dezelfde line-stijl als de sport-iconen
 * (SportIcon): witte stroke + subtiele glow. Vervangt het 🎉-emoji op de
 * racedag ("vandaag!") in de wedstrijd-hero.
 */
export default function RaceDayFlag({ className = 'w-9 h-9' }: RaceDayFlagProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ filter: 'drop-shadow(0 0 5px rgba(255,255,255,0.45))' }}
    >
      {/* mast */}
      <path d="M5 21V3" />
      {/* vlag-omtrek */}
      <rect x="5" y="4" width="13" height="8" rx="0.5" />
      {/* geruit patroon (schaakbord) */}
      <rect x="5" y="4" width="4.33" height="4" fill="currentColor" stroke="none" />
      <rect x="13.67" y="4" width="4.33" height="4" fill="currentColor" stroke="none" />
      <rect x="9.33" y="8" width="4.34" height="4" fill="currentColor" stroke="none" />
    </svg>
  );
}
