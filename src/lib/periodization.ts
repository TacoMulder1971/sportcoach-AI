// Periodisering voor 1/4 triatlon — 13 juni 2026
const RACE_DATE = '2026-06-13';

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

export function getDaysUntilRace(): number {
  const race = new Date(RACE_DATE);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  race.setHours(0, 0, 0, 0);
  return Math.ceil((race.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function getCurrentPhase(): TrainingPhase {
  const days = getDaysUntilRace();
  // Vind de fase waar dagen tot race in valt
  for (const phase of TRAINING_PHASES) {
    if (days > phase.minDays && days <= phase.maxDays) {
      return phase;
    }
  }
  // Na de wedstrijd of exact op wedstrijddag
  return TRAINING_PHASES[TRAINING_PHASES.length - 1];
}

export function getPhaseProgress(): number {
  const days = getDaysUntilRace();
  const phase = getCurrentPhase();
  const totalDays = phase.maxDays - phase.minDays;
  const daysInPhase = phase.maxDays - days;
  if (totalDays <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round((daysInPhase / totalDays) * 100)));
}

export function getPhaseStatus(phase: TrainingPhase): 'done' | 'current' | 'future' {
  const days = getDaysUntilRace();
  if (days <= phase.minDays) return 'done';
  if (days > phase.minDays && days <= phase.maxDays) return 'current';
  return 'future';
}

export function getPhaseDateRange(phase: TrainingPhase): { start: string; end: string } {
  const race = new Date(RACE_DATE);
  race.setHours(0, 0, 0, 0);

  const startDate = new Date(race);
  startDate.setDate(race.getDate() - phase.maxDays);

  const endDate = new Date(race);
  endDate.setDate(race.getDate() - phase.minDays);

  const fmt = (d: Date) => d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  return { start: fmt(startDate), end: fmt(endDate) };
}
