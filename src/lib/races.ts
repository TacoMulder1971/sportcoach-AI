import { GarminActivity, GarminHealthStats, Goal, GoalSplit, GOAL_TYPES } from './types';
import { calcTRIMP } from './training-load';

// ── Race view-model ──────────────────────────────────────────────
// Een wedstrijd = een Goal, eventueel gekoppeld aan de Garmin-activiteit van
// dezelfde dag (voor echte splits/pace/HR). Niets hiervan wordt opgeslagen —
// puur afgeleid uit getGoals() + het activiteiten-archief.

export interface Race {
  goal: Goal;
  activity?: GarminActivity;       // gekoppelde Garmin-activiteit (zelfde datum)
  status: 'upcoming' | 'done';
}

export interface RaceSplit {
  discipline: string;              // 'zwemmen' | 'fietsen' | 'hardlopen' | 'transitie'
  label: string;                   // weergavelabel ("Zwemmen", "T1", ...)
  timeSeconds: number;
  distanceKm?: number;
  avgHR?: number;
  avgPower?: number;
  pace?: string;                   // afgeleid ("4:12/km", "1:45/100m", "32.4 km/h")
  color: string;
}

export const DISCIPLINE_COLORS: Record<string, string> = {
  zwemmen: '#3b82f6',
  fietsen: '#22c55e',
  hardlopen: '#f97316',
  transitie: '#9ca3af',
};

const DISCIPLINE_LABELS: Record<string, string> = {
  zwemmen: 'Zwemmen',
  fietsen: 'Fietsen',
  hardlopen: 'Hardlopen',
};

function todayISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' });
}

/** Normaliseer een vrije-tekst discipline naar een bekende sleutel. */
function normalizeDiscipline(raw: string): string {
  const d = (raw || '').toLowerCase();
  if (d.startsWith('t') && /\d/.test(d)) return 'transitie';      // T1 / T2
  if (d.includes('transi') || d.includes('wissel')) return 'transitie';
  if (d.includes('zwem') || d.includes('swim')) return 'zwemmen';
  if (d.includes('fiets') || d.includes('bike') || d.includes('cycl')) return 'fietsen';
  if (d.includes('loop') || d.includes('run')) return 'hardlopen';
  return d;
}

/** Bereken tempo-tekst voor een onderdeel. */
function paceFor(discipline: string, distanceKm: number | undefined, timeSeconds: number): string | undefined {
  if (!distanceKm || distanceKm <= 0 || timeSeconds <= 0) return undefined;
  if (discipline === 'hardlopen') {
    const paceMin = timeSeconds / 60 / distanceKm;
    const m = Math.floor(paceMin);
    const s = Math.round((paceMin - m) * 60);
    return `${m}:${s.toString().padStart(2, '0')}/km`;
  }
  if (discipline === 'zwemmen') {
    const per100 = timeSeconds / (distanceKm * 10);
    const m = Math.floor(per100 / 60);
    const s = Math.round(per100 % 60);
    return `${m}:${s.toString().padStart(2, '0')}/100m`;
  }
  if (discipline === 'fietsen') {
    const kmh = distanceKm / (timeSeconds / 3600);
    return `${Math.round(kmh * 10) / 10} km/h`;
  }
  return undefined;
}

/**
 * Koppel elk Goal aan de Garmin-activiteit van (ongeveer) dezelfde dag en
 * bepaal de status. Sorteert komende wedstrijden eerst (oplopend), daarna
 * afgeronde (aflopend).
 */
export function buildRaces(goals: Goal[], archive: GarminActivity[]): Race[] {
  const today = todayISO();

  const findActivity = (goal: Goal): GarminActivity | undefined => {
    const sameDay = archive.filter(a => Math.abs(daysBetween(a.date, goal.date)) <= 1);
    if (sameDay.length === 0) return undefined;
    const info = GOAL_TYPES.find(t => t.type === goal.type);
    if (info?.multiSport) {
      const multi = sameDay.find(a => a.isMultisport);
      if (multi) return multi;
    }
    // anders: de langste activiteit van die dag (meest waarschijnlijk de wedstrijd)
    return sameDay.sort((a, b) => b.durationMinutes - a.durationMinutes)[0];
  };

  const races: Race[] = goals.map(goal => ({
    goal,
    activity: findActivity(goal),
    status: (goal.date < today || !!goal.result) ? 'done' : 'upcoming',
  }));

  return races.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'upcoming' ? -1 : 1;
    return a.status === 'upcoming'
      ? a.goal.date.localeCompare(b.goal.date)   // eerstvolgende eerst
      : b.goal.date.localeCompare(a.goal.date);  // meest recente eerst
  });
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);
}

