/**
 * Zet een geplande trainingssessie om in een gestructureerde Garmin-workout.
 *
 * Cardio (HARDLOPEN en FIETSEN, incl. mountainbike) stuurt op hartslagzones;
 * KRACHT gaat als aparte krachtworkout met sets/herhalingen naar Garmin (zie
 * buildGarminStrengthWorkout onderaan). Zwemmen gaat niet — dat stuurt op tempo
 * per 100m en dat kent de workout-service niet als doel.
 *
 * Intensiteitsdoel: we sturen Garmins EIGEN hartslagzones aan via `zoneNumber`,
 * niet losse bpm-grenzen. Empirisch getest tegen /workout-service/workout: dat
 * levert in Garmin Connect "Hartslagzone 4" op i.p.v. "136-153 bpm".
 * Warming-up en cooldown krijgen bewust GEEN doel — die loop je op gevoel.
 */
import { HeartRateZone, SessionSegment, Sport, TrainingSession } from './types';
import type { StrengthBlock, StrengthWorkout } from './strength';
import { parseExerciseCode } from './garmin-exercises';

// ─── Garmin DTO-constanten ───────────────────────────────────────────────────

const SPORT_TYPES = {
  running: { sportTypeId: 1, sportTypeKey: 'running', displayOrder: 1 },
  cycling: { sportTypeId: 2, sportTypeKey: 'cycling', displayOrder: 2 },
} as const;

const STEP_TYPES = {
  warmup: { stepTypeId: 1, stepTypeKey: 'warmup', displayOrder: 1 },
  cooldown: { stepTypeId: 2, stepTypeKey: 'cooldown', displayOrder: 2 },
  interval: { stepTypeId: 3, stepTypeKey: 'interval', displayOrder: 3 },
  recovery: { stepTypeId: 4, stepTypeKey: 'recovery', displayOrder: 4 },
  repeat: { stepTypeId: 6, stepTypeKey: 'repeat', displayOrder: 6 },
} as const;

const END_TIME = { conditionTypeId: 2, conditionTypeKey: 'time', displayOrder: 2 };
const END_DISTANCE = { conditionTypeId: 3, conditionTypeKey: 'distance', displayOrder: 3 };
const END_ITERATIONS = { conditionTypeId: 7, conditionTypeKey: 'iterations', displayOrder: 7 };

/** Afstandseenheid bij een distance-stap; endConditionValue blijft altijd in meters. */
const UNIT_KILOMETER = { unitId: 2, unitKey: 'kilometer', factor: 100000 };
const UNIT_METER = { unitId: 1, unitKey: 'meter', factor: 100 };

const TARGET_NONE = { workoutTargetTypeId: 1, workoutTargetTypeKey: 'no.target', displayOrder: 1 };
const TARGET_HR_ZONE = { workoutTargetTypeId: 4, workoutTargetTypeKey: 'heart.rate.zone', displayOrder: 4 };

export type GarminSportKey = keyof typeof SPORT_TYPES;

// ─── Sport- en zone-vertaling ────────────────────────────────────────────────

/** Welke sporten kunnen naar Garmin? null = niet ondersteund. */
export function garminSportFor(sport: Sport): GarminSportKey | null {
  if (sport === 'hardlopen') return 'running';
  if (sport === 'fietsen' || sport === 'mountainbike') return 'cycling';
  return null;
}

export function canSendToGarmin(session: TrainingSession): boolean {
  return garminSportFor(session.sport) !== null;
}

/** "Z4" → 4. Alles daarbuiten → null (dan sturen we geen doel mee). */
export function zoneNumberFor(zone?: HeartRateZone | string | null): number | null {
  if (!zone) return null;
  const m = /^Z([1-5])$/i.exec(String(zone).trim());
  return m ? parseInt(m[1], 10) : null;
}

// ─── Intervalherkenning ──────────────────────────────────────────────────────

