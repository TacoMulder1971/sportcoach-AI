import { TrainingSession } from './types';

// ── Krachttraining-bibliotheek ──────────────────────────────────────
// Vaste, betrouwbare workouts voor kracht-sessies in het schema. Anders dan
// de cardio-sessies (AI-gegenereerde zone-segmenten via /api/session-breakdown)
// hebben krachtsessies geen hartslagzones maar een concrete oefenlijst met
// sets/reps of tijd. De Home-tab toont deze lijst onder "Training vandaag".
//
// Twee soorten, afgestemd op een triatleet:
//  - core   : 7-minuten core-circuit (3×/week op lichtere dagen)
//  - kracht : triatlon-ondersteunende functionele kracht (2×/week)

export interface StrengthExercise {
  name: string;
  prescription: string; // bijv. "40 sec", "3×12", "3×10 per been"
  note?: string;        // korte techniek-/uitvoeringstip
  /**
   * Garmins eigen oefeningcode ("CATEGORIE/OEFENING", bijv. "PLANK/SIDE_PLANK").
   * Hiermee toont het horloge de échte oefening i.p.v. alleen tekst. Zie
   * garmin-exercises.ts. Ontbreekt hij (bijv. bij een zelf ingetypte oefening),
   * dan gaat de stap zonder code mee — dat werkt ook, alleen zonder animatie.
   */
  garminCode?: string;
}

export interface StrengthBlock {
  label: string;        // "Warming-up", "Circuit — 3 rondes", "Cooldown"
  note?: string;        // bijv. rust tussen oefeningen
  exercises: StrengthExercise[];
}

export type StrengthWorkoutId = 'core7' | 'tri-strength';

export interface StrengthWorkout {
  id: StrengthWorkoutId;
  title: string;
  focus: string;
  totalMinutes: number;
  intro?: string;
  blocks: StrengthBlock[];
}

const CORE_7MIN: StrengthWorkout = {
  id: 'core7',
  title: '7-minuten core-workout',
  focus: 'Core & stabiliteit',
  totalMinutes: 7,
  intro: 'Eén ronde, oefeningen achter elkaar. ~30 sec werk, ~10 sec rust ertussen.',
  blocks: [
    {
      label: 'Circuit — 1 ronde',
      note: '10 sec rust tussen de oefeningen',
      exercises: [
        { name: 'Plank', prescription: '40 sec', note: 'Rechte lijn, billen aanspannen', garminCode: 'PLANK/PLANK' },
        { name: 'Mountain climbers', prescription: '30 sec', note: 'Heupen laag, tempo hoog', garminCode: 'PLANK/MOUNTAIN_CLIMBER' },
        { name: 'Dead bug', prescription: '30 sec', note: 'Onderrug tegen de grond', garminCode: 'HIP_STABILITY/DEAD_BUG' },
        { name: 'Side plank links', prescription: '30 sec', note: 'Heup hoog', garminCode: 'PLANK/SIDE_PLANK' },
        { name: 'Side plank rechts', prescription: '30 sec', note: 'Heup hoog', garminCode: 'PLANK/SIDE_PLANK' },
        { name: 'Bicycle crunches', prescription: '30 sec', note: 'Rustig, controle boven snelheid', garminCode: 'CRUNCH/BICYCLE_CRUNCH' },
        { name: 'Superman', prescription: '30 sec', note: 'Armen en benen optillen', garminCode: 'HYPEREXTENSION/SUPERMAN_FROM_FLOOR' },
        { name: 'Glute bridge — hold', prescription: '40 sec', note: 'Knijp de billen aan', garminCode: 'HIP_RAISE/HIP_RAISE' },
        { name: 'Bird dog', prescription: '30 sec', note: 'Wissel arm/been, geen heupdraai', garminCode: 'HIP_STABILITY/QUADRUPED_WITH_LEG_LIFT' },
        { name: 'Plank met schoudertik', prescription: '30 sec', note: 'Heupen stil — tik afwisselend de tegenoverliggende schouder aan', garminCode: 'PLANK/PLANK_WITH_ARM_RAISE' },
        { name: 'Leg raises', prescription: '30 sec', note: 'Onderrug blijft op de grond', garminCode: 'HIP_RAISE/LEG_LIFT' },
        { name: 'Russian twists', prescription: '30 sec', note: 'Romp draaien, niet alleen armen', garminCode: 'CORE/RUSSIAN_TWIST' },
        { name: 'Plank', prescription: '40 sec', note: 'Afmaken — kern strak houden', garminCode: 'PLANK/PLANK' },
      ],
    },
  ],
};

