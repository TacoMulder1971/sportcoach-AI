'use client';

import { SwimVariant } from '@/lib/types';

// Neon-glow stijl identiek aan SportIcon. Drie zwem-locaties met eigen kleur + accent.
const COLORS: Record<SwimVariant, { stroke: string; glow: string }> = {
  zwembad_binnen: { stroke: '#3b82f6', glow: 'drop-shadow(0 0 6px #3b82f6) drop-shadow(0 0 14px rgba(59,130,246,0.4))' },
  zwembad_buiten: { stroke: '#0ea5e9', glow: 'drop-shadow(0 0 6px #0ea5e9) drop-shadow(0 0 14px rgba(14,165,233,0.4))' },
  openwater:      { stroke: '#0891b2', glow: 'drop-shadow(0 0 6px #0891b2) drop-shadow(0 0 14px rgba(8,145,178,0.4))' },
};

const SIZE_MAP = {
  sm: { box: 'w-7 h-7',   icon: 'w-4 h-4',   radius: 'rounded-md' },
  md: { box: 'w-10 h-10', icon: 'w-6 h-6',   radius: 'rounded-xl' },
  lg: { box: 'w-11 h-11', icon: 'w-[26px] h-[26px]', radius: 'rounded-xl' },
};

// Basis-zwemmer (kop + golf-romp + arm), gelijk aan SwimIcon in SportIcon.tsx.
// Stroke erft van de omhullende <svg>.
function SwimmerBody() {
  return (
    <>
      <circle cx="6" cy="7" r="2.5" />
      <path d="M3 17c1-2 3-4 5.5-4s3 1.5 5 1.5 3.5-1.5 5.5-1.5c1.5 0 2.5.5 3 1" />
      <path d="M8.5 12l3 2.5-1.5 3" />
    </>
  );
}

function BinnenIcon({ color }: { color: string }) {
  // Zwembad binnen: zwemmer + baan-lijn eronder (zwembaan)
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <SwimmerBody />
      <path d="M3 21h18" strokeWidth="1.6" opacity="0.7" />
    </svg>
  );
}

function BuitenIcon({ color }: { color: string }) {
  // Zwembad buiten: zwemmer + zonnetje rechtsboven
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <SwimmerBody />
      <circle cx="19" cy="5" r="2" strokeWidth="1.8" />
      <path d="M19 1.5v0.8M19 9.2v0.8M22.5 5h-0.8M16.3 5h-0.8M21.4 2.6l-0.6 0.6M17.2 7.2l-0.6 0.6M21.4 7.4l-0.6-0.6M17.2 2.8l-0.6-0.6" strokeWidth="1.3" opacity="0.85" />
    </svg>
  );
}

function OpenwaterIcon({ color }: { color: string }) {
  // Openwater: zwemmer + extra golvende waterlijn onderaan
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <SwimmerBody />
      <path d="M2 20.5c1.2-1.4 2.4-1.4 3.6 0s2.4 1.4 3.6 0 2.4-1.4 3.6 0 2.4 1.4 3.6 0 2.4-1.4 3.6 0" strokeWidth="1.6" opacity="0.8" />
    </svg>
  );
}

const ICON_MAP: Record<SwimVariant, React.FC<{ color: string }>> = {
  zwembad_binnen: BinnenIcon,
  zwembad_buiten: BuitenIcon,
  openwater: OpenwaterIcon,
};

interface Props {
  variant: SwimVariant;
  size?: 'sm' | 'md' | 'lg';
}

export default function SwimVariantIcon({ variant, size = 'md' }: Props) {
  const { stroke, glow } = COLORS[variant];
  const { box, icon, radius } = SIZE_MAP[size];
  const Component = ICON_MAP[variant];
  return (
    <div className={`${box} ${radius} bg-gray-900 flex items-center justify-center flex-shrink-0`}>
      <div className={icon} style={{ filter: glow }}>
        <Component color={stroke} />
      </div>
    </div>
  );
}
