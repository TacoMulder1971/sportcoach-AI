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
        { name: 'Plank', prescription: '40 sec', note: 'Rechte lijn, billen aanspannen' },
        { name: 'Mountain climbers', prescription: '30 sec', note: 'Heupen laag, tempo hoog' },
        { name: 'Dead bug', prescription: '30 sec', note: 'Onderrug tegen de grond' },
        { name: 'Side plank links', prescription: '30 sec', note: 'Heup hoog' },
        { name: 'Side plank rechts', prescription: '30 sec', note: 'Heup hoog' },
        { name: 'Bicycle crunches', prescription: '30 sec', note: 'Rustig, controle boven snelheid' },
        { name: 'Superman', prescription: '30 sec', note: 'Armen en benen optillen' },
        { name: 'Glute bridge — hold', prescription: '40 sec', note: 'Knijp de billen aan' },
        { name: 'Bird dog', prescription: '30 sec', note: 'Wissel arm/been, geen heupdraai' },
        { name: 'Leg raises', prescription: '30 sec', note: 'Onderrug blijft op de grond' },
        { name: 'Russian twists', prescription: '30 sec', note: 'Romp draaien, niet alleen armen' },
        { name: 'Plank', prescription: '40 sec', note: 'Afmaken — kern strak houden' },
      ],
    },
  ],
};

const TRI_STRENGTH: StrengthWorkout = {
  id: 'tri-strength',
  title: 'Triatlon-kracht',
  focus: 'Functionele kracht & blessurepreventie',
  totalMinutes: 40,
  intro: 'Triatlon-ondersteunend: benen, romp en houding. 60–90 sec rust tussen de sets.',
  blocks: [
    {
      label: 'Warming-up — 5 min',
      exercises: [
        { name: 'Dynamisch mobiliseren', prescription: '3–4 min', note: 'Heupen, enkels, schouders' },
        { name: 'Bodyweight squats', prescription: '1×15', note: 'Op gang komen' },
      ],
    },
    {
      label: 'Hoofdblok — 3 rondes',
      note: '60–90 sec rust tussen de sets',
      exercises: [
        { name: 'Goblet squat', prescription: '3×12', note: 'Borst hoog, knieën naar buiten' },
        { name: 'Bulgarian split squat', prescription: '3×10 per been', note: 'Achterste voet verhoogd' },
        { name: 'Roemeense deadlift (1-benig)', prescription: '3×10 per been', note: 'Rug recht, hamstring voelen' },
        { name: 'Step-ups', prescription: '3×12 per been', note: 'Volledig doorstrekken bovenop' },
        { name: 'Push-ups', prescription: '3×12', note: 'Lichaam in één lijn' },
        { name: 'Dumbbell row', prescription: '3×12 per arm', note: 'Schouderbladen samenknijpen' },
        { name: 'Calf raises', prescription: '3×15', note: 'Volledige beweging, even vasthouden' },
        { name: 'Plank', prescription: '3×45 sec', note: 'Kern strak, niet doorzakken' },
      ],
    },
    {
      label: 'Cooldown',
      exercises: [
        { name: 'Stretchen', prescription: '3–5 min', note: 'Heupbuigers, hamstrings, kuiten' },
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

/** Diepe kloon van een workout (voor veilig bewerken zonder de defaults te muteren). */
export function cloneStrengthWorkout(w: StrengthWorkout): StrengthWorkout {
  return {
    ...w,
    blocks: w.blocks.map((b) => ({ ...b, exercises: b.exercises.map((e) => ({ ...e })) })),
  };
}
