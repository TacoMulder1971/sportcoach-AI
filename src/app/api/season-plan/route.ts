import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { AthleteProfilePayload, buildAthleteProfileText, buildSportConstraintText, coachPersona, isMultiSportAthlete } from '@/lib/athlete';
import { materializeBlocks, SeasonBlockSpec, SeasonWeekSlot, formatRangeNL } from '@/lib/season';

// Twee-traps net als generate-plan: Opus redeneert over het seizoen, Haiku giet
// het in JSON. Opus JSON-output is traag en breekt sneller; deze splitsing is in
// deze codebase de bewezen aanpak.
export const maxDuration = 60;

interface SeasonAiOutput {
  summary?: string;
  blocks?: SeasonBlockSpec[];
}

const JSON_FORMAT_SPEC = `STRICT OUTPUT FORMAT:
Antwoord ALLEEN met een JSON code block. Geen tekst ervoor of erna.

interface SeasonBlockSpec {
  startWeek: number            // index uit het WEEKRASTER hierboven (0-based)
  endWeek: number              // index uit het WEEKRASTER (inclusief, >= startWeek)
  phaseId: 'basis' | 'opbouw' | 'piek' | 'taper' | 'wedstrijd' | 'herstel'
  label: string                // kort, bv "Opbouwblok 2 — drempelkracht" (max 6 woorden)
  focus: string                // 1-2 zinnen Nederlands: waar draait dit blok om
  targetWeeklyTrimpMin: number // gemiddelde weekbelasting ondergrens
  targetWeeklyTrimpMax: number // gemiddelde weekbelasting bovengrens
  keyWorkouts: string[]        // 2-4 sleutelsessies, kort, bv "1 brick per week"
}

Output:
{
  "summary": "...",   // de rode draad van het seizoen in MAXIMAAL 2 zinnen
  "blocks": SeasonBlockSpec[]
}

REGELS VOOR DE BLOKKEN:
- De blokken moeten AANEENGESLOTEN zijn: het eerste blok begint op week 0, elk volgend blok begint op endWeek+1 van het vorige, het laatste blok eindigt op de laatste week van het raster. Geen gaten, geen overlap.
- Elk blok is 1 tot 6 weken lang.
- De week waarin een wedstrijd valt hoort in een blok met phaseId "wedstrijd".
- Na een wedstrijd volgt een blok met phaseId "herstel" (1-2 weken) voordat er weer opgebouwd wordt.

\`\`\`json
{ "summary": "...", "blocks": [ { "startWeek": 0, "endWeek": 2, "phaseId": "opbouw", "label": "...", "focus": "...", "targetWeeklyTrimpMin": 180, "targetWeeklyTrimpMax": 210, "keyWorkouts": ["..."] } ] }
\`\`\``;

function parseJson(text: string): SeasonAiOutput | null {
  const attempts = [
    text.match(/```json\s*([\s\S]*?)\s*```/)?.[1],
    text.match(/```\s*(\{[\s\S]*?\})\s*```/)?.[1],
    text.match(/(\{[\s\S]*\})/)?.[1],
    text,
  ];
  for (const jsonStr of attempts) {
    if (!jsonStr) continue;
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && typeof parsed === 'object') return parsed as SeasonAiOutput;
    } catch {
      continue;
    }
  }
  return null;
}

