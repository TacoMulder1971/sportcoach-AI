'use client';

import { Sport } from '@/lib/types';

interface SportIconProps {
  sport: Sport | 'overig';
  size?: 'sm' | 'md' | 'lg';
}

const NEON_COLORS: Record<string, { stroke: string; glow: string }> = {
  zwemmen:      { stroke: '#3b82f6', glow: 'drop-shadow(0 0 6px #3b82f6) drop-shadow(0 0 14px rgba(59,130,246,0.4))' },
  fietsen:      { stroke: '#22c55e', glow: 'drop-shadow(0 0 6px #22c55e) drop-shadow(0 0 14px rgba(34,197,94,0.4))' },
  hardlopen:    { stroke: '#f97316', glow: 'drop-shadow(0 0 6px #f97316) drop-shadow(0 0 14px rgba(249,115,22,0.4))' },
  mountainbike: { stroke: '#10b981', glow: 'drop-shadow(0 0 6px #10b981) drop-shadow(0 0 14px rgba(16,185,129,0.4))' },
  rust:         { stroke: '#6b7280', glow: 'drop-shadow(0 0 4px #6b7280) drop-shadow(0 0 10px rgba(107,114,128,0.3))' },
  overig:       { stroke: '#6b7280', glow: 'drop-shadow(0 0 4px #6b7280) drop-shadow(0 0 10px rgba(107,114,128,0.3))' },
};

const SIZE_MAP = {
  sm: { box: 'w-8 h-8',   icon: 'w-5 h-5',   radius: 'rounded-lg' },
  md: { box: 'w-10 h-10', icon: 'w-6 h-6',    radius: 'rounded-xl' },
  lg: { box: 'w-11 h-11', icon: 'w-[26px] h-[26px]', radius: 'rounded-xl' },
};

function SwimIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="6" cy="7" r="2.5" />
      <path d="M3 17c1-2 3-4 5.5-4s3 1.5 5 1.5 3.5-1.5 5.5-1.5c1.5 0 2.5.5 3 1" />
      <path d="M8.5 12l3 2.5-1.5 3" />
    </svg>
  );
}

function BikeIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="17.5" cy="5" r="2.2" />
      <circle cx="6" cy="18" r="3" strokeWidth="2" />
      <circle cx="18" cy="18" r="3" strokeWidth="2" />
      <path d="M18 18l-3.5-7-3 3.5-2-2.5L6 18" />
      <path d="M14.5 11l2-4.5" />
    </svg>
  );
}

function RunIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13" cy="4" r="2.5" />
      <path d="M10 10l-3 10" />
      <path d="M13.5 7L11 12l4 2-1.5 6" />
      <path d="M17 7l-3.5 0" />
      <path d="M7 20l3-10" />
    </svg>
  );
}

function MountainBikeIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="17.5" cy="5" r="2.2" />
      <circle cx="6" cy="18" r="3" strokeWidth="2" />
      <circle cx="18" cy="18" r="3" strokeWidth="2" />
      <path d="M18 18l-3.5-7-3 3.5-2-2.5L6 18" />
      <path d="M14.5 11l2-4.5" />
      <path d="M2 14l4-4 4 2 4-5 4 1" />
    </svg>
  );
}

function RestIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function UnknownIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9a3 3 0 0 1 5.5 1.5c0 2-3 2.5-3 4.5" />
      <circle cx="12" cy="18" r="0.5" fill={color} />
    </svg>
  );
}

const ICON_MAP: Record<string, React.FC<{ color: string }>> = {
  zwemmen: SwimIcon,
  fietsen: BikeIcon,
  hardlopen: RunIcon,
  mountainbike: MountainBikeIcon,
  rust: RestIcon,
  overig: UnknownIcon,
};

export default function SportIcon({ sport, size = 'md' }: SportIconProps) {
  const { stroke, glow } = NEON_COLORS[sport] || NEON_COLORS.overig;
  const { box, icon, radius } = SIZE_MAP[size];
  const IconComponent = ICON_MAP[sport] || ICON_MAP.overig;

  return (
    <div className={`${box} ${radius} bg-gray-900 flex items-center justify-center flex-shrink-0`}>
      <div className={icon} style={{ filter: glow }}>
        <IconComponent color={stroke} />
      </div>
    </div>
  );
}