/**
 * Eén stapmaat: op tijd óf op afstand. Garmin kent beide als eindvoorwaarde, en
 * een intervalblok is vaak in afstand geschreven ("3× 3 km Z4") — dat willen we
 * niet platslaan tot één lang blok.
 */
export type StepMeasure = { kind: 'time'; seconds: number } | { kind: 'distance'; meters: number };

export interface ParsedInterval {
  reps: number;
  work: StepMeasure;
  workZone: number;
  rest: StepMeasure | null;
  restZone: number | null;
}

const UNIT_PATTERN = "(?:kilometer|km|minuten|minuut|min|meter|m|')";
const AMOUNT_PATTERN = '(\\d{1,5}(?:[.,]\\d{1,2})?)';
/** Wat er tussen de maat en de zone kan staan: "3 km op Z4", "2 min in Z1". */
const ZONE_LEAD = '(?:in\\s+|op\\s+|naar\\s+|@\\s*)?';

/** "3" + "km" → 3000 m; "2" + "min" → 120 s. Onzinnige waarden → null. */
export function parseMeasure(amount: string, unit: string): StepMeasure | null {
  const value = parseFloat(amount.replace(',', '.'));
  if (!isFinite(value) || value <= 0) return null;
  const u = unit.toLowerCase();
  if (u === 'km' || u === 'kilometer' || u === 'm' || u === 'meter') {
    const meters = Math.round(u.startsWith('k') ? value * 1000 : value);
    return meters >= 100 && meters <= 60000 ? { kind: 'distance', meters } : null;
  }
  const seconds = Math.round(value * 60);
  return seconds >= 30 && seconds <= 10800 ? { kind: 'time', seconds } : null;
}

/** "3 km", "800 m", "4 min" — voor de naam en de samenvatting in de UI. */
export function describeMeasure(m: StepMeasure): string {
  if (m.kind === 'time') {
    return m.seconds % 60 === 0 ? `${m.seconds / 60} min` : `${m.seconds} sec`;
  }
  if (m.meters < 1000) return `${m.meters} m`;
  const km = m.meters / 1000;
  return `${(Number.isInteger(km) ? String(km) : km.toFixed(1)).replace('.', ',')} km`;
}

/**
 * Herkent een intervalblok in de tekst van een segment, bijv.
 *   "4× 2 min Z4 / 2 min Z1 herstel"        → 4x (2min Z4 + 2min Z1)
 *   "3× 3 km op Z4 ... 3 min herstel op Z1" → 3x (3km Z4 + 3min Z1)
 *   "6x 800 m Z5, 400 m Z1 dribbelen"       → 6x (800m Z5 + 400m Z1)
 *   "5× 4 min Z5"                           → 5x 4min Z5, zonder herstelstap
 * Werk en herstel mogen elk hun eigen maat hebben (afstand of tijd).
 * Zonder herkenbaar patroon: null (dan wordt het één doorlopend blok).
 */
