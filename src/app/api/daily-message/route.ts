import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY niet geconfigureerd' }, { status: 500 });
    }

    const { todayTraining, yesterdayCheckOut, garminHealth, garminActivities, trainingLoad, readiness, daysUntilRace, weekNumber, dayInCycle, localDateTime } = await request.json();

    // Gebruik lokale tijd van de gebruiker (Amsterdam), niet UTC van de server
    const now = localDateTime ? new Date(localDateTime) : new Date();
    const localNow = new Date(now.toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' }));
    const days = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
    const dayName = days[localNow.getDay()];
    const dateStr = localNow.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });

    const hours = localNow.getHours();
    const timeStr = `${hours}:${localNow.getMinutes().toString().padStart(2, '0')}`;
    const dagdeel = hours < 12 ? 'ochtend' : hours < 17 ? 'middag' : 'avond';

    // Bouw de prompt op
    let prompt = `Je bent My Sport Coach AI. Genereer een kort, persoonlijk dagbericht voor de atleet (3-5 zinnen).
Spreek informeel (je/jij), wees warm en motiverend. Geen emojis in lopende tekst, alleen eventueel aan het begin.
BELANGRIJK: Het is nu ${timeStr} (${dagdeel}). Pas je begroeting aan: gebruik "goedemorgen" alleen 's ochtends, "goedemiddag" 's middags, "goedenavond" 's avonds.

ATLEET: Traint voor 1/4 triatlon op 13 juni 2026 (nog ${daysUntilRace} dagen). Doel: onder 3 uur.

VANDAAG: ${dayName} ${dateStr}, week ${weekNumber} van de cyclus (dag ${dayInCycle}/14).\n`;

    // Training van vandaag
    if (todayTraining && !todayTraining.isRestDay) {
      prompt += `\nTRAINING VANDAAG:\n`;
      for (const s of todayTraining.sessions) {
        prompt += `- ${s.sport} ${s.type}: ${s.durationMinutes}min in ${s.zone}\n`;
      }
    } else {
      prompt += `\nVANDAAG: Rustdag\n`;
    }

    // Recap gisteren
    if (yesterdayCheckOut) {
      prompt += `\nGISTEREN (recap):\n`;
      prompt += `- Training: ${yesterdayCheckOut.trainingDay}\n`;
      prompt += `- Gevoel: ${yesterdayCheckOut.feeling}/5`;
      if (yesterdayCheckOut.note) prompt += ` - "${yesterdayCheckOut.note}"`;
      prompt += '\n';
      // Laatste coach-bericht uit gesprek
      const lastCoachMsg = yesterdayCheckOut.messages?.filter((m: { role: string }) => m.role === 'assistant').slice(-1)[0];
      if (lastCoachMsg) {
        prompt += `- Conclusie coach: "${lastCoachMsg.content.substring(0, 200)}"\n`;
      }
    } else {
      prompt += `\nGISTEREN: Geen check-out data beschikbaar.\n`;
    }

    // Garmin data
    if (garminHealth) {
      prompt += `\nGEZONDHEID:\n`;
      if (garminHealth.sleepScore > 0) prompt += `- Slaap: ${garminHealth.sleepDurationHours}u (score ${garminHealth.sleepScore}/100)\n`;
      prompt += `- Rust HR: ${garminHealth.restingHR} bpm\n`;
      if (garminHealth.avgOvernightHrv > 0) prompt += `- HRV: ${garminHealth.avgOvernightHrv}ms\n`;
      prompt += `- Body Battery: ${garminHealth.bodyBatteryChange > 0 ? '+' : ''}${garminHealth.bodyBatteryChange}\n`;
    }

    if (garminActivities && garminActivities.length > 0) {
      prompt += `\nRECENTE ACTIVITEITEN:\n`;
      for (const a of garminActivities.slice(0, 3)) {
        prompt += `- ${a.activityName} (${a.date}): ${a.durationMinutes}min`;
        if (a.distanceKm > 0) prompt += `, ${a.distanceKm}km`;
        if (a.avgPace) prompt += `, tempo ${a.avgPace}`;
        if (a.avgHR > 0) prompt += `, gem HR ${a.avgHR}`;
        if (a.maxHR > 0) prompt += `, max HR ${a.maxHR}`;
        if (a.trainingEffectAerobic > 0) prompt += `, TE aerobic ${a.trainingEffectAerobic}/5`;
        if (a.trainingEffectAnaerobic > 0) prompt += `, TE anaerobic ${a.trainingEffectAnaerobic}/5`;
        if (a.elevationGain > 0) prompt += `, ${a.elevationGain}m stijging`;
        if (a.avgRunCadence > 0) prompt += `, cadans ${a.avgRunCadence} spm`;
        if (a.avgBikeCadence > 0) prompt += `, cadans ${a.avgBikeCadence} rpm`;
        prompt += `, ${a.calories} kcal\n`;
        if (a.hrZones && a.hrZones.length > 0) {
          prompt += `  HR zone verdeling: ${a.hrZones.map((z: { zone: string; minutes: number }) => `${z.zone}: ${z.minutes}min`).join(', ')}\n`;
        }
      }
      prompt += 'Gebruik deze gedetailleerde data (incl. zone-verdeling) voor specifiek, inhoudelijk advies.\n';
    }

    // Load & readiness
    if (trainingLoad) {
      prompt += `\nTRAINING LOAD: ${trainingLoad.weekLoad} TRIMP (${trainingLoad.status})\n`;
    }
    if (readiness) {
      prompt += `GEREEDHEID: ${readiness.score}/9 - ${readiness.label}\n`;
    }

    // Instructies voor afwisseling
    const topics = ['techniek', 'voeding/hydratatie', 'herstel', 'mentale kracht', 'motivatie', 'wedstrijdvoorbereiding'];
    const topicIndex = now.getDate() % topics.length;
    prompt += `\nVERPLICHT ONDERWERP VOOR TIP: ${topics[topicIndex]}. Wissel af met andere onderwerpen op andere dagen.`;

    prompt += `\n\nSTRUCTUUR:
1. Begin met een recap van gisteren (als er data is)
2. Benoem kort wat vandaag op het programma staat
3. Geef een korte, concrete tip over "${topics[topicIndex]}"
Houd het bij 3-5 zinnen totaal. Niet meer.`;

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';

    return NextResponse.json({ message: content });
  } catch (error) {
    console.error('Daily message API error:', error);
    return NextResponse.json({ error: 'Kon dagbericht niet genereren' }, { status: 500 });
  }
}
