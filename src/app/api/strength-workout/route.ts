/**
 * Stelt de oefenlijst voor een krachtsessie samen — elke keer anders.
 *
 * Waarom: de app had twee VASTE krachtworkouts (core7 + tri-strength), dus elke
 * krachtdag gaf letterlijk dezelfde oefeningen. Nu varieert de invulling, terwijl
 * de opzet hetzelfde blijft.
 *
 * De vaste workout uit src/lib/strength.ts (inclusief de aanpassingen van de
 * gebruiker) gaat als REFERENTIE mee: daaruit leidt het model af welk materiaal
 * beschikbaar is (krachtstation, banden, matje, ...) en hoe de blokken zijn
 * opgebouwd. Zo blijft variatie binnen wat de atleet daadwerkelijk thuis heeft —
 * zonder dat we een tweede bibliotheek hoeven te onderhouden.
 *
 * Valt de generatie om, dan toont de app gewoon de vaste workout (client-side
 * terugval) — nooit een lege krachtdag.
 *
 * Elke oefening moet uit Garmins eigen oefeningcatalogus komen (zie
 * garmin-exercise-catalog.ts): alleen dan kun je de sessie als krachtworkout naar
 * je horloge sturen en toont Garmin de echte oefening met animatie en reps-telling.
 * Het model kiest dus een code uit de lijst en schrijft er een Nederlandse naam bij;
 * codes die niet in de catalogus staan worden hier hersteld of weggelaten.
 */
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { AthleteProfilePayload, buildAthleteProfileText } from '@/lib/athlete';
import { StrengthBlock, StrengthExercise, StrengthWorkout } from '@/lib/strength';
import { GARMIN_EXERCISE_CATALOG, buildExerciseCatalogText, isKnownExerciseCode } from '@/lib/garmin-exercise-catalog';

// Sonnet stelt de inhoud samen (trainingsinhoud, geen pure opmaak) — zoals session-breakdown.
export const maxDuration = 30;

interface StrengthRequestItem {
  /** De sessie uit het schema (type/duur/omschrijving). */
  type?: string;
  durationMinutes?: number;
  description?: string;
  /** De vaste workout die hierbij hoort — referentie voor materiaal en opzet. */
  base: StrengthWorkout;
}

function asString(value: unknown, max = 120): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

/**
 * Zet de code van het model om in een geldige catalogus-code. Herstelt een
 * verkeerde categorie door de oefeningnaam alsnog op te zoeken — modellen verwisselen
 * die nog weleens (bijv. CORE/SIDE_PLANK i.p.v. PLANK/SIDE_PLANK).
 */
function resolveExerciseCode(raw: string): string | null {
  if (!raw) return null;
  const code = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (isKnownExerciseCode(code)) return code;
  const name = code.includes('/') ? code.split('/')[1] : code;
  if (!name) return null;
  for (const [category, names] of Object.entries(GARMIN_EXERCISE_CATALOG)) {
    if (names.includes(name)) return `${category}/${name}`;
  }
  return null;
}