export function parseIntervalBlock(text: string): ParsedInterval | null {
  if (!text) return null;
  const workRe = new RegExp(
    `(\\d{1,2})\\s*[x×]\\s*${AMOUNT_PATTERN}\\s*(${UNIT_PATTERN})(?![a-z])\\s*(?:\\([^)]*\\))?\\s*${ZONE_LEAD}(Z[1-5])`,
    'i'
  );
  const m = workRe.exec(text);
  if (!m) return null;

  const reps = parseInt(m[1], 10);
  const work = parseMeasure(m[2], m[3]);
  const workZone = zoneNumberFor(m[4]);
  if (!reps || reps < 2 || reps > 30 || !work || !workZone) return null;

  // Herstel: de eerstvolgende maat-met-zone ná het werkblok die LICHTER is. Een
  // even zware of zwaardere zone is geen herstel maar een tweede werkblok — dan
  // laten we het herstel weg in plaats van er iets verkeerds van te maken.
  const tail = text.slice(m.index + m[0].length, m.index + m[0].length + 240);
  const restRe = new RegExp(
    `${AMOUNT_PATTERN}\\s*(${UNIT_PATTERN})(?![a-z])[^.;]{0,40}?${ZONE_LEAD}(Z[1-5])`,
    'gi'
  );
  let match: RegExpExecArray | null;
  while ((match = restRe.exec(tail)) !== null) {
    const zone = zoneNumberFor(match[3]);
    const measure = parseMeasure(match[1], match[2]);
    if (!zone || !measure || zone >= workZone) continue;
    return { reps, work, workZone, rest: measure, restZone: zone };
  }

  // Herstel zonder zone ("90 sec herstel", "2 min pauze") — de stap krijgt dan
  // geen hartslagdoel, maar de herhaling klopt wel.
  const plainRest = new RegExp(
    `${AMOUNT_PATTERN}\\s*(${UNIT_PATTERN}|sec|seconden|s)(?![a-z])[^.;]{0,20}?(?:herstel|rust|pauze|dribbel|wandel)`,
    'i'
  ).exec(tail);
  if (plainRest) {
    const unit = plainRest[2].toLowerCase();
    const measure = /^s(?:ec|econden)?$/.test(unit)
      ? { kind: 'time' as const, seconds: Math.round(parseFloat(plainRest[1].replace(',', '.'))) }
      : parseMeasure(plainRest[1], unit);
    if (measure && (measure.kind === 'distance' || (measure.seconds >= 20 && measure.seconds <= 1800))) {
      return { reps, work, workZone, rest: measure, restZone: null };
    }
  }

  return { reps, work, workZone, rest: null, restZone: null };
}

// ─── Payload-opbouw ──────────────────────────────────────────────────────────

interface StepDTO {
  type: string;
  stepId: null;
  stepOrder: number;
  stepType: { stepTypeId: number; stepTypeKey: string; displayOrder: number };
  childStepId: number | null;
  description?: string | null;
  endCondition: typeof END_TIME | typeof END_DISTANCE | typeof END_ITERATIONS | typeof END_REPS;
  /** Seconden bij een tijd-stap, meters bij een afstand-stap, reps bij kracht. */
  endConditionValue: number;
  preferredEndConditionUnit: typeof UNIT_KILOMETER | typeof UNIT_METER | null;
  endConditionCompare: null;
  endConditionZone: null;
  targetType?: typeof TARGET_NONE | typeof TARGET_HR_ZONE;
  targetValueOne: null;
  targetValueTwo: null;
  zoneNumber: number | null;
  numberOfIterations?: number;
  smartRepeat?: boolean;
  workoutSteps?: StepDTO[];
  /** Alleen bij kracht: Garmins eigen oefening (categorie + naam). */
  category?: string | null;
  exerciseName?: string | null;
  weightValue?: number | null;
  weightUnit?: string | null;
}

function measuredStep(
  stepOrder: number,
  stepTypeKey: keyof typeof STEP_TYPES,
  measure: StepMeasure,
  zoneNumber: number | null,
  description: string | null,
  childStepId: number | null = null
): StepDTO {
  const onDistance = measure.kind === 'distance';
  return {
    type: 'ExecutableStepDTO',
    stepId: null,
    stepOrder,
    stepType: STEP_TYPES[stepTypeKey],
    childStepId,
    description,
    endCondition: onDistance ? END_DISTANCE : END_TIME,
    endConditionValue: onDistance ? measure.meters : measure.seconds,
    // Garmin rekent altijd in meters; de eenheid bepaalt alleen hoe hij het toont.
    preferredEndConditionUnit: onDistance
      ? measure.meters % 1000 === 0
        ? UNIT_KILOMETER
        : UNIT_METER
      : null,
    endConditionCompare: null,
    endConditionZone: null,
    targetType: zoneNumber ? TARGET_HR_ZONE : TARGET_NONE,
    targetValueOne: null,
    targetValueTwo: null,
    zoneNumber: zoneNumber ?? null,
  };
}

