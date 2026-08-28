/**
 * Zet een geplande trainingssessie om in een gestructureerde Garmin-workout.
 *
 * Alleen HARDLOPEN en FIETSEN (incl. mountainbike) — zwemmen stuurt op tempo
 * i.p.v. hartslag en kracht heeft helemaal geen zonedoel, dus die twee gaan
 * (nog) niet naar Garmin.
 *
 * Intensiteitsdoel: we sturen Garmins EIGEN hartslagzones aan via `zoneNumber`,
 * niet losse bpm-grenzen. Empirisch getest tegen /workout-service/workout: dat
 * levert in Garmin Connect "Hartslagzone 4" op i.p.v. "136-153 bpm".
 * Warming-up en cooldown krijgen bewust GEEN doel — die loop je op gevoel.
 */
import { HeartRateZone, SessionSegment, Sport, TrainingSession } from './types';

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
const END_ITERATIONS = { conditionTypeId: 7, conditionTypeKey: 'iterations', displayOrder: 7 };

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

export interface ParsedInterval {
  reps: number;
  workMinutes: number;
  workZone: number;
  restMinutes: number | null;
  restZone: number | null;
}

/**
 * Herkent een intervalblok in de tekst van een segment, bijv.
 *   "4× 2 min Z4 / 2 min Z1 herstel"  → 4x (2min Z4 + 2min Z1)
 *   "6x 3min Z4, 2min Z1 dribbelen"   → 6x (3min Z4 + 2min Z1)
 *   "5× 4 min Z5"                     → 5x 4min Z5, zonder herstelstap
 * Zonder herkenbaar patroon: null (dan wordt het één doorlopend blok).
 */
export function parseIntervalBlock(text: string): ParsedInterval | null {
  if (!text) return null;
  const re =
    /(\d{1,2})\s*[x×]\s*(\d{1,3})\s*(?:min|minuten|')\s*(?:in\s+|@\s*)?(Z[1-5])(?:[^Z]{0,40}?(\d{1,3})\s*(?:min|minuten|')\s*(?:in\s+|@\s*)?(Z[1-5]))?/i;
  const m = re.exec(text);
  if (!m) return null;

  const reps = parseInt(m[1], 10);
  const workMinutes = parseInt(m[2], 10);
  const workZone = zoneNumberFor(m[3]);
  if (!reps || reps < 2 || !workMinutes || !workZone) return null;

  const restMinutes = m[4] ? parseInt(m[4], 10) : null;
  const restZone = m[5] ? zoneNumberFor(m[5]) : null;
  // Een "herstel" die zwaarder is dan het werkblok is geen herstel — dan
  // hebben we waarschijnlijk twee losse werkblokken te pakken. Laat 'm vallen.
  if (restMinutes && restZone && restZone >= workZone) {
    return { reps, workMinutes, workZone, restMinutes: null, restZone: null };
  }
  return { reps, workMinutes, workZone, restMinutes, restZone };
}

// ─── Payload-opbouw ──────────────────────────────────────────────────────────

interface StepDTO {
  type: string;
  stepId: null;
  stepOrder: number;
  stepType: { stepTypeId: number; stepTypeKey: string; displayOrder: number };
  childStepId: number | null;
  description?: string | null;
  endCondition: typeof END_TIME | typeof END_ITERATIONS;
  endConditionValue: number;
  preferredEndConditionUnit: null;
  endConditionCompare: null;
  endConditionZone: null;
  targetType?: typeof TARGET_NONE | typeof TARGET_HR_ZONE;
  targetValueOne: null;
  targetValueTwo: null;
  zoneNumber: number | null;
  numberOfIterations?: number;
  smartRepeat?: boolean;
  workoutSteps?: StepDTO[];
}

function executableStep(
  stepOrder: number,
  stepTypeKey: keyof typeof STEP_TYPES,
  minutes: number,
  zoneNumber: number | null,
  description: string | null,
  childStepId: number | null = null
): StepDTO {
  return {
    type: 'ExecutableStepDTO',
    stepId: null,
    stepOrder,
    stepType: STEP_TYPES[stepTypeKey],
    childStepId,
    description,
    endCondition: END_TIME,
    endConditionValue: Math.round(minutes * 60),
    preferredEndConditionUnit: null,
    endConditionCompare: null,
    endConditionZone: null,
    targetType: zoneNumber ? TARGET_HR_ZONE : TARGET_NONE,
    targetValueOne: null,
    targetValueTwo: null,
    zoneNumber: zoneNumber ?? null,
  };
}

/** Kort houden: Garmin toont de omschrijving op een klein scherm. */
function trimDescription(...parts: (string | undefined | null)[]): string | null {
  const text = parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  if (!text) return null;
  return text.length > 220 ? `${text.slice(0, 217)}...` : text;
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
  let order = 1;
  let childStepId = 1;

  const usable = (segments ?? []).filter((s) => (s.minutes ?? 0) > 0);

  if (usable.length === 0) {
    // Terugval: één blok van de volle duur in de hoofdzone.
    const minutes = session.durationMinutes ?? 45;
    const zone = zoneNumberFor(session.zone);
    steps.push(executableStep(order++, 'interval', minutes, zone, trimDescription(session.description)));
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
        summary.push(`${seg.label || (isWarmup ? 'Warming-up' : 'Cooldown')} — ${seg.minutes} min`);
        continue;
      }

      const interval = parseIntervalBlock(`${seg.label ?? ''} ${seg.detail ?? ''}`);
      if (interval) {
        const children: StepDTO[] = [
          executableStep(
            order++,
            'interval',
            interval.workMinutes,
            interval.workZone,
            trimDescription(seg.detail, seg.technique),
            childStepId
          ),
        ];
        if (interval.restMinutes) {
          children.push(
            executableStep(order++, 'recovery', interval.restMinutes, interval.restZone, 'Actief herstel', childStepId)
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
        summary.push(
          `${interval.reps}× ${interval.workMinutes} min Hartslagzone ${interval.workZone}` +
            (interval.restMinutes ? ` / ${interval.restMinutes} min herstel` : '')
        );
        continue;
      }

      const zone = zoneNumberFor(seg.zone) ?? zoneNumberFor(session.zone);
      steps.push(
        executableStep(order++, 'interval', seg.minutes, zone, trimDescription(seg.detail, seg.technique))
      );
      summary.push(`${seg.label || 'Blok'} — ${seg.minutes} min${zone ? ` · Hartslagzone ${zone}` : ''}`);
    }
  }

  if (steps.length === 0) return null;

  const totalSeconds = steps.reduce((sum, step) => {
    if (step.type === 'RepeatGroupDTO') {
      const inner = (step.workoutSteps ?? []).reduce((s, c) => s + c.endConditionValue, 0);
      return sum + inner * (step.numberOfIterations ?? 1);
    }
    return sum + step.endConditionValue;
  }, 0);

  return {
    payload: {
      sportType,
      subSportType: null,
      workoutName: (options.name || session.description || 'Training').slice(0, 80),
      description: trimDescription(session.type, '—', session.description) ?? undefined,
      estimatedDurationInSecs: totalSeconds,
      workoutSegments: [{ segmentOrder: 1, sportType, workoutSteps: steps }],
    },
    totalSeconds,
    stepCount: steps.length,
    summary,
  };
}