/**
 * Splits per onderdeel voor weergave. Bron-prioriteit:
 * 1. gekoppelde Garmin-activiteit (echte data, sport per child)
 * 2. handmatig ingevoerd GoalResult.splits
 */
export function getRaceSplits(race: Race): RaceSplit[] {
  let transitionNr = 0;
  const toView = (
    discipline: string,
    timeSeconds: number,
    distanceKm?: number,
    avgHR?: number,
    avgPower?: number,
  ): RaceSplit => {
    const d = normalizeDiscipline(discipline);
    const label = d === 'transitie' ? `T${++transitionNr}` : (DISCIPLINE_LABELS[d] || discipline);
    return {
      discipline: d,
      label,
      timeSeconds,
      distanceKm,
      avgHR: avgHR && avgHR > 0 ? avgHR : undefined,
      avgPower: avgPower && avgPower > 0 ? avgPower : undefined,
      pace: paceFor(d, distanceKm, timeSeconds),
      color: DISCIPLINE_COLORS[d] || '#6b7280',
    };
  };

  // 1. Garmin-splits (multisport children of laps met sport)
  const gSplits = race.activity?.splits;
  if (gSplits && gSplits.length > 1 && gSplits.some(s => s.sport)) {
    return gSplits
      .filter(s => s.sport)
      .map(s => toView(s.sport as string, s.durationSeconds, s.distance, s.avgHR, s.avgPower));
  }

  // 2. Handmatige GoalResult-splits
  const rSplits: GoalSplit[] | undefined = race.goal.result?.splits;
  if (rSplits && rSplits.length > 0) {
    return rSplits.map(s => toView(s.discipline, s.timeSeconds, s.distanceKm));
  }

  return [];
}

/** Eindtijd in seconden: GoalResult → anders totale duur van de gekoppelde activiteit. */
export function getRaceTotalSeconds(race: Race): number | undefined {
  if (race.goal.result?.totalTimeSeconds) return race.goal.result.totalTimeSeconds;
  if (race.activity?.durationMinutes) return Math.round(race.activity.durationMinutes * 60);
  return undefined;
}

// ── Aanloop naar de wedstrijd ────────────────────────────────────

export interface TrendSeries {
  label: string;             // weergavetitel
  unit: string;
  color: string;
  invertY?: boolean;         // voor tempo: lager = beter
  data: { label: string; value: number }[];
}

export interface SportBreakdown {
  sport: string;
  label: string;
  color: string;
  sessions: number;
  km: number;
  minutes: number;
}

export interface PreRaceBuildup {
  startDate: string | null;   // eerste activiteit in het venster
  endDate: string;            // racedag
  spanWeeks: number;          // weken tussen eerste activiteit en race
  weeksWithData: number;      // weken met ≥1 activiteit
  totalSessions: number;
  totalMinutes: number;
  totalKm: number;
  totalTrimp: number;
  avgHR: number;
  bySport: SportBreakdown[];
  weekly: TrendSeries[];      // km, duur, TRIMP, gem. HR
  activities: GarminActivity[]; // venster, datum aflopend
}

const SPORT_META: Record<string, { label: string; color: string }> = {
  zwemmen:      { label: 'Zwemmen', color: '#3b82f6' },
  fietsen:      { label: 'Fietsen', color: '#22c55e' },
  hardlopen:    { label: 'Hardlopen', color: '#f97316' },
  mountainbike: { label: 'Mountainbike', color: '#10b981' },
  wandelen:     { label: 'Wandelen', color: '#14b8a6' },
  multisport:   { label: 'Multisport', color: '#a855f7' },
  voetballen:   { label: 'Voetballen', color: '#eab308' },
  overig:       { label: 'Overig', color: '#6b7280' },
};

const BUILDUP_WEEKS = 20;

/**
 * Volledig beeld van de trainingsaanloop in de N weken vóór (en t/m) de racedag:
 * wanneer gestart, hoeveel getraind (sessies/uren/km/TRIMP), met welke intensiteit
 * (gem. HR + TRIMP per week), de verdeling per sport en de losse activiteiten.
 * Opgebouwd uit het activiteiten-archief (HRV wordt bewust niet getoond).
 */