function executableStep(
  stepOrder: number,
  stepTypeKey: keyof typeof STEP_TYPES,
  minutes: number,
  zoneNumber: number | null,
  description: string | null,
  childStepId: number | null = null
): StepDTO {
  return measuredStep(
    stepOrder,
    stepTypeKey,
    { kind: 'time', seconds: Math.round(minutes * 60) },
    zoneNumber,
    description,
    childStepId
  );
}

/** Kort houden: Garmin toont de omschrijving op een klein scherm. */
function trimDescription(...parts: (string | undefined | null)[]): string | null {
  const text = parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.length > 220 ? `${text.slice(0, 217)}...` : text;
}

/**
 * Korte, herkenbare naam in de stijl die de gebruiker zelf hanteert in Garmin
 * ("Interval 4x2min Z4", "Duurloop 55min Z2") — niet de volledige omschrijving
 * uit het schema, want die is op een horloge onleesbaar lang.
 *
 * De structuur komt uit een herkende herhaling ("4×2min Z4"), of anders uit
 * gelijke hoofdblokken ("2×12min Z4"), of anders uit de totale duur.
 */
export function buildWorkoutName(
  session: TrainingSession,
  structure: string | null,
  totalMinutes: number
): string {
  const rawType = (session.type || '').trim();
  const label = rawType ? rawType.charAt(0).toUpperCase() + rawType.slice(1) : 'Training';
  const zone = zoneNumberFor(session.zone);
  const tail = structure ?? `${totalMinutes}min${zone ? ` Z${zone}` : ''}`;
  return `${label} ${tail}`.replace(/\s+/g, ' ').trim().slice(0, 40);
}

export interface BuiltWorkout {
  payload: Record<string, unknown>;
  totalSeconds: number;
  stepCount: number;
  /** Korte, leesbare samenvatting voor de bevestiging in de UI. */
  summary: string[];
}

/**
 * Bouwt de workout uit de sessie + (optioneel) de AI-breakdown van die sessie.
 * Zonder breakdown valt hij terug op één doorlopend blok in de hoofdzone —
 * altijd beter dan niets, en precies wat het schema zelf zegt.
 */
