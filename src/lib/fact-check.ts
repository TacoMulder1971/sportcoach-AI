// Pre-berekende "GEVERIFIEERDE FEITEN" voor AI-prompts.
// Doel: voorkom dat de AI HR-waarden, zones of sporten verzint bij multisport-
// activiteiten of activiteiten met splits.

import { HEART_RATE_ZONES, GarminActivity, HeartRateZoneInfo, TrainingSession } from './types';
import { SwimPaceTargets, formatSwimPace, formatSwimPaceRange, swimPaceSecPer100, swimZoneForPace } from './swim';

/**
 * Sport-specifieke intensiteitsmaten van de atleet (zoals de app ze toont).
 * Zonder dit valt alles terug op de hardcoded loop-zones — dan noemt de coach
 * voor een fietssessie de loop-bpm-range en wijkt hij af van het schema.
 * Zwemmen gaat niet op hartslag maar op tempo per 100m.
 */
export interface SportZones {
  run: HeartRateZoneInfo[];
  cycling: HeartRateZoneInfo[];
  swim?: SwimPaceTargets | null;
}

const CYCLING_SPORTS = ['fietsen', 'mountainbike'];

/** Zwemmen stuurt op tempo per 100m, niet op hartslag. */
function isSwim(sport?: string): boolean {
  return (sport || '').toLowerCase() === 'zwemmen';
}

/** Zones die bij een sport horen; valt terug op de loop-zones. */
export function zonesForSportName(sport: string | undefined, zones?: SportZones): HeartRateZoneInfo[] {
  if (!zones) return HEART_RATE_ZONES;
  return CYCLING_SPORTS.includes((sport || '').toLowerCase()) ? zones.cycling : zones.run;
}

export function zoneForHR(hr: number, zones: HeartRateZoneInfo[] = HEART_RATE_ZONES): string {
  if (!hr || hr <= 0) return '–';
  for (const z of [...zones].reverse()) {
    if (hr >= z.min) return `${z.zone} (${z.min}-${z.max} bpm)`;
  }
  return 'Onder Z1';
}

export function zoneNameForHR(hr: number, zones: HeartRateZoneInfo[] = HEART_RATE_ZONES): string {
  if (!hr || hr <= 0) return '–';
  for (const z of [...zones].reverse()) {
    if (hr >= z.min) return z.zone;
  }
  return 'Onder Z1';
}

export function detectSplitSport(distanceKm: number, durationSeconds: number): string {
  if (durationSeconds <= 0 || distanceKm <= 0) return 'overig';
  const speedKmh = (distanceKm / durationSeconds) * 3600;
  if (speedKmh > 18) return 'fietsen';
  if (speedKmh > 6) return 'hardlopen';
  if (speedKmh > 2) return 'wandelen/transitie';
  return 'overig';
}

export function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function plannedZoneRange(zoneStr?: string, zones: HeartRateZoneInfo[] = HEART_RATE_ZONES): string {
  if (!zoneStr) return 'geen zone gespecificeerd';
  const m = zoneStr.match(/Z[1-5]/);
  if (!m) return zoneStr;
  const z = zones.find(zz => zz.zone === m[0]);
  return z ? `${z.zone} (${z.min}-${z.max} bpm)` : zoneStr;
}

/** Doel van een zwemsessie: richttempo per 100m i.p.v. een bpm-bereik. */
export function plannedSwimPaceRange(zoneStr?: string, targets?: SwimPaceTargets | null): string {
  if (!zoneStr) return 'geen zone gespecificeerd (tempo op gevoel, per 100m)';
  const m = zoneStr.match(/Z[1-5]/);
  if (!m) return zoneStr;
  const t = targets?.zones.find(z => z.zone === m[0]);
  return t
    ? `${t.zone} (${formatSwimPaceRange(t)} per 100m)`
    : `${m[0]} (tempo per 100m, geen richttempo bekend)`;
}

/** Doelomschrijving per sessie: bpm voor land, tempo per 100m voor zwemmen. */
function plannedTarget(session: { sport?: string; zone?: string }, zones?: SportZones): string {
  return isSwim(session.sport)
    ? plannedSwimPaceRange(session.zone, zones?.swim)
    : plannedZoneRange(session.zone, zonesForSportName(session.sport, zones));
}

/**
 * Bouwt een "GEVERIFIEERDE FEITEN" blok voor in een AI-prompt.
 * - Toont per geplande sessie de doel-zone met range.
 * - Toont per activiteit totaal + HR-zoneverdeling + splits met gedetecteerde sport en zone.
 * - Genereert een VERGELIJKING (✓ MATCH / ✗ AFWIJKING) per geplande sessie.
 *
 * @param contextLabel  Beschrijving van het tijdvenster ("vandaag", "gisteren", etc.)
 * @param sessions       Geplande trainingssessies
 * @param activities     Werkelijk uitgevoerde Garmin-activiteiten in dat venster
 * @param zones          Sport-specifieke zones van de atleet (zonder dit: loop-zones voor alles)
 */
