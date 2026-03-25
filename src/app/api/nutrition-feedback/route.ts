import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'API key ontbreekt' }, { status: 500 });

    const { nutritionLog, todayTraining, garminHealth, daysUntilRace } = await request.json();
    if (!nutritionLog) return NextResponse.json({ error: 'Geen voedingsdata' }, { status: 400 });

    const client = new Anthropic({ apiKey });

    let prompt = `Je bent een triathlon voedingscoach. Geef in 2-4 zinnen concrete feedback op de voeding van vandaag.
Focus op: timing rond training, koolhydraten voor energie, eiwit voor herstel, hydratatie. Wees direct en praktisch.
Spreek informeel (je/jij). Geen opsommingen, gewone zinnen.

VOEDING VANDAAG:
- Calorieën: ${nutritionLog.calories} kcal
- Koolhydraten: ${nutritionLog.carbsG}g
- Eiwit: ${nutritionLog.proteinG}g
- Vet: ${nutritionLog.fatG}g
- Vezels: ${nutritionLog.fiberG}g\n`;

    if (todayTraining && !todayTraining.isRestDay) {
      prompt += `\nTRAINING VANDAAG:\n`;
      for (const s of todayTraining.sessions) {
        prompt += `- ${s.sport} ${s.type}: ${s.durationMinutes}min in ${s.zone}\n`;
      }
    } else {
      prompt += `\nVANDAAG: Rustdag of geen training gepland.\n`;
    }

    if (garminHealth?.sleepDurationHours) {
      prompt += `\nSLAAP: ${garminHealth.sleepDurationHours}u, HRV: ${garminHealth.avgOvernightHrv || '?'}ms\n`;
    }

    prompt += `\nNog ${daysUntilRace} dagen tot de wedstrijd (1/4 triatlon, doel <3 uur).`;

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const feedback = response.content[0].type === 'text' ? response.content[0].text : '';
    return NextResponse.json({ feedback });
  } catch (error) {
    console.error('Nutrition feedback error:', error);
    return NextResponse.json({ error: 'Kon geen feedback genereren' }, { status: 500 });
  }
}
