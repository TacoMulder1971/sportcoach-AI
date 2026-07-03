import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 30; // Opus-evaluatie kan langer duren dan de standaard 10s

interface EvalSplit {
  label: string;
  timeSeconds: number;
  distanceKm?: number;
  avgHR?: number;
  pace?: string;
}

function fmtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY niet geconfigureerd' }, { status: 500 });
    }

    const {
      goal,        // { name, typeLabel, date, targetTimeSeconds?, disciplineDistancesKm?, note? }
      result,      // { totalTimeSeconds, rating, timeReflection, trainingReflection }
      splits,      // EvalSplit[] — uit Garmin-activiteit of handmatig resultaat
      buildup,     // { totalSessions, totalMinutes, totalKm, totalTrimp, avgHR, spanWeeks, weeklyTrimp: {label, value}[], bySport: {label, sessions, minutes, km}[] } | null
      goalsHistory,// eerdere races (tekst)
    } = await request.json();

    if (!goal || !result) {
      return NextResponse.json({ error: 'Doel en resultaat zijn verplicht' }, { status: 400 });
    }

    let prompt = `Je bent My Sport Coach AI, de persoonlijke trainingscoach van deze duursporter. De atleet heeft net het resultaat van een wedstrijd ingevuld. Schrijf een korte, persoonlijke race-evaluatie in het Nederlands.

DE WEDSTRIJD:
- ${goal.name} (${goal.typeLabel}) op ${goal.date}
- Eindtijd: ${fmtTime(result.totalTimeSeconds)}${goal.targetTimeSeconds ? `\n- Streeftijd: ${fmtTime(goal.targetTimeSeconds)} (${result.totalTimeSeconds <= goal.targetTimeSeconds ? 'GEHAALD' : `${fmtTime(result.totalTimeSeconds - goal.targetTimeSeconds)} te langzaam`})` : ''}
- Eigen beoordeling atleet: ${result.rating}/5 sterren
`;

    if (result.timeReflection) prompt += `- Reflectie atleet over de tijd: "${result.timeReflection}"\n`;
    if (result.trainingReflection) prompt += `- Reflectie atleet over de voorbereiding: "${result.trainingReflection}"\n`;
    if (goal.note) prompt += `- Notitie bij het doel: "${goal.note}"\n`;

    if (splits && Array.isArray(splits) && splits.length > 0) {
      prompt += `\nSPLITS PER ONDERDEEL:\n`;
      for (const s of splits as EvalSplit[]) {
        prompt += `- ${s.label}: ${fmtTime(s.timeSeconds)}`;
        if (s.distanceKm) prompt += ` (${s.distanceKm} km)`;
        if (s.pace) prompt += `, ${s.pace}`;
        if (s.avgHR) prompt += `, gem HR ${s.avgHR}`;
        prompt += '\n';
      }
    }

    if (buildup && buildup.totalSessions > 0) {
      prompt += `\nDE TRAININGSAANLOOP (${buildup.spanWeeks} weken vóór de race, uit Garmin):
- ${buildup.totalSessions} trainingen, ${Math.round(buildup.totalMinutes / 60)} uur, ${buildup.totalKm} km, ${buildup.totalTrimp} TRIMP totaal${buildup.avgHR > 0 ? `, gem. HR ${buildup.avgHR}` : ''}\n`;
      if (buildup.bySport && buildup.bySport.length > 0) {
        prompt += `- Per sport: ${buildup.bySport.map((s: { label: string; sessions: number; minutes: number; km: number }) => `${s.label} ${s.sessions}× (${Math.round(s.minutes / 60)}u${s.km > 0 ? `, ${Math.round(s.km)}km` : ''})`).join(' | ')}\n`;
      }
      if (buildup.weeklyTrimp && buildup.weeklyTrimp.length > 0) {
        prompt += `- Belasting per week (TRIMP): ${buildup.weeklyTrimp.map((w: { label: string; value: number }) => `${w.label}: ${w.value}`).join(', ')}\n`;
      }
    }

    if (goalsHistory) prompt += `\n${goalsHistory}\n`;

    prompt += `
SCHRIJF DE EVALUATIE ZO:
1. Open met een oprechte, concrete felicitatie of erkenning (1-2 zinnen, passend bij het resultaat en de eigen beoordeling).
2. Wat ging goed — benoem het concreet met cijfers uit de data (splits, tempo, HR, aanloop).
3. Wat viel op of kon beter — eerlijk maar constructief, gekoppeld aan de data en de eigen reflectie van de atleet.
4. Lessen voor de volgende keer — 2 à 3 concrete punten voor de training of racedag.

REGELS:
- Nederlands, informeel (je/jij), warm maar eerlijk.
- Verzin GEEN cijfers; gebruik alleen wat hierboven staat. Ontbreekt data (bv. geen splits), sla dat punt dan over.
- 150-250 woorden, gewone alinea's. Kopjes mogen (vetgedrukt met **), geen emoji's.`;

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const evaluation = response.content[0].type === 'text' ? response.content[0].text : '';
    if (!evaluation) throw new Error('Lege evaluatie');

    return NextResponse.json({ evaluation });
  } catch (error) {
    console.error('Race evaluation API error:', error);
    return NextResponse.json({ error: 'Kon race-evaluatie niet genereren' }, { status: 500 });
  }
}
