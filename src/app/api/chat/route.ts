import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const BASE_PROMPT = `Je bent My Sport Coach AI, een persoonlijke trainingscoach voor triatlon. Je spreekt Nederlands.

ATLEET PROFIEL:
- Traint voor een 1/4 triatlon op 13 juni 2026
- Doel: onder de 3 uur finishen
- Max hartslag: 172 bpm
- Hartslagzones: Z1 (86-103 Herstel), Z2 (103-120 Basis), Z3 (120-138 Aeroob), Z4 (138-155 Drempel), Z5 (155-172 VO2max)

JE TAKEN:
1. Geef concreet, praktisch trainingsadvies
2. Pas het schema aan als de atleet moe is, slecht slaapt, of zich niet goed voelt
3. Stel verdiepende vragen als informatie onduidelijk is
4. Geef motiverende berichten afgestemd op de fase in de training
5. Herken brick-sessies (fietsen direct gevolgd door lopen)
6. Let op periodisering: opbouw-, piek- en taperfase
7. Wees kort en to-the-point, maar warm en motiverend
8. Als de atleet check-out data deelt, gebruik die om je advies aan te passen

STIJL:
- Spreek de atleet informeel aan (je/jij)
- Gebruik concrete tijden, afstanden en zones
- Geef maximaal 1-2 alinea's antwoord tenzij meer detail gevraagd wordt
- Gebruik geen emojis in lopende tekst, alleen aan het begin van een bericht als het past`;

