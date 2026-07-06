import { UserProfile, TrainingSport, ALL_TRAINING_SPORTS, AthleteLevel } from './types';

/**
 * Atleet-profiel zoals de client het naar de AI-routes stuurt (subset van
 * UserProfile). Pure module: geen localStorage, bruikbaar op server én client.
 */
export interface AthleteProfilePayload {
  name?: string;
  birthYear?: number;
  sports?: TrainingSport[];
  level?: AthleteLevel;
  trainingDaysPerWeek?: number;
  strengthTraining?: boolean;
  coachNotes?: string;
}

const SPORT_LABELS: Record<TrainingSport, string> = {
  zwemmen: 'zwemmen',
  fietsen: 'fietsen',
  hardlopen: 'hardlopen',
  mountainbike: 'mountainbiken',
};

const LEVEL_LABELS: Record<AthleteLevel, string> = {
  beginner: 'beginner (bouw rustig op, extra aandacht voor herstel en blessurepreventie)',
  gevorderd: 'gevorderd (traint al langer gestructureerd)',
  ervaren: 'ervaren (kan hoge belasting en complexe sessies aan)',
};

/** Subset van het profiel die naar de AI-routes gaat. */
export function athleteProfilePayload(p: UserProfile): AthleteProfilePayload {
  return {
    name: p.name || undefined,
    birthYear: p.birthYear,
    sports: p.sports,
    level: p.level,
    trainingDaysPerWeek: p.trainingDaysPerWeek,
    strengthTraining: p.strengthTraining,
    coachNotes: p.coachNotes?.trim() || undefined,
  };
}

/** Sporten van de atleet; zonder profiel → alle (legacy/triatlon-gedrag). */
export function resolveSports(p?: AthleteProfilePayload | null): TrainingSport[] {
  const s = p?.sports?.filter((x) => ALL_TRAINING_SPORTS.includes(x)) ?? [];
  return s.length > 0 ? s : [...ALL_TRAINING_SPORTS];
}

/** Coach-persona op basis van de sporten, bv. "triatloncoach" of "hardloopcoach". */
export function coachPersona(p?: AthleteProfilePayload | null): string {
  const sports = resolveSports(p);
  const swim = sports.includes('zwemmen');
  const bike = sports.includes('fietsen') || sports.includes('mountainbike');
  const run = sports.includes('hardlopen');
  if (swim && bike && run) return 'triatloncoach';
  if (run && !swim && !bike) return 'hardloopcoach';
  if (bike && !swim && !run) return 'wielrencoach';
  if (swim && !bike && !run) return 'zwemcoach';
  if (run && bike) return 'duursportcoach (hardlopen en fietsen)';
  return 'duursportcoach';
}

/** Doet de atleet aan meerdere duursporten (relevant voor brick-sessies e.d.)? */
export function isMultiSportAthlete(p?: AthleteProfilePayload | null): boolean {
  const sports = resolveSports(p);
  const groups = new Set(sports.map((s) => (s === 'mountainbike' ? 'fietsen' : s)));
  return groups.size >= 2;
}

/** Leeftijd uit geboortejaar (of undefined). */
export function athleteAge(p?: AthleteProfilePayload | null): number | undefined {
  if (!p?.birthYear || p.birthYear < 1920) return undefined;
  return new Date().getFullYear() - p.birthYear;
}

/**
 * Profiel-tekstblok voor AI-prompts. Leeg profiel → lege string
 * (routes vallen dan terug op het oude triatlon-gedrag).
 */
export function buildAthleteProfileText(p?: AthleteProfilePayload | null): string {
  if (!p) return '';
  const lines: string[] = [];
  if (p.name) lines.push(`- Naam: ${p.name}`);
  const age = athleteAge(p);
  if (age) lines.push(`- Leeftijd: ${age} jaar`);
  lines.push(`- Sporten: ${resolveSports(p).map((s) => SPORT_LABELS[s]).join(', ')}`);
  if (p.level) lines.push(`- Niveau: ${LEVEL_LABELS[p.level]}`);
  if (p.trainingDaysPerWeek) lines.push(`- Beschikbaar: ~${p.trainingDaysPerWeek} trainingsdagen per week`);
  if (p.coachNotes) lines.push(`- EIGEN WENSEN VAN DE ATLEET (respecteer deze altijd): "${p.coachNotes}"`);
  return `PROFIEL ATLEET:\n${lines.join('\n')}`;
}

