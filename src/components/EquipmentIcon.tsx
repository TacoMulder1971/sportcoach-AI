'use client';

import { EquipmentType } from '@/lib/types';

// Kleuren matchen de sport-koppeling: fietsen=groen, mountainbike=emerald,
// hardlopen=oranje. Stadsfiets is bewust grijs (telt niet mee voor stats).
const COLORS: Record<EquipmentType, { stroke: string; glow: string }> = {
  racefiets:        { stroke: '#22c55e', glow: 'drop-shadow(0 0 6px #22c55e) drop-shadow(0 0 14px rgba(34,197,94,0.4))' },
  mountainbike:     { stroke: '#10b981', glow: 'drop-shadow(0 0 6px #10b981) drop-shadow(0 0 14px rgba(16,185,129,0.4))' },
  stadsfiets:       { stroke: '#94a3b8', glow: 'drop-shadow(0 0 4px #94a3b8) drop-shadow(0 0 10px rgba(148,163,184,0.3))' },
  hardloopschoenen: { stroke: '#f97316', glow: 'drop-shadow(0 0 6px #f97316) drop-shadow(0 0 14px rgba(249,115,22,0.4))' },
  overig:           { stroke: '#a78bfa', glow: 'drop-shadow(0 0 4px #a78bfa) drop-shadow(0 0 10px rgba(167,139,250,0.3))' },
  fiets:            { stroke: '#22c55e', glow: 'drop-shadow(0 0 6px #22c55e) drop-shadow(0 0 14px rgba(34,197,94,0.4))' }, // legacy
};

const SIZE_MAP = {
  sm: { box: 'w-7 h-7',   icon: 'w-4 h-4',   radius: 'rounded-md' },
  md: { box: 'w-9 h-9',   icon: 'w-5 h-5',   radius: 'rounded-lg' },
  lg: { box: 'w-11 h-11', icon: 'w-[26px] h-[26px]', radius: 'rounded-xl' },
};

// ── SVG silhouetten (24x24, stroke-based, matchen stijl van SportIcon.tsx) ──

function RacefietsSvg({ color }: { color: string }) {
  // Lage racefiets-houding: hoofd vooraan, voorwaarts gebogen frame, drophorn
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

function MountainbikeSvg({ color }: { color: string }) {
  // Zelfde frame + bergen onder de fiets als terrein-hint
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

function StadsfietsSvg({ color }: { color: string }) {
  // Rechtopstaande omafiets: hoge handlebars + zadel + (klein) mandje voorop
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5.5" cy="18.5" r="2.5" strokeWidth="2" />
      <circle cx="18.5" cy="18.5" r="2.5" strokeWidth="2" />
      {/* Frame: achterwiel → zadel → trapas → voorvork */}
      <path d="M5.5 18.5 L 11 11 L 18.5 18.5" />
      {/* Zadelbuis + stuurpen */}
      <path d="M11 11 L 11 5" />
      <path d="M9 5 L 13 5" />
      {/* Stuur omhoog naar voren */}
      <path d="M13 6 L 17 5 L 18.5 18.5" strokeWidth="1.8" opacity="0.85" />
      {/* Mini mandje voorop */}
      <path d="M14.5 5 L 14.5 7.5 L 17 7.5 L 17 5" strokeWidth="1.5" />
    </svg>
  );
}

function ShoeSvg({ color }: { color: string }) {
  // Hardloopschoen zij-aanzicht: hak + zool + bovenkant + veters
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      {/* Buitenlijn schoen */}
      <path d="M2 16 C 2 13.5 4 12.5 6.5 12.5 L 13 12.5 C 17 12.5 20.5 14 21.5 16.5 L 22 18 L 2 18 Z" />
      {/* Sole-stripe */}
      <path d="M2 16 L 22 16" strokeWidth="1.5" opacity="0.7" />
      {/* Veters / upper detail */}
      <path d="M 7 14 L 9 13 M 10 14 L 12 13 M 13 14 L 14.5 13" strokeWidth="1.4" opacity="0.85" />
    </svg>
  );
}

function WrenchSvg({ color }: { color: string }) {
  // Steeksleutel — voor "Overig" / gereedschap
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a4 4 0 0 1 5.4 5.4l-1.7 1.7-3.7-3.7Z" />
      <path d="M14.7 6.3 4.5 16.5l3 3 10.2-10.2" />
      <circle cx="6" cy="18" r="0.8" fill={color} stroke="none" />
    </svg>
  );
}

const ICON_MAP: Record<EquipmentType, React.FC<{ color: string }>> = {
  racefiets: RacefietsSvg,
  mountainbike: MountainbikeSvg,
  stadsfiets: StadsfietsSvg,
  hardloopschoenen: ShoeSvg,
  overig: WrenchSvg,
  fiets: RacefietsSvg, // legacy fallback
};

interface Props {
  type: EquipmentType;
  size?: 'sm' | 'md' | 'lg';
}

export default function EquipmentIcon({ type, size = 'md' }: Props) {
  const { stroke, glow } = COLORS[type] || COLORS.overig;
  const { box, icon, radius } = SIZE_MAP[size];
  const Component = ICON_MAP[type] || WrenchSvg;
  return (
    <div className={`${box} ${radius} bg-gray-900 flex items-center justify-center flex-shrink-0`}>
      <div className={icon} style={{ filter: glow }}>
        <Component color={stroke} />
      </div>
    </div>
  );
}