function buildPlanText(plan: { weekNumber: number; label: string; days: { day: string; isRestDay: boolean; sessions: { sport: string; type: string; durationMinutes?: number; zone?: string; description: string }[] }[] }[]): string {
  let text = '\nTRAININGSSCHEMA (2-weekse cyclus):\n';
  for (const week of plan) {
    text += `${week.label}:\n`;
    for (const day of week.days) {
      if (day.isRestDay) {
        text += `- ${day.day}: Rust\n`;
      } else {
        const parts = day.sessions.map((s) =>
          `${s.sport} ${s.type} (${s.durationMinutes}min ${s.zone || ''})`
        );
        text += `- ${day.day}: ${parts.join(' + ')}\n`;
      }
    }
    text += '\n';
  }
  return text;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY niet geconfigureerd' },
        { status: 500 }
      );
    }

    const {
      messages, checkIns, garminData, trainingLoad, currentPlan, cycleStartDate,
      weeklyTRIMP, currentPhase, daysUntilRace: daysUntilRaceBody, avgFeeling, recentNotes, todayNutrition, localDateTime,
    } = await request.json();

    // Bouw schema tekst dynamisch
    let planText = '';
    if (currentPlan && Array.isArray(currentPlan) && currentPlan.length === 2) {
      planText = buildPlanText(currentPlan);
    } else {
      // Fallback naar hardcoded tekst
      planText = `\nTRAININGSSCHEMA (2-weekse cyclus):
Week 1:
- Ma: Zwemmen techniek (45min Z3) + Fietsen herstel (45min Z2)
- Di: Hardlopen interval (50min Z4) - 6x 800m met 2 min rust
- Wo: Rust
- Do: Hardlopen duur (60min Z3)
- Vr: Zwemmen tempo/techniek (45min Z4)
- Za: Hardlopen rustig (45min Z2)
- Zo: Fietsen lang (90-120min Z3) + Brick run (20-30min Z3)

Week 2:
- Ma: Zwemmen techniek (45min Z3) + Fietsen herstel (45min Z2)
- Di: Hardlopen tempo (50min Z4)
- Wo: Rust
- Do: Hardlopen duur (65min Z3)
- Vr: Zwemmen duur (50min Z3)
- Za: Mountainbike (60min Z3)
- Zo: Zwemmen (40min Z3) + Hardlopen duur (50min Z3)\n`;
    }

    // Add current date/time context — gebruik lokale tijd van de gebruiker (Amsterdam)
    const rawNow = localDateTime ? new Date(localDateTime) : new Date();
    const now = new Date(rawNow.toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' }));
    const days = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
    const dateStr = now.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    const dayName = days[now.getDay()];

    // Determine current week in cycle
    const startStr = cycleStartDate || '2026-02-23';
    const startDate = new Date(startStr);
    const diffDays = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const weekNum = Math.floor(diffDays / 7) % 2 === 0 ? 1 : 2;

    const daysUntilRace = Math.ceil((new Date('2026-06-13').getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    let contextMessage = `\n\nHUIDIGE CONTEXT:\n- Datum: ${dayName} ${dateStr}\n- Tijd: ${timeStr}\n- Week in cyclus: Week ${weekNum}\n- Dagen tot wedstrijd: ${daysUntilRace}\n`;

    // Build context with check-in data
    if (checkIns && checkIns.length > 0) {
      contextMessage += '\nRECENTE CHECK-INS VAN DE ATLEET:\n';
      for (const ci of checkIns) {
        contextMessage += `- ${ci.date} (${ci.trainingDay}): Gevoel ${ci.feeling}/5`;
        if (ci.note) contextMessage += ` - "${ci.note}"`;
        contextMessage += '\n';
      }
    }

    // Add Garmin data context
    if (garminData) {
      if (garminData.health) {
        const h = garminData.health;
        contextMessage += `\nGARMIN GEZONDHEIDSDATA (${h.date}):\n`;
        contextMessage += `- Slaap: ${h.sleepDurationHours} uur (score: ${h.sleepScore}/100)\n`;
        contextMessage += `- Diepe slaap: ${h.deepSleepMinutes} min, REM: ${h.remSleepMinutes} min\n`;
        contextMessage += `- HRV: ${h.avgOvernightHrv} ms (status: ${h.hrvStatus})\n`;
        contextMessage += `- Rust hartslag: ${h.restingHR} bpm\n`;
        contextMessage += `- Body Battery verandering: ${h.bodyBatteryChange > 0 ? '+' : ''}${h.bodyBatteryChange}\n`;
        contextMessage += `- Stappen: ${h.steps}\n`;
      }
      if (garminData.activities && garminData.activities.length > 0) {
        contextMessage += '\nRECENTE GARMIN ACTIVITEITEN:\n';
        for (const a of garminData.activities.slice(0, 14)) {
          contextMessage += `- ${a.date}: ${a.activityName} (${a.sport}) - ${a.durationMinutes}min`;
          if (a.distanceKm > 0) contextMessage += `, ${a.distanceKm}km`;
          if (a.avgHR > 0) contextMessage += `, gem HR ${a.avgHR}, max HR ${a.maxHR}`;
          if (a.hrZones && a.hrZones.length > 0) {
            contextMessage += ` | zones: ${a.hrZones.map((z: { zone: string; minutes: number }) => `${z.zone}: ${z.minutes}min`).join(', ')}`;
          }
          contextMessage += '\n';
        }
      }
    }

    // Add Training Load context
    if (trainingLoad) {
      contextMessage += `\nTRAINING LOAD (TRIMP, 7 dagen):\n`;
      contextMessage += `- Weekbelasting: ${trainingLoad.weekLoad} TRIMP\n`;
      contextMessage += `- Status: ${trainingLoad.status}\n`;
      contextMessage += `- Advies: ${trainingLoad.advice}\n`;
    }

    // Trainingsfase
    if (currentPhase) {
      contextMessage += `\nTRAININGSFASE: ${currentPhase.label} (nog ${daysUntilRaceBody} dagen tot wedstrijd)\n`;
    }

    // 4-weekse TRIMP-trend
    if (weeklyTRIMP && weeklyTRIMP.length > 0) {
      contextMessage += `\nTRIMP TREND (weekbelasting, laatste 4 weken):\n`;
      for (const w of weeklyTRIMP) {
        contextMessage += `- Week van ${w.weekLabel}: ${w.trimp} TRIMP\n`;
      }
    }

    // Gemiddeld gevoel
    if (avgFeeling !== null && avgFeeling !== undefined) {
      contextMessage += `\nGEMIDDELD GEVOEL AFGELOPEN 4 WEKEN: ${avgFeeling}/5\n`;
    }

    // Recente notities
    if (recentNotes && recentNotes.length > 0) {
      contextMessage += `\nRECENTE NOTITIES ATLEET:\n`;
      for (const n of recentNotes) {
        contextMessage += `- ${n.date} (gevoel ${n.feeling}/5): "${n.note}"\n`;
      }
    }

    // Voeding van vandaag
    if (todayNutrition) {
      contextMessage += `\nVOEDING VANDAAG: ${todayNutrition.calories} kcal | KH: ${todayNutrition.carbsG}g | Eiwit: ${todayNutrition.proteinG}g | Vet: ${todayNutrition.fatG}g\n`;
    }

    const fullSystemPrompt = BASE_PROMPT + planText + contextMessage;

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: fullSystemPrompt,
      messages: messages.slice(-20),
    });

    const content =
      response.content[0].type === 'text' ? response.content[0].text : '';

    return NextResponse.json({ content });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Er ging iets mis met de AI coach' },
      { status: 500 }
    );
  }
}
