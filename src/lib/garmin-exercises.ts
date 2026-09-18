/**
 * Oefeningcodes voor Garmin-krachtworkouts: "CATEGORIE/OEFENING", bijv. "PLANK/SIDE_PLANK".
 *
 * Dit bestandje is bewust klein en client-veilig. De volledige catalogus (711
 * geverifieerde oefeningen) staat in garmin-exercise-catalog.ts en wordt alleen
 * server-side gebruikt, zodat die ~20 KB niet in de browser-bundel belandt.
 *
 * Wat de client wel moet weten: welke CATEGORIEEN geldig zijn. Garmin wijst een
 * workout met een onbekende categorie namelijk in zijn geheel af (HTTP 400), terwijl
 * een onbekende oefeningnaam alleen stil wordt genegeerd. Deze lijst is dus het
 * vangnet dat voorkomt dat een verstuurde workout stukloopt.
 */

export const GARMIN_EXERCISE_CATEGORIES: readonly string[] = [
  'BANDED_EXERCISES',
  'BENCH_PRESS',
  'CALF_RAISE',
  'CARRY',
  'CHOP',
  'CORE',
  'CRUNCH',
  'CURL',
  'DEADLIFT',
  'FLYE',
  'HIP_RAISE',
  'HIP_STABILITY',
  'HYPEREXTENSION',
  'LATERAL_RAISE',
  'LEG_CURL',
  'LEG_RAISE',
  'LUNGE',
  'PLANK',
  'PLYO',
  'PULL_UP',
  'PUSH_UP',
  'ROW',
  'SHOULDER_PRESS',
  'SHOULDER_STABILITY',
  'SHRUG',
  'SIT_UP',
  'SQUAT',
  'TOTAL_BODY',
  'TRICEPS_EXTENSION',
  'WARM_UP',
];

export interface GarminExerciseRef {
  category: string;
  exerciseName: string;
}

/**
 * Leest een code als "PLANK/SIDE_PLANK". Geeft null bij een lege, kapotte of
 * onbekende categorie — dan sturen we de stap zonder oefeningcode (werkt altijd,
 * je ziet dan alleen de naam in de omschrijving).
 */
export function parseExerciseCode(code: string | undefined | null): GarminExerciseRef | null {
  if (!code) return null;
  const [category, exerciseName] = String(code).trim().toUpperCase().split('/');
  if (!category || !exerciseName) return null;
  if (!GARMIN_EXERCISE_CATEGORIES.includes(category)) return null;
  return { category, exerciseName };
}
