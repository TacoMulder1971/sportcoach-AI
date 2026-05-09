// Pre-berekende "GEVERIFIEERDE FEITEN" voor AI-prompts.
// Doel: voorkom dat de AI HR-waarden, zones of sporten verzint bij multisport-
// activiteiten of activiteiten met splits.

import { HEART_RATE_ZONES, GarminActivity, TrainingSession } from './types';

export function zoneForHR(hr: number): string {
  if (!hr || hr <= 0) return '–';
  for (const z of [...HEART_RATE_ZONES].reverse()) {
    if (hr >= z.min) return `${z.zone} (${z.min}-${z.max} bpm)`;
  }
  return 'Onder Z1';
}

export function zoneNameForHR(hr: number): string {
  if (!hr || hr <= 0) return '–';
  for (const z of [...HEART_RATE_ZONES].reverse()) {
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

export function plannedZoneRange(zoneStr?: string): string {
  if (!zoneStr) return 'geen zone gespecificeerd';
  const m = zoneStr.match(/Z[1-5]/);
  if (!m) return zoneStr;
  const z = HEART_RATE_ZONES.find(zz => zz.zone === m[0]);
  return z ? `${z.zone} (${z.min}-${z.max} bpm)` : zoneStr;
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
 */
export function buildVerifiedFactsBlock(
  contextLabel: string,
  sessions: TrainingSession[],
  activities: GarminActivity[],
): string {
  if (activities.length === 0 && sessions.length === 0) return '';

  let out = `\nGEVERIFIEERDE FEITEN ${contextLabel.toUpperCase()} (door de app berekend uit Garmin-data — gebruik deze cijfers exact, verzin geen eigen HR-waarden, snelheden of zones):\n`;

  // GEPLAND
  if (sessions.length > 0) {
    out += `\nGEPLAND ${contextLabel}:\n`;
    for (const s of sessions) {
      out += `- ${s.sport} ${s.type}, ${s.durationMinutes ?? '?'}min, doel ${plannedZoneRange(s.zone)}\n`;
    }
  }

  // WERKELIJK
  if (activities.length > 0) {
    out += `\nWERKELIJK UITGEVOERD ${contextLabel}:\n`;
    for (const a of activities) {
      out += `Activiteit "${a.activityName}" (${a.sport}, ${a.durationMinutes}min, ${a.distanceKm}km):\n`;
      if (a.avgHR > 0) {
        out += `- Totaal: gem HR ${a.avgHR} → ${zoneForHR(a.avgHR)}, max HR ${a.maxHR}`;
      } else {
        out += `- Totaal: gem HR niet beschikbaar, max HR ${a.maxHR}`;
      }
      if (a.avgPace) out += `, tempo ${a.avgPace}`;
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
        out += `- Splits (sport gecategoriseerd op basis van snelheid):\n`;
        a.splits.forEach((s, i) => {
          const sport = detectSplitSport(s.distance, s.durationSeconds);
          const speedKmh = s.durationSeconds > 0 ? (s.distance / s.durationSeconds) * 3600 : 0;
          const distStr = s.distance >= 1 ? `${s.distance}km` : `${Math.round(s.distance * 1000)}m`;
          const zoneStr = s.avgHR > 0 ? ` → ${zoneForHR(s.avgHR)}` : '';
          const powerStr = (s.avgPower || 0) > 0 ? `, ${s.avgPower}W` : '';
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
      let actualHR = 0;
      let matchSource = '';
      for (const a of activities) {
        if (a.splits && a.splits.length > 1) {
          for (const sp of a.splits) {
            if (detectSplitSport(sp.distance, sp.durationSeconds) === targetSport && sp.avgHR > 0) {
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
      const plannedLabel = s.zone || 'geen zone';
      if (actualHR > 0) {
        const actualZoneName = zoneNameForHR(actualHR);
        const plannedMatch = s.zone ? s.zone.match(/Z[1-5]/) : null;
        const verdict = plannedMatch && plannedMatch[0] === actualZoneName
          ? '✓ MATCH'
          : plannedMatch
            ? `✗ AFWIJKING (gepland ${plannedMatch[0]}, werkelijk ${actualZoneName})`
            : '–';
        out += `- ${s.sport} ${s.type} (gepland ${plannedLabel}) → werkelijk HR ${actualHR} (${zoneForHR(actualHR)}) [${matchSource}] → ${verdict}\n`;
      } else {
        out += `- ${s.sport} ${s.type} (gepland ${plannedLabel}) → geen passende HR-data gevonden\n`;
      }
    }
  }

  return out;
}
