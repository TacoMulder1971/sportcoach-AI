// Periodisering — fallback datum voor migratie; echte datum komt nu van actief doel.
const FALLBACK_RACE_DATE = '2026-06-13';

export interface TrainingPhase {
  id: string;
  label: string;
  description: string;
  goals: string[];
  color: string;       // Tailwind-achtige hex kleur
  bgColor: string;     // achtergrond voor kaart
  borderColor: string; // border voor kaart
  minDays: number;     // minimale dagen tot race (exclusief)
  maxDays: number;     // maximale dagen tot race (inclusief)
}

export const TRAINING_PHASES: TrainingPhase[] = [
  {
    id: 'basis',
    label: 'Basisfase',
    description: 'Aerobe basis opbouwen, techniek verfijnen, blessurepreventie.',
    goals: ['Volume geleidelijk opbouwen', 'Zwemtechniek verbeteren', 'Lange Z2-sessies'],
    color: '#22c55e',
    bgColor: '#f0fdf4',
    borderColor: '#bbf7d0',
    minDays: 70,
    maxDays: 999,
  },
  {
    id: 'opbouw',
    label: 'Opbouwfase',
    description: 'Volume en intensiteit verhogen, race-specifieke sessies introduceren.',
    goals: ['Intensiteit omhoog (Z3/Z4)', 'Eerste brick-trainingen', 'Open water zwemmen'],
    color: '#3b82f6',
    bgColor: '#eff6ff',
    borderColor: '#bfdbfe',
    minDays: 42,
    maxDays: 70,
  },
  {
    id: 'piek',
    label: 'Piekfase',
    description: 'Wedstrijdspecifieke training, maximale belasting, mentale voorbereiding.',
    goals: ['Race-tempo sessies', 'Lange brick (fiets+loop)', 'Transitions oefenen'],
    color: '#f59e0b',
    bgColor: '#fffbeb',
    borderColor: '#fde68a',
    minDays: 21,
    maxDays: 42,
  },
  {
    id: 'taper',
    label: 'Taperfase',
    description: 'Volume flink verlagen, scherpte behouden, focus op rust en herstel.',
    goals: ['Volume -40 tot -60%', 'Korte scherpe sessies', 'Slaap en voeding optimaliseren'],
    color: '#8b5cf6',
    bgColor: '#f5f3ff',
    borderColor: '#ddd6fe',
    minDays: 7,
    maxDays: 21,
  },
  {
    id: 'wedstrijd',
    label: 'Wedstrijdweek',
    description: 'Minimale belasting, materiaal checken, race-plan doorlopen.',
    goals: ['Alleen lichte activatie', 'Materiaal & voeding klaarleggen', 'Race-plan visualiseren'],
    color: '#ef4444',
    bgColor: '#fef2f2',
    borderColor: '#fecaca',
    minDays: 0,
    maxDays: 7,
  },
];

