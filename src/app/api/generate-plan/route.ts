import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { TrainingWeek, DayPreference } from '@/lib/types';

export const maxDuration = 30; // Vercel timeout verlengen naar 30 seconden

const VALID_SPORTS = ['zwemmen', 'fietsen', 'hardlopen', 'mountainbike', 'rust'];
const VALID_ZONES = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'];
const DAY_NAMES = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];

// Auto-repair veelvoorkomende AI-fouten vóór validatie
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function autoRepairPlan(data: any[]): any[] {
  if (!Array.isArray(data)) return data;
  for (const week of data) {
    if (!week?.days || !Array.isArray(week.days)) continue;
    for (let d = 0; d < week.days.length; d++) {
      const day = week.days[d];
      // Fix lege sessies → rustdag
      if (!Array.isArray(day.sessions) || day.sessions.length === 0) {
        day.isRestDay = true;
        day.sessions = [{
          sport: 'rust',
          type: 'rust',
          description: 'Rustdag — actief herstel of volledig rust',
        }];
      }
      // Fix ontbrekende dag-naam/index
      if (!day.day) day.day = DAY_NAMES[d];
      if (day.dayIndex === undefined) day.dayIndex = d;
    }
  }
  return data;
}

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

function buildPreferencesText(dayPreferences: DayPreference[]): string {
  if (!dayPreferences || dayPreferences.length === 0) return '';
  let text = '\nDAGVOORKEUREN VAN DE ATLEET (respecteer deze wensen):\n';
  for (const pref of dayPreferences) {
    const dayName = DAY_NAMES[pref.dayIndex];
    text += `- Week ${pref.weekNumber}, ${dayName}: ${pref.preference}\n`;
  }
  return text;
}

const JSON_FORMAT_SPEC = `STRICT OUTPUT FORMAT:
Antwoord ALLEEN met een JSON code block. Geen andere tekst ervoor of erna.
Het JSON moet exact dit TypeScript type volgen:

type Sport = 'zwemmen' | 'fietsen' | 'hardlopen' | 'mountainbike' | 'rust'
type HeartRateZone = 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5'

interface TrainingSession {
  sport: Sport
  type: string      // bv "interval", "duur", "tempo", "herstel", "brick", "techniek", "rust"
  durationMinutes?: number  // verplicht behalve bij rust
  zone?: HeartRateZone      // verplicht behalve bij rust
  description: string       // korte uitleg in het Nederlands
}

interface TrainingDay {
  day: string        // "Maandag" | "Dinsdag" | "Woensdag" | "Donderdag" | "Vrijdag" | "Zaterdag" | "Zondag"
  dayIndex: number   // 0=Maandag, 1=Dinsdag, ..., 6=Zondag
  sessions: TrainingSession[]
  isRestDay: boolean
}

interface TrainingWeek {
  weekNumber: 1 | 2
  label: string      // bv "Week 1 — Opbouw" of "Week 2 — Intensiteit"
  days: TrainingDay[] // altijd 7 dagen
}

Output: TrainingWeek[] (array van exact 2 weken)

\`\`\`json
[
  { "weekNumber": 1, "label": "...", "days": [...] },
  { "weekNumber": 2, "label": "...", "days": [...] }
]
\`\`\``;