export function buildGarminWorkout(
  session: TrainingSession,
  segments: SessionSegment[] | null,
  options: { name?: string; skipWarmup?: boolean } = {}
): BuiltWorkout | null {
  const sportKey = garminSportFor(session.sport);
  if (!sportKey) return null;
  const sportType = SPORT_TYPES[sportKey];

  const steps: StepDTO[] = [];
  const summary: string[] = [];
  // Voor de naamgeving: de herkende herhaling, of anders de gelijke hoofdblokken.
  let structure: string | null = null;
  const mainBlocks: { minutes: number; zone: number | null }[] = [];
  let order = 1;
  let childStepId = 1;
  // Geschatte duur: een afstand-stap heeft geen seconden, dus daar vallen we
  // terug op de geplande minuten van het segment (die het herstel meetellen).
  let estimatedSeconds = 0;

  const usable = (segments ?? []).filter((s) => (s.minutes ?? 0) > 0);

  if (usable.length === 0) {
    // Terugval: één blok van de volle duur in de hoofdzone.
    const minutes = session.durationMinutes ?? 45;
    const zone = zoneNumberFor(session.zone);
    steps.push(executableStep(order++, 'interval', minutes, zone, trimDescription(session.description)));
    estimatedSeconds += Math.round(minutes * 60);
    summary.push(`${minutes} min${zone ? ` · Hartslagzone ${zone}` : ''}`);
  } else {
    for (const seg of usable) {
      const isWarmup = seg.kind === 'warmup';
      const isCooldown = seg.kind === 'cooldown';
      if (isWarmup && options.skipWarmup) continue;

      // Warming-up en cooldown: alleen tijd, geen zonedoel (voorkeur gebruiker).
      if (isWarmup || isCooldown) {
        steps.push(
          executableStep(
            order++,
            isWarmup ? 'warmup' : 'cooldown',
            seg.minutes,
            null,
            trimDescription(seg.detail, seg.technique)
          )
        );
        estimatedSeconds += Math.round(seg.minutes * 60);
        summary.push(`${seg.label || (isWarmup ? 'Warming-up' : 'Cooldown')} — ${seg.minutes} min`);
        continue;
      }

      const interval = parseIntervalBlock(`${seg.label ?? ''} ${seg.detail ?? ''}`);
      if (interval) {
        const children: StepDTO[] = [
          measuredStep(
            order++,
            'interval',
            interval.work,
            interval.workZone,
            trimDescription(seg.detail, seg.technique),
            childStepId
          ),
        ];
        if (interval.rest) {
          children.push(
            measuredStep(order++, 'recovery', interval.rest, interval.restZone, 'Actief herstel', childStepId)
          );
        }
        steps.push({
          type: 'RepeatGroupDTO',
          stepId: null,
          stepOrder: order++,
          stepType: STEP_TYPES.repeat,
          childStepId,
          endCondition: END_ITERATIONS,
          endConditionValue: interval.reps,
          preferredEndConditionUnit: null,
          endConditionCompare: null,
          endConditionZone: null,
          numberOfIterations: interval.reps,
          smartRepeat: false,
          targetValueOne: null,
          targetValueTwo: null,
          zoneNumber: null,
          workoutSteps: children,
        });
        childStepId += 1;
        estimatedSeconds +=
          interval.work.kind === 'time' && (!interval.rest || interval.rest.kind === 'time')
            ? interval.reps * (interval.work.seconds + (interval.rest?.seconds ?? 0))
            : Math.round(seg.minutes * 60);
        structure ??= `${interval.reps}×${describeMeasure(interval.work).replace(' ', '')} Z${interval.workZone}`;
        summary.push(
          `${interval.reps}× ${describeMeasure(interval.work)} Hartslagzone ${interval.workZone}` +
            (interval.rest ? ` / ${describeMeasure(interval.rest)} herstel` : '')
        );
        continue;
      }

      const zone = zoneNumberFor(seg.zone) ?? zoneNumberFor(session.zone);
      mainBlocks.push({ minutes: seg.minutes, zone });
      steps.push(
        executableStep(order++, 'interval', seg.minutes, zone, trimDescription(seg.detail, seg.technique))
      );
      estimatedSeconds += Math.round(seg.minutes * 60);
      summary.push(`${seg.label || 'Blok'} — ${seg.minutes} min${zone ? ` · Hartslagzone ${zone}` : ''}`);
    }
  }

  if (steps.length === 0) return null;

  // Twee of meer identieke hoofdblokken lezen als een herhaling: "2×12min Z4".
  // (De AI-breakdown splitst zulke blokken vaak in "Drempelblok 1" en "2".)
  if (!structure && mainBlocks.length >= 2) {
    const [first] = mainBlocks;
    const identical = mainBlocks.filter((b) => b.minutes === first.minutes && b.zone === first.zone);
    if (identical.length >= 2) {
      structure = `${identical.length}×${first.minutes}min${first.zone ? ` Z${first.zone}` : ''}`;
    }
  }

  const totalSeconds = estimatedSeconds;

  return {
    payload: {
      sportType,
      subSportType: null,
      workoutName:
        options.name?.slice(0, 40) ||
        buildWorkoutName(session, structure, Math.round(totalSeconds / 60)),
      description: trimDescription(session.type, '—', session.description) ?? undefined,
      estimatedDurationInSecs: totalSeconds,
      workoutSegments: [{ segmentOrder: 1, sportType, workoutSteps: steps }],
    },
    totalSeconds,
    stepCount: steps.length,
    summary,
  };
}

