'use client';

import { Sport } from '@/lib/types';

interface SportIconProps {
  sport: Sport | 'overig';
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

const NEON_COLORS: Record<string, { stroke: string; glow: string }> = {
  zwemmen:      { stroke: '#3b82f6', glow: 'drop-shadow(0 0 6px #3b82f6) drop-shadow(0 0 14px rgba(59,130,246,0.4))' },
  fietsen:      { stroke: '#22c55e', glow: 'drop-shadow(0 0 6px #22c55e) drop-shadow(0 0 14px rgba(34,197,94,0.4))' },
  hardlopen:    { stroke: '#f97316', glow: 'drop-shadow(0 0 6px #f97316) drop-shadow(0 0 14px rgba(249,115,22,0.4))' },
  mountainbike: { stroke: '#10b981', glow: 'drop-shadow(0 0 6px #10b981) drop-shadow(0 0 14px rgba(16,185,129,0.4))' },
  wandelen:     { stroke: '#14b8a6', glow: 'drop-shadow(0 0 6px #14b8a6) drop-shadow(0 0 14px rgba(20,184,166,0.4))' },
  voetballen:   { stroke: '#eab308', glow: 'drop-shadow(0 0 6px #eab308) drop-shadow(0 0 14px rgba(234,179,8,0.4))' },
  multisport:   { stroke: '#a855f7', glow: 'drop-shadow(0 0 6px #a855f7) drop-shadow(0 0 14px rgba(168,85,247,0.4))' },
  kracht:       { stroke: '#f43f5e', glow: 'drop-shadow(0 0 6px #f43f5e) drop-shadow(0 0 14px rgba(244,63,94,0.4))' },
  rust:         { stroke: '#6b7280', glow: 'drop-shadow(0 0 4px #6b7280) drop-shadow(0 0 10px rgba(107,114,128,0.3))' },
  overig:       { stroke: '#6b7280', glow: 'drop-shadow(0 0 4px #6b7280) drop-shadow(0 0 10px rgba(107,114,128,0.3))' },
};

const SIZE_MAP = {
  sm: { box: 'w-8 h-8',   icon: 'w-5 h-5',   radius: 'rounded-lg' },
  md: { box: 'w-10 h-10', icon: 'w-6 h-6',    radius: 'rounded-xl' },
  lg: { box: 'w-11 h-11', icon: 'w-[26px] h-[26px]', radius: 'rounded-xl' },
  xl: { box: 'w-14 h-14', icon: 'w-8 h-8', radius: 'rounded-xl' },
  '2xl': { box: 'w-20 h-20', icon: 'w-12 h-12', radius: 'rounded-2xl' },
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

function WalkIcon({ color }: { color: string }) {
  // Wandelaar in beweging — rustigere houding dan hardlopen, met wandelstok-suggestie via gestrekt been
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13" cy="4" r="2" />
      <path d="M13 7v5l-3 3.5L12 21" />
      <path d="M12 13.5l4 1.5" />
      <path d="M10 8l-3 2 2 3" />
      <path d="M8 21l1.5-4" />
    </svg>
  );
}

function SoccerIcon({ color }: { color: string }) {
  // Voetbal (klassiek bal-pattern) + voetlijn eronder voor schop-suggestie
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="11" r="7" />
      {/* pentagon in midden */}
      <path d="M12 7.5 L 15 9.5 L 14 13 L 10 13 L 9 9.5 Z" strokeWidth="1.6" />
      {/* paneeltjes naar rand */}
      <path d="M12 7.5 L 12 4.5 M 15 9.5 L 18 8 M 14 13 L 16.5 15.5 M 10 13 L 7.5 15.5 M 9 9.5 L 6 8" strokeWidth="1.4" opacity="0.85" />
    </svg>
  );
}

function StrengthIcon({ color }: { color: string }) {
  // Halter (dumbbell): twee gewichtsschijven met een staaf ertussen
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 12h6" />
      <path d="M6.5 8.5v7M3.5 10v4" />
      <path d="M17.5 8.5v7M20.5 10v4" />
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

// Multisport (triathlon/brick): drie kleintjes — zwemmer links, loper rechts, fiets middenboven
function MultisportIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {/* Zwemgolf links */}
      <path d="M2 16c.6-1 1.8-2 3-2s1.8.9 3 .9" />
      {/* Fiets midden */}
      <circle cx="12" cy="9" r="2" />
      <path d="M10 9h4" />
      <circle cx="9.5" cy="13" r="1.5" strokeWidth="1.5" />
      <circle cx="14.5" cy="13" r="1.5" strokeWidth="1.5" />
      <path d="M12 9l-2.5 4 5 0" />
      {/* Hardloopgolf rechts */}
      <circle cx="20" cy="6" r="1.2" />
      <path d="M19.5 8l-1 3 1.5 1" />
      <path d="M18.5 11l-1 3" />
    </svg>
  );
}

const ICON_MAP: Record<string, React.FC<{ color: string }>> = {
  zwemmen: SwimIcon,
  fietsen: BikeIcon,
  hardlopen: RunIcon,
  mountainbike: MountainBikeIcon,
  wandelen: WalkIcon,
  voetballen: SoccerIcon,
  multisport: MultisportIcon,
  kracht: StrengthIcon,
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