function parseAndValidate(text: string): { valid: boolean; plan?: TrainingWeek[]; errors: string[] } {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  const jsonStr = jsonMatch ? jsonMatch[1] : text;
  try {
    const parsed = JSON.parse(jsonStr);
    const repaired = autoRepairPlan(parsed);
    return validatePlan(repaired);
  } catch {
    return { valid: false, errors: ['Kon geen geldig JSON vinden in AI response'] };
  }
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY niet geconfigureerd' }, { status: 500 });
    }

    const body = await request.json();
    const {
      agenda,
      checkIns,
      garminData,
      trainingLoad,
      previousPlan,
      daysUntilRace,
      mode = 'generate',
      currentProposal,
      refinementFeedback,
    } = body;

    const client = new Anthropic({ apiKey });

    // --- REFINE MODE ---
    if (mode === 'refine' && currentProposal && refinementFeedback) {
      const currentPlanText = planToText(currentProposal);

      const refinePrompt = `Je bent My Sport Coach AI planmaker. Je hebt eerder een 2-weekse trainingsplanning gemaakt.

ATLEET: Max HR 172 bpm, Zones: Z1(86-103 Herstel), Z2(103-120 Basis), Z3(120-138 Aeroob), Z4(138-155 Drempel), Z5(155-172 VO2max)
DOEL: 1/4 triatlon op 13 juni 2026, finish onder 3 uur
DAGEN TOT WEDSTRIJD: ${daysUntilRace}

HUIDIG VOORSTEL:
${currentPlanText}

DE ATLEET WIL DEZE AANPASSINGEN:
${refinementFeedback}

Pas het schema aan op basis van de feedback. Behoud de algehele structuur maar verwerk de gevraagde wijzigingen.

REGELS:
- Geblokkeerde dagen (rustdagen) NIET wijzigen
- Balanceer zwemmen/fietsen/hardlopen over de week
- Maximaal 2 sessies per dag
- Descriptions in het Nederlands

${JSON_FORMAT_SPEC}`;

      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system: refinePrompt,
        messages: [{ role: 'user', content: 'Pas het trainingsschema aan volgens de feedback.' }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const result = parseAndValidate(text);

      if (!result.valid) {
        return NextResponse.json({ error: `Validatie mislukt: ${result.errors.join(', ')}` }, { status: 422 });
      }
      return NextResponse.json({ plan: result.plan });
    }

    // --- GENERATE MODE ---
    let previousPlanText = '';
    if (previousPlan && Array.isArray(previousPlan)) {
      previousPlanText = '\nVORIG SCHEMA (bouw hierop voort met geleidelijke progressie):\n';
      previousPlanText += planToText(previousPlan);
    }

    let performanceText = '';
    if (checkIns && checkIns.length > 0) {
      performanceText += '\nRECENTE CHECK-INS (gevoel na trainingen):\n';
      for (const ci of checkIns) {
        performanceText += `- ${ci.date} (${ci.trainingDay}): Gevoel ${ci.feeling}/5`;
        if (ci.note) performanceText += ` - "${ci.note}"`;
        performanceText += '\n';
      }
    }
    if (garminData?.activities?.length > 0) {
      performanceText += '\nRECENTE GARMIN ACTIVITEITEN:\n';
      for (const a of garminData.activities.slice(0, 10)) {
        performanceText += `- ${a.date}: ${a.activityName} (${a.sport}) - ${a.durationMinutes}min`;
        if (a.distanceKm > 0) performanceText += `, ${a.distanceKm}km`;
        if (a.avgHR > 0) performanceText += `, gem HR ${a.avgHR}`;
        performanceText += '\n';
      }
    }
    if (garminData?.health) {
      const h = garminData.health;
      performanceText += `\nHERSTEL: Slaap ${h.sleepDurationHours}u (score ${h.sleepScore}), HRV ${h.avgOvernightHrv}ms (${h.hrvStatus}), rust HR ${h.restingHR}\n`;
    }
    if (trainingLoad) {
      performanceText += `\nTRAINING LOAD: ${trainingLoad.weekLoad} TRIMP (${trainingLoad.status})\n`;
    }

    let blockedText = '';
    if (agenda?.blockedDays?.length > 0) {
      blockedText = '\nGEBLOKKEERDE DAGEN (MOETEN rustdagen worden):\n';
      for (const bd of agenda.blockedDays) {
        const dayName = DAY_NAMES[bd.dayIndex];
        blockedText += `- Week ${bd.weekNumber}, ${dayName}`;
        if (bd.reason) blockedText += ` (reden: ${bd.reason})`;
        blockedText += '\n';
      }
    }
    if (agenda?.constraints) {
      blockedText += `\nEXTRA BEPERKINGEN: ${agenda.constraints}\n`;
    }

    const preferencesText = buildPreferencesText(agenda?.dayPreferences || []);

    let phaseAdvice = '';
    if (daysUntilRace > 56) {
      phaseAdvice = 'FASE: Opbouwfase — focus op volume opbouwen, basis uithouding, techniek.';
    } else if (daysUntilRace > 28) {
      phaseAdvice = 'FASE: Piekfase — hogere intensiteit, race-specifieke sessies, brick trainingen.';
    } else if (daysUntilRace > 14) {
      phaseAdvice = 'FASE: Pre-taper — begin volume te verlagen, behoud intensiteit.';
    } else {
      phaseAdvice = 'FASE: Taper — flink volume verlagen, korte scherpe sessies, focus op rust en frisheid.';
    }

    const systemPrompt = `Je bent My Sport Coach AI planmaker. Genereer een 2-weekse trainingsplanning als JSON.

ATLEET: Max HR 172 bpm, Zones: Z1(86-103 Herstel), Z2(103-120 Basis), Z3(120-138 Aeroob), Z4(138-155 Drempel), Z5(155-172 VO2max)
DOEL: 1/4 triatlon op 13 juni 2026, finish onder 3 uur
DAGEN TOT WEDSTRIJD: ${daysUntilRace}
${phaseAdvice}
${blockedText}${preferencesText}${previousPlanText}${performanceText}
REGELS:
- Geblokkeerde dagen MOETEN rustdagen zijn (sport:"rust", type:"rust", isRestDay:true)
- Respecteer de dagvoorkeuren van de atleet (tijdstippen, specifieke sporten)
- Bouw voort op het vorige schema: verhoog geleidelijk duur (+5-10%) of intensiteit
- Als training load hoog/overbelast is: verminder volume, meer herstel
- Als check-in gevoelens laag (1-2): pas aan naar minder intensief
- Balanceer zwemmen/fietsen/hardlopen over de week
- Minimaal 1 brick-sessie (fietsen+lopen) per 2 weken
- Maximaal 2 sessies per dag
- Descriptions in het Nederlands

${JSON_FORMAT_SPEC}`;

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: 'Genereer het trainingsschema.' }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const result = parseAndValidate(text);

    if (!result.valid) {
      return NextResponse.json({ error: `Validatie mislukt: ${result.errors.join(', ')}` }, { status: 422 });
    }
    return NextResponse.json({ plan: result.plan });
  } catch (error) {
    console.error('Generate plan error:', error);
    return NextResponse.json({ error: 'Er ging iets mis bij het genereren van het schema' }, { status: 500 });
  }
}