/** Maakt er hoe dan ook een bruikbare workout van, of null als er niets deugt. */
function sanitizeWorkout(raw: unknown, base: StrengthWorkout): StrengthWorkout | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const rawBlocks = Array.isArray(r.blocks) ? r.blocks : [];

  const blocks: StrengthBlock[] = [];
  for (const b of rawBlocks) {
    if (!b || typeof b !== 'object') continue;
    const rb = b as Record<string, unknown>;
    const rawExercises = Array.isArray(rb.exercises) ? rb.exercises : [];
    const exercises: StrengthExercise[] = [];
    for (const e of rawExercises) {
      if (!e || typeof e !== 'object') continue;
      const re = e as Record<string, unknown>;
      const name = asString(re.name, 60);
      const prescription = asString(re.prescription, 30);
      if (!name || !prescription) continue;
      const garminCode = resolveExerciseCode(asString(re.code, 80));
      // Zonder geldige Garmin-oefening laten we de oefening vallen: de sessie moet
      // 1-op-1 naar het horloge kunnen, en dat kan alleen met een bekende code.
      if (!garminCode) continue;
      const note = asString(re.note, 120);
      exercises.push({ name, prescription, garminCode, ...(note ? { note } : {}) });
    }
    if (exercises.length === 0) continue;
    const label = asString(rb.label, 60) || 'Blok';
    const note = asString(rb.note, 80);
    blocks.push(note ? { label, note, exercises } : { label, exercises });
  }

  if (blocks.length === 0) return null;

  return {
    id: base.id,
    title: asString(r.title, 40) || base.title,
    focus: asString(r.focus, 60) || base.focus,
    totalMinutes: typeof r.totalMinutes === 'number' && r.totalMinutes > 0 ? Math.round(r.totalMinutes) : base.totalMinutes,
    intro: asString(r.intro, 240) || base.intro,
    blocks,
  };
}