export function getDaysUntilRace(raceDate: string = FALLBACK_RACE_DATE): number {
  const race = new Date(raceDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  race.setHours(0, 0, 0, 0);
  return Math.ceil((race.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// Na de racedag (en zonder nieuw doel): herstel-/overgangsfase. Bewust NIET in
// TRAINING_PHASES — de tijdlijnen (Countdown, seizoensoverzicht) tonen alleen de
// aanloopfases; deze fase bestaat alleen als "huidige fase" voor UI en AI-context.
export const POST_RACE_PHASE: TrainingPhase = {
  id: 'herstel',
  label: 'Herstel- en overgangsfase',
  description: 'De wedstrijd is geweest. Actief herstel, onderhoudstraining en een nieuw doel kiezen.',
  goals: ['Rustig bewegen (Z1/Z2)', 'Evalueer je race', 'Kies je volgende doel'],
  color: '#14b8a6',
  bgColor: '#f0fdfa',
  borderColor: '#99f6e4',
  minDays: -999,
  maxDays: 0,
};

export function getCurrentPhase(raceDate: string = FALLBACK_RACE_DATE): TrainingPhase {
  const days = getDaysUntilRace(raceDate);
  // Racedag zelf hoort nog bij de wedstrijdweek; daarna begint het herstel.
  if (days < 0) return POST_RACE_PHASE;
  // Vind de fase waar dagen tot race in valt
  for (const phase of TRAINING_PHASES) {
    if (days > phase.minDays && days <= phase.maxDays) {
      return phase;
    }
  }
  // Exact op wedstrijddag
  return TRAINING_PHASES[TRAINING_PHASES.length - 1];
}

/**
 * Hele dagen tussen een kalenderdag en de racedag (UTC, dus geen tijdzone-drift).
 * Positief = race ligt in de toekomst.
 */
export function daysUntilRaceOn(dateISO: string, raceDate: string): number {
  const from = new Date(`${dateISO.split('T')[0]}T00:00:00Z`);
  const race = new Date(`${raceDate.split('T')[0]}T00:00:00Z`);
  if (isNaN(from.getTime()) || isNaN(race.getTime())) return 0;
  return Math.round((race.getTime() - from.getTime()) / 86400000);
}

/**
 * Fase op een wíllekeurige kalenderdag (niet alleen vandaag). Nodig omdat een
 * 2-weeks blok over een fasegrens heen kan lopen: getCurrentPhase() kijkt alleen
 * naar vandaag en zou de hele periode onder één fase scharen.
 */
export function getPhaseForDate(dateISO: string, raceDate: string = FALLBACK_RACE_DATE): TrainingPhase {
  const days = daysUntilRaceOn(dateISO, raceDate);
  if (days < 0) return POST_RACE_PHASE;
  for (const phase of TRAINING_PHASES) {
    if (days > phase.minDays && days <= phase.maxDays) return phase;
  }
  return TRAINING_PHASES[TRAINING_PHASES.length - 1];
}

export interface PhaseTransition {
  date: string;       // eerste dag van de nieuwe fase
  from: TrainingPhase;
  to: TrainingPhase;
}

/** Fasegrenzen die binnen [startISO, endISO] vallen (beide inclusief). */
export function findPhaseTransitions(
  startISO: string,
  endISO: string,
  raceDate: string = FALLBACK_RACE_DATE,
): PhaseTransition[] {
  const transitions: PhaseTransition[] = [];
  const start = new Date(`${startISO.split('T')[0]}T00:00:00Z`);
  const end = new Date(`${endISO.split('T')[0]}T00:00:00Z`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return transitions;

  let prev = getPhaseForDate(startISO, raceDate);
  const cursor = new Date(start);
  cursor.setUTCDate(cursor.getUTCDate() + 1);
  while (cursor <= end) {
    const iso = cursor.toISOString().split('T')[0];
    const phase = getPhaseForDate(iso, raceDate);
    if (phase.id !== prev.id) {
      transitions.push({ date: iso, from: prev, to: phase });
      prev = phase;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return transitions;
}

export function getPhaseProgress(raceDate: string = FALLBACK_RACE_DATE): number {
  const days = getDaysUntilRace(raceDate);
  const phase = getCurrentPhase(raceDate);
  const totalDays = phase.maxDays - phase.minDays;
  const daysInPhase = phase.maxDays - days;
  if (totalDays <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round((daysInPhase / totalDays) * 100)));
}

export function getPhaseStatus(phase: TrainingPhase, raceDate: string = FALLBACK_RACE_DATE): 'done' | 'current' | 'future' {
  const days = getDaysUntilRace(raceDate);
  if (days <= phase.minDays) return 'done';
  if (days > phase.minDays && days <= phase.maxDays) return 'current';
  return 'future';
}

export function getPhaseDateRange(phase: TrainingPhase, raceDate: string = FALLBACK_RACE_DATE): { start: string; end: string } {
  const race = new Date(raceDate);
  race.setHours(0, 0, 0, 0);

  const startDate = new Date(race);
  startDate.setDate(race.getDate() - phase.maxDays);

  const endDate = new Date(race);
  endDate.setDate(race.getDate() - phase.minDays);

  const fmt = (d: Date) => d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  return { start: fmt(startDate), end: fmt(endDate) };
}