function buildGridText(grid: SeasonWeekSlot[]): string {
  const lines = grid.map((w) => {
    const race = w.raceName ? ` ← WEDSTRIJD: ${w.raceName}` : '';
    const days = w.daysUntilRace === null ? 'geen wedstrijd meer' : `${w.daysUntilRace} dagen tot de eerstvolgende wedstrijd`;
    return `W${w.index}: ${formatRangeNL(w.startDate, w.endDate)} — ${days} (standaardfase: ${w.phaseLabel})${race}`;
  });
  return `WEEKRASTER (${grid.length} weken; gebruik deze indices in startWeek/endWeek):\n${lines.join('\n')}`;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY niet geconfigureerd' }, { status: 500 });
    }

    const body = await request.json();
    const {
      weekGrid,
      raceContext,
      goalsHistory,
      performanceSummary,
      trainingLoad,
      hrZoneText,
      athleteProfile,
      feedback,
    } = body;

    const grid = (Array.isArray(weekGrid) ? weekGrid : []) as SeasonWeekSlot[];
    if (grid.length === 0) {
      return NextResponse.json({ error: 'Geen wedstrijden gepland — voeg eerst een doel toe.' }, { status: 400 });
    }

    const client = new Anthropic({ apiKey });

    const profile = (athleteProfile ?? null) as AthleteProfilePayload | null;
    const profileText = buildAthleteProfileText(profile);
    const persona = coachPersona(profile);
    const sportConstraint = buildSportConstraintText(profile);
    const multiSport = isMultiSportAthlete(profile);

    const context = `${profileText ? `${profileText}\n${sportConstraint ? `${sportConstraint}\n` : ''}\n` : ''}ATLEET: ${hrZoneText || 'Max HR 172 bpm'}
WEDSTRIJDKALENDER:
${raceContext || 'geen wedstrijden bekend'}
${goalsHistory ? `\n${goalsHistory}\n` : ''}
${buildGridText(grid)}
${performanceSummary ? `\n${performanceSummary}\n` : ''}${trainingLoad ? `\nHUIDIGE TRAINING LOAD: ${trainingLoad.weekLoad} TRIMP deze week (${trainingLoad.status})\n` : ''}${feedback ? `\nWENSEN VAN DE ATLEET VOOR DIT SEIZOENSPLAN (verwerk deze):\n${feedback}\n` : ''}`;

    // --- TRAP 1: Opus bepaalt de seizoensopbouw ---
    const strategyPrompt = `Je bent een ervaren ${persona}. Maak een SEIZOENSPLAN: de lange-termijnopbouw van vandaag tot en met de laatste wedstrijd in de kalender. Dit is het kader waar de 2-wekelijkse schema's later een uitwerking van worden — dus geen losse trainingen, maar blokken van meerdere weken.

${context}

Bepaal:
1. RODE DRAAD (2-4 zinnen): wat is de kern van dit seizoen, gegeven de wedstrijden en waar de atleet nu staat qua belasting en herstel.
2. BLOKINDELING: verdeel het weekraster in aaneengesloten blokken van 1-6 weken. Geef per blok:
   - de week-indices (bijv. W0–W2)
   - de fase (basis / opbouw / piek / taper / wedstrijd / herstel)
   - een korte naam
   - waar het blok om draait (1-2 zinnen)
   - de doel-weekbelasting als TRIMP-bereik, logisch oplopend/aflopend t.o.v. het vorige blok
   - 2-4 sleutelsessies${multiSport ? ' (denk aan brick-sessies en open water)' : ''}
3. Let expliciet op:
   - De week van een wedstrijd is een wedstrijdweek; daarna 1-2 weken herstel voordat er weer opgebouwd wordt.
   - Bij meerdere wedstrijden: bepaal welke het hoofddoel is en welke een tussendoel/testwedstrijd, en laat dat terugkomen in de belasting rondom die datum.
   - Bouw belasting geleidelijk op (richtlijn: maximaal ~10% per week) met om de 3-4 weken een lichtere herstelweek.
   - Sluit aan bij de huidige belasting van de atleet; begin niet ineens veel hoger of lager.

Schrijf een coachnotitie in het Nederlands, concreet met getallen maar KORT: maximaal 350 woorden in totaal. Per blok hooguit twee regels — de details komen later in het schema zelf.`;

    // Bewust 'low' effort en een krap token-budget: de hele route (Opus + Haiku)
    // moet binnen de Vercel-limiet van 60s blijven. Met 'medium' en een lange
    // notitie liep dit op tot ~67s en zou de functie in productie afgekapt worden.
    const strategyResponse = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 2500,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
      system: `Je bent een ervaren, data-gedreven ${persona} die seizoensplanningen (periodisering) opstelt.`,
      messages: [{ role: 'user', content: strategyPrompt }],
    });

    const rationale = strategyResponse.content
      .filter((b) => b.type === 'text')
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('\n')
      .trim();

    // --- TRAP 2: Haiku zet de blokindeling om naar JSON ---
    const formatPrompt = `Zet de seizoensplanning hieronder exact om naar JSON.

${buildGridText(grid)}

SEIZOENSPLANNING VAN DE COACH (volg deze exact — verzin geen eigen blokken):
${rationale}

${JSON_FORMAT_SPEC}`;

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 3000,
      system: formatPrompt,
      messages: [{ role: 'user', content: 'Genereer het seizoensplan als JSON.' }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const parsed = parseJson(text);
    if (!parsed || !Array.isArray(parsed.blocks) || parsed.blocks.length === 0) {
      return NextResponse.json({ error: 'Kon geen geldige blokindeling maken — probeer het opnieuw.' }, { status: 422 });
    }

    // Repareert gaten/overlap en garandeert dekking van het hele raster.
    const blocks = materializeBlocks(parsed.blocks, grid);
    if (blocks.length === 0) {
      return NextResponse.json({ error: 'Kon geen geldige blokindeling maken — probeer het opnieuw.' }, { status: 422 });
    }

    const summary = (typeof parsed.summary === 'string' && parsed.summary.trim())
      ? parsed.summary.trim()
      : blocks.map((b) => b.label).join(' → ');

    return NextResponse.json({ summary, rationale, blocks });
  } catch (error) {
    console.error('Season plan error:', error);
    return NextResponse.json({ error: 'Er ging iets mis bij het maken van het seizoensplan' }, { status: 500 });
  }
}
