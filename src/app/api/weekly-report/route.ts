import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY niet geconfigureerd' }, { status: 500 });
    }

    const {
      weeklyTRIMP,
      checkIns,
      currentPhase,
      daysUntilRace,
      totalVolumeMinutes,
      totalVolumeKm,
      weeklyNutrition,
    } = await request.json();

    let prompt = `Je bent My Sport Coach AI. Schrijf een beknopt wekelijks trainingsrapport in het Nederlands (6-8 zinnen).
Spreek de atleet informeel aan (je/jij). Wees concreet en op data gebaseerd. Geen emojis.

WEDSTRIJD: 1/4 triatlon op 13 juni 2026, nog ${daysUntilRace} dagen. Doel: onder 3 uur.
HUIDIGE FASE: ${currentPhase}\n`;

    if (totalVolumeMinutes > 0 || totalVolumeKm > 0) {
      prompt += `\nDEZE WEEK:
- Totaal volume: ${totalVolumeMinutes} minuten`;
      if (totalVolumeKm > 0) prompt += `, ${totalVolumeKm.toFixed(1)} km`;
      prompt += '\n';
    }

    if (weeklyTRIMP && weeklyTRIMP.length > 0) {
      prompt += `\nTRIMP TREND (laatste weken, TRIMP = trainingsbelasting):\n`;
      for (const w of weeklyTRIMP) {
        prompt += `- Week van ${w.weekLabel}: ${w.trimp} TRIMP\n`;
      }
      const trimpValues = weeklyTRIMP.map((w: { trimp: number }) => w.trimp);
      const last = trimpValues[trimpValues.length - 1];
      const prev = trimpValues[trimpValues.length - 2];
      if (prev > 0) {
        const trend = last > prev * 1.1 ? 'stijgend' : last < prev * 0.9 ? 'dalend' : 'stabiel';
        prompt += `Trend: ${trend} (vorige week ${prev}, deze week ${last})\n`;
      }
    }

    if (checkIns && checkIns.length > 0) {
      prompt += `\nCHECK-INS DEZE WEEK:\n`;
      for (const ci of checkIns.slice(-7)) {
        prompt += `- ${ci.date}: gevoel ${ci.feeling}/5`;
        if (ci.note) prompt += ` — "${ci.note}"`;
        prompt += '\n';
      }
      const avgFeeling = checkIns.slice(-7).reduce((s: number, c: { feeling: number }) => s + c.feeling, 0) / Math.min(checkIns.length, 7);
      prompt += `Gemiddeld gevoel deze week: ${avgFeeling.toFixed(1)}/5\n`;
    }

    if (weeklyNutrition && weeklyNutrition.length > 0) {
      const avgCal = Math.round(weeklyNutrition.reduce((s: number, n: { calories: number }) => s + n.calories, 0) / weeklyNutrition.length);
      const avgCarbs = Math.round(weeklyNutrition.reduce((s: number, n: { carbsG: number }) => s + n.carbsG, 0) / weeklyNutrition.length);
      const avgProtein = Math.round(weeklyNutrition.reduce((s: number, n: { proteinG: number }) => s + n.proteinG, 0) / weeklyNutrition.length);
      const lowCalDays = weeklyNutrition.filter((n: { calories: number }) => n.calories < 1500).length;
      prompt += `\nVOEDING DEZE WEEK (${weeklyNutrition.length} dagen geregistreerd):
- Gemiddeld: ${avgCal} kcal | KH: ${avgCarbs}g | Eiwit: ${avgProtein}g
${lowCalDays > 0 ? `- Waarschuwing: ${lowCalDays} dag(en) met minder dan 1500 kcal\n` : ''}`;
    }

    prompt += `
STRUCTUUR VAN HET RAPPORT:
1. Kort overzicht van het trainingsvolume en de belasting (TRIMP)
2. Bespreek de belastingtrend (stijgend/dalend/stabiel) en wat dat betekent
3. Noem 1-2 concrete hoogtepunten of aandachtspunten uit de check-ins
${weeklyNutrition && weeklyNutrition.length > 0 ? '4. Geef 1-2 zinnen voedingsfeedback: zijn calorieën/koolhydraten/eiwit passend bij het trainingsvolume? Geef een concreet verbeterpunt.\n5.' : '4.'} Sluit af met één concrete focus voor de komende week, passend bij de ${currentPhase}
Houd het bij 7-9 zinnen totaal. Geen opsommingstekens, gewone tekst.`;

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });

    const report = response.content[0].type === 'text' ? response.content[0].text : '';

    return NextResponse.json({ report });
  } catch (error) {
    console.error('Weekly report API error:', error);
    return NextResponse.json({ error: 'Kon weekrapport niet genereren' }, { status: 500 });
  }
}