/** De referentie-workout compact als tekst — materiaal en opzet in één blok. */
function describeBase(base: StrengthWorkout): string {
  const blocks = base.blocks
    .map(
      (b) =>
        `- ${b.label}${b.note ? ` (${b.note})` : ''}: ` +
        b.exercises.map((e) => `${e.name} ${e.prescription}${e.garminCode ? ` [${e.garminCode}]` : ''}`).join('; ')
    )
    .join('\n');
  return `"${base.title}" — ${base.focus}, ~${base.totalMinutes} min\n${base.intro ? `${base.intro}\n` : ''}${blocks}`;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY niet geconfigureerd' }, { status: 500 });
    }

    const { sessions, athleteProfile, avoid } = (await request.json()) as {
      sessions: StrengthRequestItem[];
      athleteProfile?: AthleteProfilePayload;
      avoid?: string[];
    };

    if (!Array.isArray(sessions) || sessions.length === 0) {
      return NextResponse.json({ error: 'Geen krachtsessies opgegeven' }, { status: 400 });
    }
    if (sessions.some((s) => !s?.base?.blocks?.length)) {
      return NextResponse.json({ error: 'Referentie-workout ontbreekt' }, { status: 400 });
    }

    const profileText = buildAthleteProfileText(athleteProfile ?? null);
    const catalogText = buildExerciseCatalogText();
    // Het materiaal uit het profiel is leidend zodra het ingevuld is; anders leiden
    // we het materiaal af uit de referentie-workout (zoals voorheen).
    const equipment = athleteProfile?.strengthEquipment?.trim();
    const recent = (avoid ?? []).filter((n) => typeof n === 'string' && n.trim()).slice(0, 40);

    const sessionList = sessions
      .map(
        (s, i) => `SESSIE ${i + 1}: type=${s.type || 'kracht'}, geplande duur=${s.durationMinutes ?? s.base.totalMinutes} min${
          s.description ? `, omschrijving="${s.description}"` : ''
        }
REFERENTIE-WORKOUT (materiaal + opzet — hier wijk je niet vanaf qua apparatuur):
${describeBase(s.base)}`
      )
      .join('\n\n');

    const prompt = `Je bent een ervaren kracht- en duursportcoach. Stel voor elke onderstaande krachtsessie een oefenlijst samen die de atleet vandaag kan uitvoeren.

${profileText ? `${profileText}\n\n` : ''}${sessionList}

DOEL: variatie. De atleet doet deze sessie wekelijks en wil niet elke keer exact dezelfde oefeningen. Houd de OPZET van de referentie-workout aan (zelfde soort blokken, zelfde aantal blokken, vergelijkbare totaalduur en setopbouw), maar wissel de oefeningen af.

REGELS:
${equipment
      ? `- BESCHIKBAAR MATERIAAL (dit is hard — kies NOOIT een oefening die hier niet mee kan): "${equipment}". Twijfel je of een oefening met dit materiaal uitvoerbaar is, kies dan iets anders.`
      : '- Gebruik UITSLUITEND materiaal dat in de referentie-workout voorkomt (bijv. krachtstation-machines, elastische banden, eigen lichaamsgewicht, matje). Verzin geen halters, kettlebells of apparaten die er niet staan.'}
- Houd per blok dezelfde structuur: hetzelfde aantal sets en een vergelijkbaar aantal oefeningen. Een circuit blijft een circuit, supersets blijven supersets.
- Behoud de trainingsprikkel: dezelfde spiergroepen en hetzelfde doel per blok als in de referentie. Varieer de OEFENING, niet de bedoeling.
- Houd ongeveer 60-70% van de oefeningen anders dan de referentie; sleutelbewegingen die weinig alternatief hebben mogen blijven staan.
- Kies ELKE oefening uit de OEFENINGENLIJST hieronder en geef in "code" exact de regel zoals die er staat, inclusief categorie: "PLANK/SIDE_PLANK". Verzin nooit een eigen code en verander de spelling niet. Een oefening zonder geldige code valt af.
- "name": de Nederlandse naam van diezelfde oefening, zoals de atleet hem kent (bijv. "Side plank links"). Bij een oefening per kant: maak er twee losse oefeningen van (links en rechts) of zet "per been"/"per zijde" in het voorschrift.
- "prescription" in exact dezelfde stijl als de referentie: "3×12", "2×10 per been", "40 sec", "4 min".
- "note" bij een oefening: één korte techniek- of uitvoeringstip in het Nederlands (max 12 woorden).
- "label" van een blok: kort, zoals in de referentie ("Superset A — 3 rondes", "Circuit — 1 ronde"), max 30 tekens. De rust hoort NIET in het label maar in "note" van het blok ("60-90 sec rust").
- Blessurepreventie en houding blijven meegenomen (rompstabiliteit, schouders, hamstrings/glutes).
- "title": een korte, herkenbare naam voor de sessie (max 40 tekens) — die komt zo in Garmin te staan. Dus geen woorden als "variatie", "versie" of "nieuw" erin.
- Alles in het Nederlands.
${recent.length > 0 ? `\nRECENT AL GEDAAN (kies hier zo min mogelijk uit, de atleet wil afwisseling):\n${recent.join(', ')}\n` : ''}
OEFENINGENLIJST (categorie: oefeningen — dit is wat een Garmin-horloge kent; alleen hieruit kiezen):
${catalogText}

Antwoord met UITSLUITEND geldige JSON, zonder uitleg eromheen:
{"workouts":[{"title":"korte naam","focus":"korte focus","totalMinutes":40,"intro":"één zin uitvoeringsinstructie","blocks":[{"label":"Superset A — 3 rondes","note":"60-90 sec rust","exercises":[{"code":"ROW/SEATED_CABLE_ROW","name":"Seated row","prescription":"3×12","note":"tip"}]}]}]}
Eén workout per sessie, in dezelfde volgorde.`;

    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return NextResponse.json({ error: 'Geen geldige JSON terug van het model' }, { status: 502 });
    }

    let parsed: { workouts?: unknown[] };
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return NextResponse.json({ error: 'Antwoord van het model was geen geldige JSON' }, { status: 502 });
    }

    const rawWorkouts = Array.isArray(parsed.workouts) ? parsed.workouts : [];
    const workouts = sessions.map((s, i) => sanitizeWorkout(rawWorkouts[i], s.base));

    if (workouts.every((w) => w === null)) {
      return NextResponse.json({ error: 'Kon geen bruikbare oefenlijst samenstellen' }, { status: 502 });
    }

    // null → de client toont voor die sessie de vaste workout.
    return NextResponse.json({ workouts });
  } catch (error) {
    console.error('Strength workout error:', error);
    const message = error instanceof Error ? error.message : 'Onbekende fout';
    return NextResponse.json({ error: `Oefenlijst samenstellen mislukt: ${message}` }, { status: 500 });
  }
}