export function buildVerifiedFactsBlock(
  contextLabel: string,
  sessions: TrainingSession[],
  activities: GarminActivity[],
  zones?: SportZones,
): string {
  if (activities.length === 0 && sessions.length === 0) return '';

  let out = `\nGEVERIFIEERDE FEITEN ${contextLabel.toUpperCase()} (door de app berekend uit Garmin-data — gebruik deze cijfers exact, verzin geen eigen HR-waarden, snelheden of zones):\n`;

  // GEPLAND
  if (sessions.length > 0) {
    out += `\nGEPLAND ${contextLabel}:\n`;
    for (const s of sessions) {
      // De omschrijving hoort erbij: die bevat de opbouw van de sessie
      // ("60min Z2 + 15min Z3 raceritme"). Zonder die regel oordeelt de coach
      // op de hoofdzone alleen en wijkt hij af van wat het schema toont.
      out += `- ${s.sport} ${s.type}, ${s.durationMinutes ?? '?'}min, doel ${plannedTarget(s, zones)}`;
      if (s.description) out += ` — "${s.description}"`;
      out += '\n';
    }
  }

  // WERKELIJK
  if (activities.length > 0) {
    out += `\nWERKELIJK UITGEVOERD ${contextLabel}:\n`;
    for (const a of activities) {
      const actZones = zonesForSportName(a.sport, zones);
      const swimAct = isSwim(a.sport);
      out += `Activiteit "${a.activityName}" (${a.sport}, ${a.durationMinutes}min, ${a.distanceKm}km):\n`;
      if (swimAct) {
        // In het water is HR onbetrouwbaar; het tempo per 100m is de maat.
        const secPer100 = swimPaceSecPer100(a.distanceKm, a.durationMinutes);
        const zone = swimZoneForPace(secPer100, zones?.swim);
        out += `- Totaal: tempo ${secPer100 > 0 ? `${formatSwimPace(secPer100)} per 100m` : 'niet te bepalen'}`;
        if (zone) out += ` → ${zone.zone} (${zone.label})`;
        if (a.avgHR > 0) out += `, gem HR ${a.avgHR} (in het water onbetrouwbaar, niet op sturen)`;
      } else {
        if (a.avgHR > 0) {
          out += `- Totaal: gem HR ${a.avgHR} → ${zoneForHR(a.avgHR, actZones)}, max HR ${a.maxHR}`;
        } else {
          out += `- Totaal: gem HR niet beschikbaar, max HR ${a.maxHR}`;
        }
        if (a.avgPace) out += `, tempo ${a.avgPace}`;
      }
      if ((a.avgPower || 0) > 0) out += `, ${a.avgPower}W${(a.normalizedPower || 0) > 0 ? ` (NP ${a.normalizedPower}W)` : ''}`;
      if (a.trainingEffectAerobic > 0) out += `, TE aerobic ${a.trainingEffectAerobic}/5`;
      if (a.trainingEffectAnaerobic > 0) out += `, TE anaerobic ${a.trainingEffectAnaerobic}/5`;
      if (a.elevationGain > 0) out += `, ${a.elevationGain}m stijging`;
      out += `, ${a.calories} kcal\n`;

      if (a.hrZones && a.hrZones.length > 0) {
        const zonesStr = a.hrZones.filter(z => z.minutes > 0).map(z => `${z.zone} ${z.minutes}min`).join(', ');
        if (zonesStr) out += `- HR-zoneverdeling: ${zonesStr}\n`;
      }

      if (a.splits && a.splits.length > 1) {
        // Garmin levert bij een multisport-opname per split het echte sport-label;
        // alleen als dat ontbreekt leiden we de sport uit de snelheid af.
        const hasSportLabels = a.splits.some((s) => !!s.sport);
        out += `- Splits (sport ${hasSportLabels ? 'volgens Garmin' : 'gecategoriseerd op basis van snelheid'}):\n`;
        a.splits.forEach((s, i) => {
          const sport = s.sport || detectSplitSport(s.distance, s.durationSeconds);
          const speedKmh = s.durationSeconds > 0 ? (s.distance / s.durationSeconds) * 3600 : 0;
          const distStr = s.distance >= 1 ? `${s.distance}km` : `${Math.round(s.distance * 1000)}m`;
          const powerStr = (s.avgPower || 0) > 0 ? `, ${s.avgPower}W` : '';
          if (isSwim(sport)) {
            // Zwemonderdeel: tempo per 100m i.p.v. km/u, en geen HR-zone-oordeel.
            const secPer100 = swimPaceSecPer100(s.distance, s.durationSeconds / 60);
            const paceStr = secPer100 > 0 ? `${formatSwimPace(secPer100)} per 100m` : `${speedKmh.toFixed(1)} km/h`;
            out += `  ${i + 1}. ${sport} — ${distStr} in ${fmtDuration(s.durationSeconds)} (${paceStr}), HR ${s.avgHR || '–'} (in het water onbetrouwbaar)${powerStr}\n`;
            return;
          }
          const zoneStr = s.avgHR > 0 ? ` → ${zoneForHR(s.avgHR, zonesForSportName(sport, zones))}` : '';
          out += `  ${i + 1}. ${sport} — ${distStr} in ${fmtDuration(s.durationSeconds)} (${speedKmh.toFixed(1)} km/h), HR ${s.avgHR || '–'}${zoneStr}${powerStr}\n`;
        });
      }
    }
  }

  // VERGELIJKING per geplande sessie
  if (sessions.length > 0 && activities.length > 0) {
    out += `\nVERGELIJKING ${contextLabel} (plan vs werkelijk):\n`;
    for (const s of sessions) {
      const targetSport = s.sport;

      // Zwemmen: vergelijk tempo per 100m, niet hartslag.
      if (isSwim(targetSport)) {
        let secPer100 = 0;
        let swimSource = '';
        for (const a of activities) {
          const swimSplit = a.splits?.find(sp => sp.sport === 'zwemmen' && sp.distance > 0 && sp.durationSeconds > 0);
          if (swimSplit) {
            secPer100 = swimPaceSecPer100(swimSplit.distance, swimSplit.durationSeconds / 60);
            swimSource = 'onderdeel van multisport';
            break;
          }
          if (isSwim(a.sport) && a.distanceKm > 0 && a.durationMinutes > 0) {
            secPer100 = swimPaceSecPer100(a.distanceKm, a.durationMinutes);
            swimSource = 'totaal activiteit';
            break;
          }
        }
        const plannedSwimLabel = plannedSwimPaceRange(s.zone, zones?.swim);
        if (secPer100 > 0) {
          const actualZone = swimZoneForPace(secPer100, zones?.swim);
          const plannedMatch = s.zone ? s.zone.match(/Z[1-5]/) : null;
          const verdict = plannedMatch && actualZone
            ? (plannedMatch[0] === actualZone.zone
                ? '✓ MATCH'
                : `✗ AFWIJKING (gepland ${plannedMatch[0]}, werkelijk ${actualZone.zone})`)
            : '–';
          out += `- ${s.sport} ${s.type} (gepland ${plannedSwimLabel}) → werkelijk ${formatSwimPace(secPer100)} per 100m${actualZone ? ` (${actualZone.zone})` : ''} [${swimSource}] → ${verdict}\n`;
        } else {
          out += `- ${s.sport} ${s.type} (gepland ${plannedSwimLabel}) → geen passende zwemdata gevonden\n`;
        }
        continue;
      }

      let actualHR = 0;
      let matchSource = '';
      for (const a of activities) {
        if (a.splits && a.splits.length > 1) {
          for (const sp of a.splits) {
            const splitSport = sp.sport || detectSplitSport(sp.distance, sp.durationSeconds);
            if (splitSport === targetSport && sp.avgHR > 0) {
              actualHR = sp.avgHR;
              matchSource = `split (${sp.distance >= 1 ? `${sp.distance}km` : `${Math.round(sp.distance * 1000)}m`})`;
              break;
            }
          }
          if (actualHR > 0) break;
        }
        if (a.sport === targetSport && a.avgHR > 0) {
          actualHR = a.avgHR;
          matchSource = 'totaal activiteit';
          break;
        }
      }
      const sessionZones = zonesForSportName(s.sport, zones);
      const plannedLabel = s.zone || 'geen zone';
      if (actualHR > 0) {
        const actualZoneName = zoneNameForHR(actualHR, sessionZones);
        const plannedMatch = s.zone ? s.zone.match(/Z[1-5]/) : null;
        const verdict = plannedMatch && plannedMatch[0] === actualZoneName
          ? '✓ MATCH'
          : plannedMatch
            ? `✗ AFWIJKING (gepland ${plannedMatch[0]}, werkelijk ${actualZoneName})`
            : '–';
        out += `- ${s.sport} ${s.type} (gepland ${plannedLabel}) → werkelijk HR ${actualHR} (${zoneForHR(actualHR, sessionZones)}) [${matchSource}] → ${verdict}\n`;
      } else {
        out += `- ${s.sport} ${s.type} (gepland ${plannedLabel}) → geen passende HR-data gevonden\n`;
      }
    }
  }

  return out;
}