// ─── Krachtworkouts ──────────────────────────────────────────────────────────
//
// Kracht gaat anders naar Garmin dan hardlopen/fietsen: geen hartslagzones maar
// sets, herhalingen en tijd. De opbouw hieronder is 1-op-1 het recept dat
// empirisch werkt tegen /workout-service/workout (zie scripts/create_tri_strength_workout.py):
//
//  - sportType strength_training (id 5)
//  - een oefening met meerdere sets wordt een RepeatGroupDTO (1 ronde = alle
//    oefeningen van het blok achter elkaar), zodat je op je horloge per set
//    doorstapt; supersets zijn dus simpelweg één groep met beide oefeningen erin
//  - category/exerciseName laten we bewust leeg: de Garmin-oefencatalogus-
//    sleutels verschillen per toestel en een foute sleutel laat de API de hele
//    workout weigeren. Zonder sleutel wordt het een generieke stap met de naam
//    in de omschrijving — werkt altijd en leest prima op het horloge.

const SPORT_STRENGTH = { sportTypeId: 5, sportTypeKey: 'strength_training', displayOrder: 5 } as const;
const STEP_REST = { stepTypeId: 5, stepTypeKey: 'rest', displayOrder: 5 } as const;
const END_REPS = { conditionTypeId: 10, conditionTypeKey: 'reps', displayOrder: 10 };

/** Rust (sec) als het blok er zelf niets over zegt. */
const REST_BETWEEN_EXERCISES = 30;
const REST_AFTER_ROUND = 75;
const REST_CIRCUIT = 10;
/** Grove schatting voor de duur van één herhaling — alleen voor estimatedDuration. */
const SECONDS_PER_REP = 3;

export interface ParsedPrescription {
  /** 'time' = op tijd (planks, stretchen), 'reps' = op herhalingen. */
  kind: 'time' | 'reps';
  /** Aantal sets; 1 als er geen "3×" voor staat. */
  sets: number;
  /** Seconden per set (kind 'time') of herhalingen per set (kind 'reps'). */
  value: number;
  /** "per been" / "per zijde" — telt als dubbel werk. */
  perSide: boolean;
}

/**
 * Leest een voorschrift uit de oefenlijst: "40 sec", "4 min", "3×12",
 * "2×10 per been", "1×20", "15". Geeft null als er niets bruikbaars in staat.
 */
export function parsePrescription(text: string): ParsedPrescription | null {
  if (!text) return null;
  const raw = text.toLowerCase().replace(',', '.').trim();
  const perSide = /per\s+(been|zijde|kant|arm)/.test(raw);

  // "3×12", "2 x 10 per been" — sets × herhalingen
  const sets = /(\d{1,2})\s*[x×]\s*(\d{1,3})/.exec(raw);
  if (sets) {
    const count = parseInt(sets[1], 10);
    const reps = parseInt(sets[2], 10);
    if (count > 0 && reps > 0) return { kind: 'reps', sets: count, value: reps, perSide };
  }

  // "4 min", "1.5 minuten"
  const min = /(\d{1,3}(?:\.\d)?)\s*(?:min|minuten)\b/.exec(raw);
  if (min) {
    const seconds = Math.round(parseFloat(min[1]) * 60);
    if (seconds > 0) return { kind: 'time', sets: 1, value: seconds, perSide };
  }

  // "40 sec", "30 seconden", "45s"
  const sec = /(\d{1,3})\s*(?:sec|seconden|s)\b/.exec(raw);
  if (sec) {
    const seconds = parseInt(sec[1], 10);
    if (seconds > 0) return { kind: 'time', sets: 1, value: seconds, perSide };
  }

  // Kaal getal: "15" → 15 herhalingen
  const bare = /^(\d{1,3})$/.exec(raw);
  if (bare) {
    const reps = parseInt(bare[1], 10);
    if (reps > 0) return { kind: 'reps', sets: 1, value: reps, perSide };
  }

  return null;
}