/**
 * Harde sport-beperking voor schema-routes: alleen de gekozen sporten inplannen.
 */
export function buildSportConstraintText(p?: AthleteProfilePayload | null): string {
  const sports = resolveSports(p);
  if (sports.length === ALL_TRAINING_SPORTS.length) return '';
  return `TOEGESTANE SPORTEN: plan uitsluitend sessies in ${sports.map((s) => `"${s}"`).join(', ')} (plus "kracht" en "rust"). Plan NOOIT sessies in andere sporten — deze atleet doet die sporten niet.`;
}

/** Vereiste sporten per wedstrijd-doeltype (voor het filteren van de doeltype-kiezer). */
const GOAL_TYPE_SPORTS: Record<string, TrainingSport[][]> = {
  // buitenste array = "alle groepen nodig", binnenste = "één van deze volstaat"
  '5km': [['hardlopen']],
  '10km': [['hardlopen']],
  halve_marathon: [['hardlopen']],
  marathon: [['hardlopen']],
  kwart_triatlon: [['zwemmen'], ['fietsen', 'mountainbike'], ['hardlopen']],
  halve_triatlon: [['zwemmen'], ['fietsen', 'mountainbike'], ['hardlopen']],
  hele_triatlon: [['zwemmen'], ['fietsen', 'mountainbike'], ['hardlopen']],
  duatlon: [['hardlopen'], ['fietsen', 'mountainbike']],
  fietstocht: [['fietsen', 'mountainbike']],
  zwemtocht: [['zwemmen']],
  eigen: [],
};

/** Past dit doeltype bij de sporten van de atleet? Onbekende types blijven zichtbaar. */
export function goalTypeMatchesSports(goalType: string, sports: TrainingSport[]): boolean {
  const required = GOAL_TYPE_SPORTS[goalType];
  if (!required) return true;
  return required.every((group) => group.some((s) => sports.includes(s)));
}

/** Kracht-instructie voor de strategie-prompt (Opus). Core altijd; 40-min kracht opt-in. */
export function buildStrengthStrategyText(p?: AthleteProfilePayload | null): string {
  // Legacy (geen profiel) = volledige kracht, zoals voorheen.
  const full = p ? p.strengthTraining === true : true;
  if (full) {
    return `KRACHT (verplicht inplannen, elke week):
- 3× per week een korte CORE-workout van 7 minuten (sport "kracht", type "core") — plan deze op lichtere dagen of als tweede sessie naast een rustige duurtraining; nooit op een volledige rustdag.
- 2× per week een ondersteunende KRACHTtraining van ~40 minuten (sport "kracht", type "kracht") — combineer met een trainingsdag, bij voorkeur niet vlak vóór een zware sleutelsessie.
- Krachtsessies hebben GEEN hartslagzone. Verzwaar de week niet onnodig: kracht komt bovenop, niet in plaats van de duurtraining.`;
  }
  return `KRACHT (elke week):
- 3× per week een korte CORE-workout van 7 minuten (sport "kracht", type "core") — plan deze op lichtere dagen of als tweede sessie; nooit op een volledige rustdag.
- Plan GEEN aparte krachttraining van ~40 minuten: de atleet heeft daar niet voor gekozen.
- Core-sessies hebben GEEN hartslagzone.`;
}

/** Kracht-regel voor de JSON-formatteringsprompt (Haiku/Sonnet). */
export function buildStrengthFormatRule(p?: AthleteProfilePayload | null): string {
  const full = p ? p.strengthTraining === true : true;
  if (full) {
    return '- KRACHT: plan per week 3× core (sport:"kracht", type:"core", durationMinutes:7, GEEN zone) op lichtere dagen + 2× krachttraining (sport:"kracht", type:"kracht", durationMinutes:40, GEEN zone) op trainingsdagen. Kracht mag de tweede sessie van een dag zijn, maar nooit op een rustdag.';
  }
  return '- KRACHT: plan per week 3× core (sport:"kracht", type:"core", durationMinutes:7, GEEN zone) op lichtere dagen, nooit op een rustdag. Plan GEEN sessies van type "kracht" met ~40 minuten.';
}
