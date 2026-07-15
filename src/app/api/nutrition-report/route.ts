import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 30; // Opus-rapport kan langer duren dan de standaard 10s

interface DayPayload {
  date: string;
  dayLabel: string;
  intake: { calories: number; carbsG: number; proteinG: number; fatG: number } | null;
  trainingMinutes: number;
  trainingKcal: number;
  sports: string[];
  estimatedNeedKcal: number | null;
  balanceKcal: number | null;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY niet geconfigureerd' }, { status: 500 });
    }

    const { week, raceContext, athleteProfile } = await request.json();
    if (!week || !Array.isArray(week.days) || week.daysLogged === 0) {
      return NextResponse.json({ error: 'Geen voedingsdata voor deze week' }, { status: 400 });
    }

    let prompt = `Je bent de voedingscoach van een duursporter. Schrijf een beknopt wekelijks voedingsrapport in het Nederlands (6-8 zinnen).
De kernvraag is: EET DE ATLEET GENOEG voor de trainingsbelasting? Spreek informeel aan (je/jij), wees concreet en op data gebaseerd. Geen emojis, geen opsommingstekens, geen markdown (geen #-koppen, geen sterretjes), geen titel — begin direct met de eerste zin.

`;

    if (athleteProfile) {
      const parts: string[] = [];
      if (athleteProfile.weightKg) parts.push(`${athleteProfile.weightKg} kg`);
      if (athleteProfile.heightCm) parts.push(`${athleteProfile.heightCm} cm`);
      if (athleteProfile.gender) parts.push(athleteProfile.gender);
      if (athleteProfile.birthYear) parts.push(`geboren ${athleteProfile.birthYear}`);
      if (parts.length > 0) prompt += `ATLEET: ${parts.join(', ')}\n`;
    }
    if (week.bmrKcal) {
      prompt += `GESCHAT RUSTMETABOLISME (BMR): ${week.bmrKcal} kcal; dagelijkse behoefte = BMR × 1,4 + trainingsverbranding.\n`;
    }
    if (raceContext) prompt += `WEDSTRIJDCONTEXT: ${raceContext}\n`;

    prompt += `\nAFGELOPEN 7 DAGEN (per dag: inname | training | geschatte behoefte | balans):\n`;
    for (const d of week.days as DayPayload[]) {
      prompt += `- ${d.dayLabel} ${d.date}: `;
      prompt += d.intake
        ? `${d.intake.calories} kcal (KH ${d.intake.carbsG}g, eiwit ${d.intake.proteinG}g, vet ${d.intake.fatG}g)`
        : 'niet gelogd';
      prompt += d.trainingMinutes > 0
        ? ` | training: ${d.sports.join('+')} ${d.trainingMinutes} min, ~${d.trainingKcal} kcal verbrand`
        : ' | rustdag';
      if (d.estimatedNeedKcal !== null) prompt += ` | behoefte ~${d.estimatedNeedKcal} kcal`;
      if (d.balanceKcal !== null) prompt += ` | balans ${d.balanceKcal > 0 ? '+' : ''}${d.balanceKcal} kcal`;
      prompt += '\n';
    }

    prompt += `\nWEEKGEMIDDELDEN (over ${week.daysLogged} gelogde dagen):
- Inname: ${week.avgIntakeKcal} kcal | KH: ${week.avgCarbsG}g | Eiwit: ${week.avgProteinG}g | Vet: ${week.avgFatG}g`;
    if (week.avgNeedKcal !== null) prompt += `\n- Geschatte behoefte: ${week.avgNeedKcal} kcal/dag`;
    if (week.avgBalanceKcal !== null) prompt += `\n- Gemiddelde energiebalans: ${week.avgBalanceKcal > 0 ? '+' : ''}${week.avgBalanceKcal} kcal/dag`;
    if (week.proteinPerKg !== null) prompt += `\n- Eiwit per kg lichaamsgewicht: ${week.proteinPerKg} g/kg (richtlijn duursporter: 1,6-2,0 g/kg)`;
    if (week.shortfallDays > 0) prompt += `\n- ${week.shortfallDays} dag(en) duidelijk onder de behoefte`;
    prompt += `\n- Totale trainingstijd: ${week.totalTrainingMinutes} min, gem. ${week.avgTrainingKcal} kcal/dag verbrand met trainen\n`;

    if (week.daysLogged < 7) {
      prompt += `\nLET OP: maar ${week.daysLogged} van de 7 dagen gelogd — benoem kort dat vollediger loggen het beeld betrouwbaarder maakt.\n`;
    }
    if (week.avgNeedKcal === null) {
      prompt += `\nLET OP: er is geen gewicht/lengte bekend, dus de energiebehoefte is niet persoonlijk berekend — beoordeel op basis van inname vs. trainingsverbranding en algemene richtlijnen.\n`;
    }

    prompt += `
STRUCTUUR VAN HET RAPPORT:
1. Direct antwoord op de kernvraag: eet je genoeg voor deze trainingsweek? (te weinig / voldoende / ruim)
2. Benoem de balans op de zwaarste trainingsdag(en) — daar knelt het het eerst.
3. Beoordeel eiwit (herstel) en koolhydraten (energie voor trainingen) concreet met de getallen.
4. Sluit af met 1-2 concrete, praktische acties voor komende week (bijv. wat toevoegen op trainingsdagen).
Houd het bij 6-8 zinnen, gewone tekst.`;

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text : '';
    // Vangnet: markdown-koppen en vetmarkering eruit, mocht het model ze toch gebruiken
    const report = raw
      .replace(/^#+\s.*$/gm, '')
      .replace(/\*\*/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return NextResponse.json({ report });
  } catch (error) {
    console.error('Nutrition report API error:', error);
    return NextResponse.json({ error: 'Kon voedingsrapport niet genereren' }, { status: 500 });
  }
}