/**
 * Rust uit de tekst van het blok ("60–90 sec rust", "10 sec rust tussen ...").
 * Kijkt naar label én notitie: de rust staat soms in de een, soms in de ander.
 */
function restFromBlock(block: StrengthBlock, fallback: number): number {
  const text = `${block.label ?? ''} ${block.note ?? ''}`.toLowerCase();
  if (!/rust/.test(text)) return fallback;
  const m = /(\d{1,3})\s*(?:[-–]\s*\d{1,3}\s*)?(?:sec|seconden|s)\b/.exec(text);
  return m ? parseInt(m[1], 10) : fallback;
}

function blockStepType(block: StrengthBlock): 'warmup' | 'cooldown' | 'interval' {
  const label = (block.label || '').toLowerCase();
  if (/warming|warm-?up/.test(label)) return 'warmup';
  if (/cooldown|cooling|stretch/.test(label)) return 'cooldown';
  return 'interval';
}

/** Hoeveel rondes doet dit blok? = de hoogste set-telling van zijn oefeningen. */
function roundsForBlock(block: StrengthBlock): number {
  return block.exercises.reduce((max, ex) => {
    const p = parsePrescription(ex.prescription);
    return p && p.sets > max ? p.sets : max;
  }, 1);
}

/**
 * Omschrijving van een oefening op het horloge. Het voorschrift ("3×12") laten
 * we weg zodra de stap het zelf al uitdrukt — behalve bij "per been/zijde", want
 * dat kan Garmin niet tonen, en als we het niet konden lezen.
 */
function exerciseDescription(
  name: string,
  prescription: string | undefined,
  note: string | undefined,
  parsed: ParsedPrescription | null
): string | null {
  const keepPrescription = !parsed || parsed.perSide;
  return trimDescription(name, keepPrescription && prescription ? `— ${prescription}` : null, note);
}

function strengthStep(
  stepOrder: number,
  stepType: { stepTypeId: number; stepTypeKey: string; displayOrder: number },
  prescription: ParsedPrescription | null,
  fallbackSeconds: number,
  description: string | null,
  childStepId: number | null,
  exerciseCode?: string
): StepDTO {
  const onReps = prescription?.kind === 'reps';
  const endValue = onReps ? prescription.value : prescription?.value ?? fallbackSeconds;
  // Met een geldige code toont het horloge de échte oefening (animatie + reps-telling).
  // Zonder code — of met een onbekende categorie — sturen we hem weg: Garmin wijst
  // anders de hele workout af. Zie garmin-exercises.ts.
  const exercise = parseExerciseCode(exerciseCode);
  return {
    type: 'ExecutableStepDTO',
    stepId: null,
    stepOrder,
    stepType,
    childStepId,
    description,
    endCondition: onReps ? END_REPS : END_TIME,
    endConditionValue: endValue,
    preferredEndConditionUnit: null,
    endConditionCompare: null,
    endConditionZone: null,
    targetType: TARGET_NONE,
    targetValueOne: null,
    targetValueTwo: null,
    zoneNumber: null,
    category: exercise?.category ?? null,
    exerciseName: exercise?.exerciseName ?? null,
    weightValue: null,
    weightUnit: null,
  };
}

/** Geschatte duur van één stap in seconden (voor estimatedDurationInSecs). */
function stepSeconds(p: ParsedPrescription | null, fallbackSeconds: number): number {
  if (!p) return fallbackSeconds;
  const one = p.kind === 'time' ? p.value : p.value * SECONDS_PER_REP;
  return p.perSide ? one * 2 : one;
}

/**
 * Zet een krachtworkout (core-circuit of krachtsessie) om in een Garmin-
 * krachtworkout. Blokken met meerdere sets worden een herhaal-groep; blokken
 * waarin elke oefening één keer voorkomt (warming-up, core-circuit, cooldown)
 * worden platte stappen met rust ertussen.
 */
