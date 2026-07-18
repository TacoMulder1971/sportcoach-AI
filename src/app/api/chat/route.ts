import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getAmsterdamNow, relativeDayLabel, buildTimingRule } from '@/lib/coach-dates';
import { AthleteProfilePayload, buildAthleteProfileText, coachPersona } from '@/lib/athlete';
import { buildHrvCoachText } from '@/lib/training-load';

export const maxDuration = 30; // Opus coach-chat kan langer duren dan de standaard 10s

const BASE_PROMPT_INTRO = `Je bent My Sport Coach AI, een persoonlijke trainingscoach voor duursporters (hardlopen, fietsen, zwemmen, triatlon). Je spreekt Nederlands.

ATLEET PROFIEL:
- Hartslagzones: {{HR_ZONE_TEXT}}

JE TAKEN:
1. Geef concreet, praktisch trainingsadvies afgestemd op het actieve doel
2. Pas het schema aan als de atleet moe is, slecht slaapt, of zich niet goed voelt
3. Stel verdiepende vragen als informatie onduidelijk is
4. Geef motiverende berichten afgestemd op de fase in de training
5. Herken brick-sessies (fietsen direct gevolgd door lopen)
6. Let op periodisering: opbouw-, piek- en taperfase
7. Wees kort en to-the-point, maar warm en motiverend
8. Als de atleet check-out data deelt, gebruik die om je advies aan te passen

DATA-INTEGRITEIT (KRITIEK):
- Verzin NOOIT cijfers (HR-waarden, snelheden, zones, watt, tempo). Gebruik alleen wat letterlijk in de context staat.
- Als de gebruiker een blok "GEVERIFIEERDE FEITEN" of "VERGELIJKING" stuurt: behandel die als waarheid en spreek deze niet tegen.
- Bij multisport-activiteiten: gebruik per onderdeel de splits, niet het totaal-gemiddelde, om over een specifieke sport te oordelen.
- Als data ontbreekt of onduidelijk is: zeg dat eerlijk in plaats van te gokken.
- TIMING: gebruik de [dag-labels] bij activiteiten/check-ins exact. Zeg alleen "vandaag"/"gisteren" als dat label er staat; gebruik anders de weekdag-naam. Gok NOOIT welke dag het is.

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
      raceContext, goalsHistory, equipmentAttention, hrZoneText, athleteProfile, planStrategy,
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

    // Overwegingen van de coach achter het actieve schema — zo blijft advies
    // consistent met de bedoeling van het schema (bv. bewust rustige week).
    if (planStrategy && typeof planStrategy === 'string' && planStrategy.trim().length > 0) {
      planText += `\nCOACHSTRATEGIE ACHTER DIT SCHEMA (de overwegingen waarmee dit schema is gemaakt — houd je advies hiermee consistent):\n${planStrategy}\n`;
    }

    // Add current date/time context — betrouwbaar via Intl in de Amsterdam-tijdzone
    // (toLocaleDateString is onbetrouwbaar in Node.js/Vercel, zie CLAUDE.md).
    const now = new Date();
    const ams = getAmsterdamNow(now);
    const todayIso = ams.isoDate;

    // Determine current week in cycle
    const startStr = cycleStartDate || '2026-02-23';
    const startDate = new Date(startStr);
    const diffDays = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const weekNum = Math.floor(diffDays / 7) % 2 === 0 ? 1 : 2;

    const daysUntilRace = typeof daysUntilRaceBody === 'number' ? daysUntilRaceBody : 0;

    let contextMessage = `\n\nHUIDIGE CONTEXT:\n- ${buildTimingRule(ams)}\n- Datum: ${ams.dayName} ${ams.dateStr}\n- Tijd: ${ams.timeStr} (${ams.dagdeel})\n- Week in cyclus: Week ${weekNum}\n- Dagen tot wedstrijd: ${daysUntilRace}\n`;

    if (raceContext) {
      contextMessage += `- Actief doel: ${raceContext}\n`;
    }
    if (goalsHistory) {
      contextMessage += `\n${goalsHistory}\n`;
    }

    // Build context with check-in data
    if (checkIns && checkIns.length > 0) {
      contextMessage += '\nRECENTE CHECK-INS VAN DE ATLEET:\n';
      for (const ci of checkIns) {
        contextMessage += `- [${relativeDayLabel(ci.date, todayIso)}] ${ci.date} (${ci.trainingDay}): Gevoel ${ci.feeling}/5`;
        if (ci.note) contextMessage += ` - "${ci.note}"`;
        contextMessage += '\n';
      }
    }

    // Add Garmin data context
    if (garminData) {
      if (garminData.health) {
        const h = garminData.health;
        contextMessage += `\nGARMIN GEZONDHEIDSDATA [${relativeDayLabel(h.date, todayIso)}] (${h.date}):\n`;
        contextMessage += `- Slaap: ${h.sleepDurationHours} uur (score: ${h.sleepScore}/100)\n`;
        contextMessage += `- Diepe slaap: ${h.deepSleepMinutes} min, REM: ${h.remSleepMinutes} min\n`;
        contextMessage += `- ${buildHrvCoachText(h) || `HRV: ${h.avgOvernightHrv} ms (status: ${h.hrvStatus})`}\n`;
        contextMessage += `- Rust hartslag: ${h.restingHR} bpm\n`;
        contextMessage += `- Body Battery verandering: ${h.bodyBatteryChange > 0 ? '+' : ''}${h.bodyBatteryChange}\n`;
        contextMessage += `- Stappen: ${h.steps}\n`;
        if (h.avgRespirationRate) contextMessage += `- Ademhaling (slaap): ${h.avgRespirationRate}/min\n`;
        if (h.lactateThresholdHR || h.lactateThresholdPace) {
          const ltParts: string[] = [];
          if (h.lactateThresholdHR) ltParts.push(`${h.lactateThresholdHR} bpm`);
          if (h.lactateThresholdPace) ltParts.push(h.lactateThresholdPace);
          contextMessage += `- Lactaatdrempel: ${ltParts.join(' · ')} (gebruik voor zone-advies: duurloop onder LT HR, tempo rond LT pace)\n`;
        }
      }
      if (garminData.activities && garminData.activities.length > 0) {
        contextMessage += '\nRECENTE GARMIN ACTIVITEITEN (let op het dag-label per activiteit — gebruik dat exact):\n';
        for (const a of garminData.activities.slice(0, 14)) {
          contextMessage += `- [${relativeDayLabel(a.date, todayIso)}] ${a.date}${a.startTime ? ` om ${a.startTime}` : ''}: ${a.activityName} (${a.sport}) - ${a.durationMinutes}min`;
          if (a.distanceKm > 0) contextMessage += `, ${a.distanceKm}km`;
          if (a.avgHR > 0) contextMessage += `, gem HR ${a.avgHR}, max HR ${a.maxHR}`;
          if ((a.avgPower || 0) > 0) contextMessage += `, ${a.avgPower}W${(a.normalizedPower || 0) > 0 ? ` (NP ${a.normalizedPower}W)` : ''}`;
          if ((a.trainingStressScore || 0) > 0) contextMessage += `, TSS ${a.trainingStressScore}`;
          if (a.hrZones && a.hrZones.length > 0) {
            contextMessage += ` | zones: ${a.hrZones.map((z: { zone: string; minutes: number }) => `${z.zone}: ${z.minutes}min`).join(', ')}`;
          }
          if (a.splits && a.splits.length > 1) {
            const splitStr = a.splits.map((s: { distance: number; durationSeconds: number; avgHR: number; avgPower?: number; sport?: string }, i: number) => {
              const m = Math.floor(s.durationSeconds / 60);
              const sec = s.durationSeconds % 60;
              const dist = s.distance > 0 ? (s.distance < 1 ? `${Math.round(s.distance * 1000)}m` : `${s.distance}km`) : '';
              const sportLabel = s.sport ? `${s.sport} ` : '';
              return `${i + 1}) ${sportLabel}${dist} ${m}:${sec.toString().padStart(2, '0')}${s.avgHR > 0 ? ` HR${s.avgHR}` : ''}${(s.avgPower || 0) > 0 ? ` ${s.avgPower}W` : ''}`;
            }).join(', ');
            contextMessage += ` | blokken: ${splitStr}`;
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

    if (equipmentAttention && typeof equipmentAttention === 'string' && equipmentAttention.trim().length > 0) {
      contextMessage += `\nMATERIAAL:\n${equipmentAttention}\n(Gebruik dit als de atleet ernaar vraagt of als het echt relevant is voor het advies.)\n`;
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

    const defaultZoneText = 'Hardlopen: Max HR 172 bpm, Z1(86-103 Herstel), Z2(103-120 Basis), Z3(120-138 Aeroob), Z4(138-155 Drempel), Z5(155-172 VO2max) | Fietsen: Max HR 164 bpm, Z1(82-98), Z2(98-115), Z3(115-131), Z4(131-148), Z5(148-164)';
    // Personalisatie: persona + profielblok uit het meegestuurde atleet-profiel
    const profile = (athleteProfile ?? null) as AthleteProfilePayload | null;
    const personaText = profile ? `Je bent gespecialiseerd als ${coachPersona(profile)} — stem al je advies af op de sporten van deze atleet.\n` : '';
    const profileBlock = profile ? `${buildAthleteProfileText(profile)}\n\n` : '';
    const BASE_PROMPT = BASE_PROMPT_INTRO.replace('{{HR_ZONE_TEXT}}', hrZoneText || defaultZoneText);
    const fullSystemPrompt = personaText + BASE_PROMPT + '\n\n' + profileBlock + planText + contextMessage;

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-opus-4-8',
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
