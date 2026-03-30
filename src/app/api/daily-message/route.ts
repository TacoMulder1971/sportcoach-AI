import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY niet geconfigureerd' }, { status: 500 });
    }

    const { todayTraining, yesterdayTraining, yesterdayCheckOut, garminHealth, garminActivities, trainingLoad, readiness, daysUntilRace, weekNumber, dayInCycle, localDateTime } = await request.json();

    // Gebruik Amsterdam tijdzone direct op de server (betrouwbaarder dan client localDateTime)
    const now = new Date();
    const hours = parseInt(new Intl.DateTimeFormat('nl-NL', {
      timeZone: 'Europe/Amsterdam', hour: 'numeric', hour12: false
    }).format(now), 10);
    const minutes = parseInt(new Intl.DateTimeFormat('nl-NL', {
      timeZone: 'Europe/Amsterdam', minute: 'numeric'
    }).format(now), 10);
    const timeStr = `${hours}:${minutes.toString().padStart(2, '0')}`;
    const dagdeel = hours < 12 ? 'ochtend' : hours < 17 ? 'middag' : 'avond';
    const days = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
    const amsterdamDate = new Date(now.toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' }));
    const dayName = days[amsterdamDate.getDay()];
    const dateStr = now.toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'long', year: 'numeric' });

    // Bouw de prompt op
    let prompt = `Je bent My Sport Coach AI. Genereer een kort, persoonlijk dagbericht voor de atleet (3-5 zinnen).
Spreek informeel (je/jij), wees warm en motiverend. Geen emojis in lopende tekst, alleen eventueel aan het begin.
BELANGRIJK: Het is nu ${timeStr} (${dagdeel}). Pas je begroeting aan: gebruik "goedemorgen" alleen 's ochtends, "goedemiddag" 's middags, "goedenavond" 's avonds.

ATLEET: Traint voor 1/4 triatlon op 13 juni 2026 (nog ${daysUntilRace} dagen). Doel: onder 3 uur.

VANDAAG: ${dayName} ${dateStr}, week ${weekNumber} van de cyclus (dag ${dayInCycle}/14).\n`;

    // Training van vandaag
    const isRestDay = !todayTraining || todayTraining.isRestDay;
    if (!isRestDay) {
      prompt += `\nTRAINING VANDAAG:\n`;
      for (const s of todayTraining.sessions) {
        prompt += `- ${s.sport} ${s.type}: ${s.durationMinutes}min in ${s.zone}\n`;
      }
    } else {
      prompt += `\nVANDAAG: Rustdag — herstel staat centraal. Geen geplande training.\n`;
    }

    // Recap laatste check-out — met correcte datum-labeling
    if (yesterdayCheckOut) {
      const amsterdamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(now);
      const checkOutDate = yesterdayCheckOut.date; // "2026-03-26"
      const todayDateObj = new Date(amsterdamToday);
      const checkOutDateObj = new Date(checkOutDate);
      const daysAgo = Math.round((todayDateObj.getTime() - checkOutDateObj.getTime()) / 86400000);
      const checkOutDayName = days[checkOutDateObj.getDay()];
      const checkOutDateNl = checkOutDateObj.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' });

      let checkOutLabel: string;
      if (daysAgo <= 1) {
        checkOutLabel = 'GISTEREN (recap)';
      } else {
        checkOutLabel = `LAATSTE CHECK-OUT (${checkOutDayName} ${checkOutDateNl}, ${daysAgo} dagen geleden)`;
      }

      prompt += `\n${checkOutLabel}:\n`;
      const gisterenWasRust = !yesterdayCheckOut.trainingDay || yesterdayCheckOut.trainingDay === 'Rustdag';
      prompt += `- ${gisterenWasRust ? 'Rustdag' : `Training: ${yesterdayCheckOut.trainingDay}`}\n`;
      prompt += `- Gevoel: ${yesterdayCheckOut.feeling}/5`;
      if (yesterdayCheckOut.note) prompt += ` - "${yesterdayCheckOut.note}"`;
      prompt += '\n';

      if (daysAgo > 1) {
        prompt += `BELANGRIJK: Er zaten ${daysAgo - 1} dag(en) zonder check-out. Houd rekening met de gap — de atleet heeft mogelijk ook in die periode getraind (zie Garmin-activiteiten).\n`;
      }

      const lastCoachMsg = yesterdayCheckOut.messages?.filter((m: { role: string }) => m.role === 'assistant').slice(-1)[0];
      if (lastCoachMsg) {
        prompt += `- Conclusie coach destijds: "${lastCoachMsg.content.substring(0, 200)}"\n`;
      }
    } else {
      prompt += `\nGEEN CHECK-OUT DATA beschikbaar. Baseer je bericht alleen op Garmin en het schema.\n`;
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
        const actDayName = days[new Date(a.date).getDay()];
        prompt += `- ${a.activityName} (${actDayName} ${a.date}${a.startTime ? ` om ${a.startTime}` : ''}): ${a.durationMinutes}min`;
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

    // Detecteer afwijking van schema
    if (garminActivities && garminActivities.length > 0) {
      const amsterdamToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(now);
      const yesterdayDate = new Date(now);
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const amsterdamYesterday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(yesterdayDate);

      const gisterenActiviteiten = garminActivities.filter((a: { date: string }) => a.date === amsterdamYesterday);
      const vandaagActiviteiten = garminActivities.filter((a: { date: string }) => a.date === amsterdamToday);

      const deviations: string[] = [];

      // Gisteren training gepland maar geen activiteit geregistreerd?
      if (yesterdayTraining && !yesterdayTraining.isRestDay && gisterenActiviteiten.length === 0) {
        const sports = yesterdayTraining.sessions?.map((s: { sport: string }) => s.sport).join('/') ?? 'training';
        deviations.push(`Gisteren stond ${sports} gepland maar er is geen activiteit in Garmin geregistreerd.`);
      }

      // Vandaag al getraind terwijl de dag nog niet begonnen lijkt (schema niet afgevinkt)?
      if (!isRestDay && vandaagActiviteiten.length > 0) {
        const names = vandaagActiviteiten.map((a: { activityName: string }) => a.activityName).join(', ');
        deviations.push(`Vandaag is al een activiteit geregistreerd: ${names}. Vergeet niet in te checken.`);
      }

      if (deviations.length > 0) {
        prompt += `\nSCHEMA-AFWIJKING GEDETECTEERD:\n`;
        for (const d of deviations) prompt += `- ${d}\n`;
        prompt += `Benoem dit vriendelijk. Als er trainingen zijn verschoven, stel dan voor of het schema aangepast moet worden.\n`;
      }
    }

    // Load & readiness
    if (trainingLoad) {
      prompt += `\nTRAINING LOAD: ${trainingLoad.weekLoad} TRIMP (${trainingLoad.status})\n`;
    }
    if (readiness) {
      prompt += `GEREEDHEID: ${readiness.score}/9 - ${readiness.label}\n`;
    }

    // Instructies voor afwisseling
    const trainingTopics = ['techniek', 'voeding/hydratatie', 'mentale kracht', 'motivatie', 'wedstrijdvoorbereiding', 'pacing-strategie'];
    const restTopics = ['slaap en herstel', 'voeding op rustdagen', 'mobiliteit/stretching', 'mentale rust', 'hydratatie'];
    const topicIndex = now.getDate() % (isRestDay ? restTopics.length : trainingTopics.length);
    const topic = isRestDay ? restTopics[topicIndex] : trainingTopics[topicIndex];
    prompt += `\nVERPLICHT ONDERWERP VOOR TIP: ${topic}.`;

    if (isRestDay) {
      prompt += `\n\nSTRUCTUUR (RUSTDAG):
1. Erken kort dat het een rustdag is — positief framen als bewuste keuze voor herstel
2. Verwijs eventueel naar gisteren (als er data is): was het zwaar, is rust nu logisch?
3. Geef een concrete tip over "${topic}" die past bij een rustdag
4. Als er een schema-afwijking is: benoem het vriendelijk en stel voor of het schema aangepast moet worden
BELANGRIJK: Geef GEEN aansporing om te trainen. Rust IS de training vandaag.
Houd het bij 3-5 zinnen totaal. Niet meer.`;
    } else {
      prompt += `\n\nSTRUCTUUR (TRAININGSDAG):
1. Begin met een recap van gisteren (als er data is)
2. Benoem kort wat vandaag op het programma staat
3. Geef een korte, concrete tip over "${topic}"
4. Als er een schema-afwijking is: benoem het vriendelijk en stel voor of aanpassing nodig is (bijv. "wil je dat ik het schema aanpas?")
Houd het bij 3-5 zinnen totaal. Niet meer.`;
    }

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
