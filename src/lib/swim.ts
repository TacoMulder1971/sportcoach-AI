// Helpers voor zwem-varianten (binnen/buiten/openwater) en zwemtempo-targets.
import { SwimVariant, ActivitySwimVariants, GarminActivity, HeartRateZone, SwimPaceZone } from './types';

/**
 * Bepaalt de zwem-variant van een activiteit.
 * Volgorde: expliciete user-override > door Garmin afgeleide variant > 'zwembad_binnen'.
 */
export function swimVariantForActivity(
  activity: { id: string | number; swimVariant?: SwimVariant },
  variants: ActivitySwimVariants,
): SwimVariant {
  const override = variants[String(activity.id)];
  if (override) return override;
  return activity.swimVariant ?? 'zwembad_binnen';
}

// ─── Zwemtempo-targets per zone ─────────────────────────────────────
// In het water is hartslag onbruikbaar als stuurmiddel (meting onbetrouwbaar,
// je kijkt niet op je horloge tijdens de slag). Zwemmers sturen op tempo per
// 100m. We leiden een basistempo af uit recente zwemtrainingen in het archief
// en vertalen de Z1–Z5-intensiteiten naar richttempo's rond dat basistempo.

export interface SwimPaceTarget {
  zone: HeartRateZone;
  label: string;        // zelfde intensiteitslabels als de HR-zones
  minSecPer100: number; // sneller uiteinde van het bereik
  maxSecPer100: number; // langzamer uiteinde
}

export interface SwimPaceTargets {
  baseSecPer100: number; // mediaan tempo van de recente zwemtrainingen (of handmatige waarde)
  basedOnCount: number;  // aantal trainingen waarop dit gebaseerd is (0 bij handmatig)
  source: 'auto' | 'handmatig'; // afgeleid uit archief of door de gebruiker ingesteld
  zones: SwimPaceTarget[];
}

/** "2:05" of "125" → seconden per 100m; null bij onbruikbare invoer. */
export function parseSwimPace(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  let sec: number;
  const colonMatch = trimmed.match(/^(\d{1,2})[:.](\d{1,2})$/);
  if (colonMatch) {
    sec = parseInt(colonMatch[1]) * 60 + parseInt(colonMatch[2]);
  } else if (/^\d+$/.test(trimmed)) {
    sec = parseInt(trimmed);
  } else {
    return null;
  }
  if (sec < PLAUSIBLE_SEC_PER_100.min || sec > PLAUSIBLE_SEC_PER_100.max) return null;
  return sec;
}

/** Zone-richttempo's rond een gegeven basistempo (auto-schatting uit het archief). */
export function buildSwimPaceTargets(baseSecPer100: number, source: 'auto' | 'handmatig', basedOnCount: number): SwimPaceTargets {
  return {
    baseSecPer100: Math.round(baseSecPer100),
    basedOnCount,
    source,
    zones: ZONE_OFFSETS.map(z => ({
      zone: z.zone,
      label: z.label,
      minSecPer100: Math.round(baseSecPer100 + z.min),
      maxSecPer100: Math.round(baseSecPer100 + z.max),
    })),
  };
}

/** Targets uit handmatig ingestelde Z1–Z5-tempo's (volgorde Z1..Z5). */
export function buildSwimPaceTargetsFromZones(zones: SwimPaceZone[]): SwimPaceTargets {
  return {
    // Z3 (aeroob) begint op het basistempo in de auto-afleiding; gebruik dat als referentie
    baseSecPer100: zones[2]?.minSecPer100 ?? zones[0].minSecPer100,
    basedOnCount: 0,
    source: 'handmatig',
    zones: ZONE_OFFSETS.map((z, i) => ({
      zone: z.zone,
      label: z.label,
      minSecPer100: zones[i].minSecPer100,
      maxSecPer100: zones[i].maxSecPer100,
    })),
  };
}

/** "125" → "2:05" */
export function formatSwimPace(secPer100: number): string {
  const m = Math.floor(secPer100 / 60);
  const s = Math.round(secPer100 % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Weergavebereik: "2:05–2:12" */
export function formatSwimPaceRange(t: SwimPaceTarget): string {
  return `${formatSwimPace(t.minSecPer100)}–${formatSwimPace(t.maxSecPer100)}`;
}

// Offsets in sec/100m t.o.v. het basistempo (mediaan van hele trainingen,
// inclusief techniek/rust — dat zit qua intensiteit rond rustig duurtempo).
const ZONE_OFFSETS: { zone: HeartRateZone; label: string; min: number; max: number }[] = [
  { zone: 'Z1', label: 'Herstel', min: 8,   max: 14 },
  { zone: 'Z2', label: 'Basis',   min: 4,   max: 8 },
  { zone: 'Z3', label: 'Aeroob',  min: 0,   max: 4 },
  { zone: 'Z4', label: 'Drempel', min: -4,  max: 0 },
  { zone: 'Z5', label: 'VO2max',  min: -8,  max: -4 },
];

const MAX_AGE_DAYS = 120;
const MAX_SWIMS = 10;
const MIN_SWIMS = 2;
const MIN_DISTANCE_KM = 0.4;
const PLAUSIBLE_SEC_PER_100 = { min: 60, max: 240 };

/**
 * Richttempo's per zone uit recente zwemactiviteiten (archief).
 * null als er te weinig bruikbare zwemdata is (< 2 trainingen).
 */
export function estimateSwimPaceTargets(archive: GarminActivity[]): SwimPaceTargets | null {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const paces = archive
    .filter(a => a.sport === 'zwemmen' && a.date >= cutoffStr && a.distanceKm >= MIN_DISTANCE_KM && a.durationMinutes > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, MAX_SWIMS)
    .map(a => (a.durationMinutes * 60) / (a.distanceKm * 10))
    .filter(p => p >= PLAUSIBLE_SEC_PER_100.min && p <= PLAUSIBLE_SEC_PER_100.max);

  if (paces.length < MIN_SWIMS) return null;

  const sorted = [...paces].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const base = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  return buildSwimPaceTargets(base, 'auto', paces.length);
}
