import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { TrainingWeek } from '@/lib/types';

const VALID_SPORTS = ['zwemmen', 'fietsen', 'hardlopen', 'mountainbike', 'rust'];
const VALID_ZONES = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'];
const DAY_NAMES = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];

function validatePlan(data: unknown): { valid: boolean; plan?: TrainingWeek[]; errors: string[] } {
  const errors: string[] = [];
  if (!Array.isArray(data) || data.length !== 2) {
    return { valid: false, errors: ['Plan moet een array van 2 weken zijn'] };
  }
  for (let w = 0; w < 2; w++) {
    const week = data[w];
    if (week.weekNumber !== w + 1) errors.push(`Week ${w + 1}: weekNumber moet ${w + 1} zijn`);
    if (typeof week.label !== 'string' || !week.label) errors.push(`Week ${w + 1}: label ontbreekt`);
    if (!Array.isArray(week.days) || week.days.length !== 7) {
      errors.push(`Week ${w + 1}: moet 7 dagen hebben`);
      continue;
    }
    for (let d = 0; d < 7; d++) {
      const day = week.days[d];
      if (day.dayIndex !== d) errors.push(`Week ${w + 1} dag ${d}: dayIndex moet ${d} zijn`);
      if (day.day !== DAY_NAMES[d]) errors.push(`Week ${w + 1} dag ${d}: day moet "${DAY_NAMES[d]}" zijn`);
      if (typeof day.isRestDay !== 'boolean') errors.push(`Week ${w + 1} dag ${d}: isRestDay ontbreekt`);
      if (!Array.isArray(day.sessions) || day.sessions.length === 0) {
        errors.push(`Week ${w + 1} dag ${d}: minimaal 1 sessie nodig`);
        continue;
      }
      for (const s of day.sessions) {
        if (!VALID_SPORTS.includes(s.sport)) errors.push(`Ongeldige sport: ${s.sport}`);
        if (!s.type || !s.description) errors.push(`Sessie mist type of description`);
        if (s.zone && !VALID_ZONES.includes(s.zone)) errors.push(`Ongeldige zone: ${s.zone}`);
        if (s.sport !== 'rust' && (!s.durationMinutes || s.durationMinutes <= 0)) {
          errors.push(`Sessie mist durationMinutes`);
        }
      }
    }
  }
  return errors.length === 0
    ? { valid: true, plan: data as TrainingWeek[], errors: [] }
    : { valid: false, errors };
}

function planToText(plan: TrainingWeek[]): string {
  let text = '';
  for (const week of plan) {
    text += `\n${week.label}:\n`;
    for (const day of week.days) {
      if (day.isRestDay) {
        text += `- ${day.day}: Rust\n`;
      } else {
        for (const s of day.sessions) {
          text += `- ${day.day}: ${s.sport} ${s.type} (${s.durationMinutes}min ${s.zone || ''}) - ${s.description}\n`;
        }
      }
    }
  }
  return text;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY niet geconfigureerd' }, { status: 500 });
    }

    const { currentPlan, weekNumber, dayIndex, adjustmentRequest, daysUntilRace } = await request.json();

    if (!currentPlan || !adjustmentRequest) {
      return NextResponse.json({ error: 'Verplichte velden ontbreken' }, { status: 400 });
    }

    const dayName = DAY_NAMES[dayIndex] || 'onbekend';
    const currentPlanText = planToText(currentPlan);

    const systemPrompt = `Je bent TriCoach AI planmaker. De atleet wil een ad-hoc aanpassing aan zijn trainingsschema.

ATLEET: Max HR 172 bpm, Zones: Z1(86-103 Herstel), Z2(103-120 Basis), Z3(120-138 Aeroob), Z4(138-155 Drempel), Z5(155-172 VO2max)
DOEL: 1/4 triatlon op 13 juni 2026, finish onder 3 uur
DAGEN TOT WEDSTRIJD: ${daysUntilRace}

HUIDIG SCHEMA:
${currentPlanText}

AANPASSING GEVRAAGD VOOR: Week ${weekNumber}, ${dayName}
VERZOEK: ${adjustmentRequest}

Pas het schema aan. Als de wijziging gevolgen heeft voor andere dagen (bv. training verschuiven), pas die ook aan.
Behoud de rest van het schema zoveel mogelijk intact.

REGELS:
- Balanceer zwemmen/fietsen/hardlopen over de week
- Maximaal 2 sessies per dag
- Descriptions in het Nederlands

STRICT OUTPUT FORMAT:
Antwoord ALLEEN met een JSON code block. Geen andere tekst ervoor of erna.
Het JSON moet exact dit TypeScript type volgen:

type Sport = 'zwemmen' | 'fietsen' | 'hardlopen' | 'mountainbike' | 'rust'
type HeartRateZone = 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5'

interface TrainingSession {
  sport: Sport
  type: string
  durationMinutes?: number
  zone?: HeartRateZone
  description: string
}

interface TrainingDay {
  day: string        // "Maandag" | "Dinsdag" | "Woensdag" | "Donderdag" | "Vrijdag" | "Zaterdag" | "Zondag"
  dayIndex: number   // 0=Maandag, 1=Dinsdag, ..., 6=Zondag
  sessions: TrainingSession[]
  isRestDay: boolean
}

interface TrainingWeek {
  weekNumber: 1 | 2
  label: string
  days: TrainingDay[] // altijd 7 dagen
}

Output: TrainingWeek[] (array van exact 2 weken)

\`\`\`json
[
  { "weekNumber": 1, "label": "...", "days": [...] },
  { "weekNumber": 2, "label": "...", "days": [...] }
]
\`\`\``;

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: 'Pas het trainingsschema aan.' }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : text;

    try {
      const parsed = JSON.parse(jsonStr);
      const result = validatePlan(parsed);
      if (!result.valid) {
        return NextResponse.json({ error: `Validatie mislukt: ${result.errors.join(', ')}` }, { status: 422 });
      }
      return NextResponse.json({ plan: result.plan });
    } catch {
      return NextResponse.json({ error: 'Kon geen geldig JSON vinden in AI response' }, { status: 422 });
    }
  } catch (error) {
    console.error('Adjust day error:', error);
    return NextResponse.json({ error: 'Er ging iets mis bij het aanpassen' }, { status: 500 });
  }
}