export function getPreRaceBuildup(
  archive: GarminActivity[],
  health: GarminHealthStats[],
  raceDate: string,
  weeks = BUILDUP_WEEKS,
): PreRaceBuildup {
  const restingHR = avgRestingHR(health);
  const raceMid = new Date(raceDate + 'T12:00:00');
  const windowStart = new Date(raceMid);
  windowStart.setDate(windowStart.getDate() - weeks * 7);
  const windowStartStr = windowStart.toISOString().split('T')[0];

  const acts = archive
    .filter(a => a.date >= windowStartStr && a.date <= raceDate)
    .sort((a, b) => b.date.localeCompare(a.date));

  // Wekelijkse buckets
  const buckets: {
    label: string; start: string; end: string;
    km: number; minutes: number; hrSum: number; hrCount: number; trimp: number; sessions: number;
  }[] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const end = new Date(raceMid);
    end.setDate(end.getDate() - w * 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    buckets.push({
      label: start.toLocaleDateString('nl-NL', { day: 'numeric', month: 'numeric' }),
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
      km: 0, minutes: 0, hrSum: 0, hrCount: 0, trimp: 0, sessions: 0,
    });
  }

  const sportMap = new Map<string, SportBreakdown>();
  let totalMinutes = 0, totalKm = 0, totalTrimp = 0, hrSum = 0, hrCount = 0;

  for (const a of acts) {
    totalMinutes += a.durationMinutes;
    totalKm += a.distanceKm;
    totalTrimp += calcTRIMP(a, restingHR);
    if (a.avgHR > 0) { hrSum += a.avgHR; hrCount++; }

    const key = a.sport;
    const meta = SPORT_META[key] || SPORT_META.overig;
    const sb = sportMap.get(key) || { sport: key, label: meta.label, color: meta.color, sessions: 0, km: 0, minutes: 0 };
    sb.sessions++; sb.km += a.distanceKm; sb.minutes += a.durationMinutes;
    sportMap.set(key, sb);

    const b = buckets.find(x => a.date >= x.start && a.date <= x.end);
    if (b) {
      b.km += a.distanceKm; b.minutes += a.durationMinutes; b.trimp += calcTRIMP(a, restingHR); b.sessions++;
      if (a.avgHR > 0) { b.hrSum += a.avgHR; b.hrCount++; }
    }
  }

  const weekly: TrendSeries[] = [];
  const push = (s: TrendSeries) => { if (s.data.filter(d => d.value > 0).length >= 2) weekly.push(s); };
  push({ label: 'Volume per week (km)', unit: 'km', color: '#22c55e',
    data: buckets.map(b => ({ label: b.label, value: Math.round(b.km * 10) / 10 })) });
  push({ label: 'Trainingsduur per week (min)', unit: 'min', color: '#6366f1',
    data: buckets.map(b => ({ label: b.label, value: Math.round(b.minutes) })) });
  push({ label: 'Belasting per week (TRIMP)', unit: '', color: '#f59e0b',
    data: buckets.map(b => ({ label: b.label, value: Math.round(b.trimp) })) });
  push({ label: 'Gemiddelde hartslag per week', unit: 'bpm', color: '#ef4444',
    data: buckets.map(b => ({ label: b.label, value: b.hrCount ? Math.round(b.hrSum / b.hrCount) : 0 })) });

  const startDate = acts.length > 0 ? acts[acts.length - 1].date : null;
  const spanWeeks = startDate
    ? Math.max(1, Math.ceil(daysBetween(raceDate, startDate) / 7))
    : 0;
  const weeksWithData = buckets.filter(b => b.sessions > 0).length;

  const bySport = Array.from(sportMap.values()).sort((a, b) => b.minutes - a.minutes);

  return {
    startDate, endDate: raceDate, spanWeeks, weeksWithData,
    totalSessions: acts.length,
    totalMinutes: Math.round(totalMinutes),
    totalKm: Math.round(totalKm * 10) / 10,
    totalTrimp: Math.round(totalTrimp),
    avgHR: hrCount ? Math.round(hrSum / hrCount) : 0,
    bySport, weekly, activities: acts,
  };
}

function avgRestingHR(health: GarminHealthStats[]): number {
  const valid = health.filter(h => h.restingHR > 0);
  if (valid.length === 0) return 55;
  return Math.round(valid.reduce((s, h) => s + h.restingHR, 0) / valid.length);
}