const TRI_STRENGTH: StrengthWorkout = {
  id: 'tri-strength',
  title: 'Triatlon-kracht',
  focus: 'Functionele kracht & blessurepreventie',
  totalMinutes: 40,
  intro:
    'Krachtstation + elastische banden + eigen lichaam. In supersets (A1→A2, rust, herhaal) — scheelt tijd en houdt de hartslag op. 3 sets, 12–15 herhalingen, 60–90 sec rust. Off-season mag zwaarder: 4×6–8.',
  blocks: [
    {
      label: 'Warming-up — 5 min',
      exercises: [
        { name: 'Foam roll + dynamisch mobiliseren', prescription: '4 min', note: 'Heupen, enkels, schouders' },
        { name: 'Band pull-aparts', prescription: '1×20', note: 'Schouders activeren', garminCode: 'BANDED_EXERCISES/PULL_APART' },
      ],
    },
    {
      label: 'Superset A — 3 rondes',
      note: '60–90 sec rust',
      exercises: [
        { name: 'Leg extension (machine)', prescription: '3×15', note: 'Quadriceps — fietskracht', garminCode: 'BANDED_EXERCISES/LEG_EXTENSION' },
        { name: 'Leg curl (machine)', prescription: '3×12', note: 'Hamstrings — loopkracht', garminCode: 'LEG_CURL/LEG_CURL' },
      ],
    },
    {
      label: 'Superset B — 3 rondes',
      note: '60–90 sec rust',
      exercises: [
        { name: 'Lat pulldown (machine)', prescription: '3×12', note: 'Rug/lats — zwem-trek', garminCode: 'PULL_UP/LAT_PULLDOWN' },
        { name: 'Chest press (machine)', prescription: '3×12', note: 'Duw-balans, houding', garminCode: 'BANDED_EXERCISES/CHEST_PRESS' },
      ],
    },
    {
      label: 'Superset C — 3 rondes',
      note: '60–90 sec rust',
      exercises: [
        { name: 'Bulgarian split squat', prescription: '3×10 per been', note: 'Achterste voet verhoogd — single-leg stabiliteit', garminCode: 'LUNGE/OVERHEAD_BULGARIAN_SPLIT_SQUAT' },
        { name: 'Seated row (lage katrol)', prescription: '3×12', note: 'Schouderbladen samenknijpen — houding', garminCode: 'ROW/SEATED_CABLE_ROW' },
      ],
    },
    {
      label: 'Prehab & core — 2 rondes',
      note: 'Blessurepreventie, weinig rust',
      exercises: [
        { name: '1-benige Roemeense deadlift', prescription: '2×10 per been', note: 'Band of eigen lichaam — glutes/hamstrings + balans', garminCode: 'DEADLIFT/ROMANIAN_DEADLIFT' },
        { name: 'Face pulls (band)', prescription: '2×15', note: 'Rotator cuff — schoudergezondheid zwem', garminCode: 'ROW/FACE_PULL' },
        { name: 'Kuitheffing (1-benig)', prescription: '2×15 per been', note: 'Volledige beweging, even vasthouden', garminCode: 'CALF_RAISE/SINGLE_LEG_STANDING_CALF_RAISE' },
        { name: 'Knielende houthakker (band)', prescription: '2×10 per zijde', note: 'Diagonaal omhoog — draai uit je romp, niet uit je armen', garminCode: 'CHOP/KNEELING_WOODCHOPPER' },
      ],
    },
    {
      label: 'Cooldown',
      exercises: [
        { name: 'Stretchen', prescription: '4 min', note: 'Heupbuigers, hamstrings, kuiten' },
      ],
    },
  ],
};

// Onaangepaste standaard-workouts. De gebruiker kan ze aanpassen; aangepaste
// versies komen uit storage.ts (getStrengthWorkouts), met deze als terugval.
export const DEFAULT_STRENGTH_WORKOUTS: Record<StrengthWorkoutId, StrengthWorkout> = {
  core7: CORE_7MIN,
  'tri-strength': TRI_STRENGTH,
};

/**
 * Kies WELKE kracht-workout bij een sessie hoort. Heuristiek op type/omschrijving,
 * met de geplande duur als terugval (korte sessie = core-circuit). Geeft alleen het
 * id terug; de (mogelijk aangepaste) inhoud wordt via storage opgehaald.
 */
export function pickStrengthWorkoutId(session: TrainingSession): StrengthWorkoutId {
  const haystack = `${session.type || ''} ${session.description || ''}`.toLowerCase();
  const isCore =
    /\bcore\b|romp|buik|stabili/.test(haystack) ||
    (!/full[- ]?body|kracht|functione|benen|legs/.test(haystack) &&
      (session.durationMinutes ?? 0) > 0 &&
      (session.durationMinutes ?? 0) <= 15);
  return isCore ? 'core7' : 'tri-strength';
}

/**
 * Zoeklink naar uitleg-video's van een oefening (YouTube).
 *
 * Bewust een ZOEKOPDRACHT en geen vast video-id: er zijn ruim 700 oefeningen, dus
 * per oefening een video uitzoeken is niet te onderhouden, en een vast id wordt na
 * verloop van tijd toch verwijderd of op privé gezet. Een zoeklink blijft altijd
 * werken en geeft meteen meerdere uitvoeringen.
 *
 * De zoekterm komt bij voorkeur uit de Garmin-oefeningcode: dat is de canonieke
 * Engelse naam ("SIDE_PLANK_WITH_LEG_LIFT" → "side plank with leg lift"), wat veel
 * betere resultaten geeft dan een Nederlandse vertaling. Zonder code valt hij terug
 * op de naam zoals die in de app staat.
 */
export function exerciseVideoUrl(exercise: StrengthExercise): string {
  const fromCode = exercise.garminCode?.split('/')[1]?.replace(/_/g, ' ').toLowerCase();
  const term = fromCode || exercise.name;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${term} exercise how to`)}`;
}

/** Diepe kloon van een workout (voor veilig bewerken zonder de defaults te muteren). */
export function cloneStrengthWorkout(w: StrengthWorkout): StrengthWorkout {
  return {
    ...w,
    blocks: w.blocks.map((b) => ({ ...b, exercises: b.exercises.map((e) => ({ ...e })) })),
  };
}