export function buildGarminStrengthWorkout(
  workout: StrengthWorkout,
  options: { name?: string } = {}
): BuiltWorkout | null {
  const steps: StepDTO[] = [];
  const summary: string[] = [];
  let order = 1;
  let childStepId = 1;
  let totalSeconds = 0;

  for (const block of workout.blocks) {
    const exercises = block.exercises.filter((ex) => ex.name?.trim());
    if (exercises.length === 0) continue;

    const stepTypeKey = blockStepType(block);
    const stepType = STEP_TYPES[stepTypeKey];
    const rounds = roundsForBlock(block);
    const isCircuit = rounds === 1;
    // In een circuit zegt de blok-notitie iets over de rust tussen de oefeningen
    // ("10 sec rust tussen de oefeningen"); in een superset slaat die notitie
    // ("60-90 sec rust") juist op de rust NA een ronde — daartussen ga je door.
    const restWithin = isCircuit ? restFromBlock(block, REST_CIRCUIT) : REST_BETWEEN_EXERCISES;

    if (isCircuit) {
      // Platte stappen: warming-up, core-circuit, cooldown.
      exercises.forEach((ex, i) => {
        const p = parsePrescription(ex.prescription);
        steps.push(
          strengthStep(order++, stepType, p, 30, exerciseDescription(ex.name, ex.prescription, ex.note, p), null, ex.garminCode)
        );
        totalSeconds += stepSeconds(p, 30);
        // Rust tussen de oefeningen van een circuit (niet na de laatste, en niet
        // in warming-up/cooldown — die loop je aaneengesloten door).
        if (stepTypeKey === 'interval' && i < exercises.length - 1 && restWithin > 0) {
          steps.push(strengthStep(order++, STEP_REST, null, restWithin, 'Rust', null));
          totalSeconds += restWithin;
        }
      });
      summary.push(`${block.label} — ${exercises.length} oefeningen`);
      continue;
    }

    // Meerdere sets → herhaal-groep (superset: alle oefeningen in één ronde).
    const children: StepDTO[] = [];
    let roundSeconds = 0;
    exercises.forEach((ex, i) => {
      const p = parsePrescription(ex.prescription);
      children.push(
        strengthStep(order++, STEP_TYPES.interval, p, 30, exerciseDescription(ex.name, ex.prescription, ex.note, p), childStepId, ex.garminCode)
      );
      roundSeconds += stepSeconds(p, 30);
      const rest = i === exercises.length - 1 ? restFromBlock(block, REST_AFTER_ROUND) : restWithin;
      if (rest > 0) {
        children.push(strengthStep(order++, STEP_REST, null, rest, 'Rust', childStepId));
        roundSeconds += rest;
      }
    });

    steps.push({
      type: 'RepeatGroupDTO',
      stepId: null,
      stepOrder: order++,
      stepType: STEP_TYPES.repeat,
      childStepId,
      endCondition: END_ITERATIONS,
      endConditionValue: rounds,
      preferredEndConditionUnit: null,
      endConditionCompare: null,
      endConditionZone: null,
      numberOfIterations: rounds,
      smartRepeat: false,
      targetValueOne: null,
      targetValueTwo: null,
      zoneNumber: null,
      workoutSteps: children,
    });
    childStepId += 1;
    totalSeconds += roundSeconds * rounds;
    summary.push(`${block.label} — ${rounds}× ${exercises.length} oefeningen`);
  }

  if (steps.length === 0) return null;

  const estimated = Math.max(totalSeconds, (workout.totalMinutes || 0) * 60);

  return {
    payload: {
      sportType: SPORT_STRENGTH,
      subSportType: null,
      workoutName: (options.name || workout.title).slice(0, 40),
      description: trimDescription(workout.focus, workout.intro) ?? undefined,
      estimatedDurationInSecs: estimated,
      workoutSegments: [{ segmentOrder: 1, sportType: SPORT_STRENGTH, workoutSteps: steps }],
    },
    totalSeconds: estimated,
    stepCount: steps.length,
    summary,
  };
}
