import { GarminActivity, GarminHealthStats } from './types';
import { calcTRIMP } from './training-load';

/**
 * Bouwt een prestatie-samenvatting van de afgelopen weken voor de AI-planmaker.
 * Gebruikt het activiteiten- + health-archief zodat de coach trends ziet,
 * niet alleen een momentopname. Output is compacte Nederlandse tekst die
 * direct in de Opus-redeneerprompt past.
 */

const TRAIN_SPORTS = ['hardlopen', 'fietsen', 'zwemmen', 'mountainbike'] as const;

const SPORT_LABEL: Record<string, string> = {
  hardlopen: 'Hardlopen',
  fietsen: 'Fietsen',
  zwemmen: 'Zwemmen',
  mountainbike: 'MTB',
};

function isoDaysAgo(days: number, ref: Date): string {
  const d = new Date(ref);
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

/** Maandag (ISO) van de week waarin `ref` valt. */
function mondayOf(ref: Date): Date {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  const toMonday = dow === 0 ? 6 : dow - 1;
  d.setDate(d.getDate() - toMonday);
  return d;
}

interface SportTotals {
  count: number;
  minutes: number;
  km: number;
  hrSum: number; // voor gewogen gemiddelde HR
  hrMinutes: number;
}

function emptyTotals(): SportTotals {
  return { count: 0, minutes: 0, km: 0, hrSum: 0, hrMinutes: 0 };
}

/**
 * @param activities  Vooraf gefilterd op stats-relevante activiteiten (geen stadsfiets).
 * @param health      Health-archief (slaap/HRV/rust-HR per dag).
 * @param referenceDate  Standaard vandaag; injecteerbaar voor tests.
 * @param weeksBack   Aantal volledige weken terug (incl. huidige), standaard 4.
 */
export function buildPerformanceSummary(
  activities: GarminActivity[],
  health: GarminHealthStats[],
  referenceDate: Date = new Date(),
  weeksBack = 4
): string {
  if (!activities || activities.length === 0) {
    return 'PRESTATIES AFGELOPEN WEKEN: geen activiteiten-data beschikbaar in het archief.';
  }

  const restingHR =
    health.find((h) => h.restingHR > 0)?.restingHR || 55;

  const thisMonday = mondayOf(referenceDate);
  const oldestMonday = new Date(thisMonday);
  oldestMonday.setDate(thisMonday.getDate() - (weeksBack - 1) * 7);
  const windowStart = oldestMonday.toISOString().split('T')[0];

  const inWindow = activities.filter((a) => a.date >= windowStart);

  const lines: string[] = ['PRESTATIES AFGELOPEN WEKEN (uit archief, oudste → nieuwste):'];

  for (let w = weeksBack - 1; w >= 0; w--) {
    const monday = new Date(thisMonday);
    monday.setDate(thisMonday.getDate() - w * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const mStr = monday.toISOString().split('T')[0];
    const sStr = sunday.toISOString().split('T')[0];

    const weekActs = inWindow.filter((a) => a.date >= mStr && a.date <= sStr);

    const perSport = new Map<string, SportTotals>();
    let weekTrimp = 0;
    for (const a of weekActs) {
      weekTrimp += calcTRIMP(a, restingHR);
      const key = TRAIN_SPORTS.includes(a.sport as typeof TRAIN_SPORTS[number])
        ? a.sport
        : 'overig';
      if (key === 'overig') continue;
      const t = perSport.get(key) || emptyTotals();
      t.count += 1;
      t.minutes += a.durationMinutes || 0;
      t.km += a.distanceKm || 0;
      if (a.avgHR > 0 && a.durationMinutes > 0) {
        t.hrSum += a.avgHR * a.durationMinutes;
        t.hrMinutes += a.durationMinutes;
      }
      perSport.set(key, t);
    }

    const label = monday.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
    const totalMin = weekActs.reduce((s, a) => s + (a.durationMinutes || 0), 0);

    if (weekActs.length === 0) {
      lines.push(`- Week van ${label}: geen trainingen geregistreerd`);
      continue;
    }

    const parts: string[] = [];
    for (const sport of TRAIN_SPORTS) {
      const t = perSport.get(sport);
      if (!t || t.count === 0) continue;
      const hr = t.hrMinutes > 0 ? `, gem HR ${Math.round(t.hrSum / t.hrMinutes)}` : '';
      const km = t.km > 0 ? `, ${t.km.toFixed(1)}km` : '';
      parts.push(`${SPORT_LABEL[sport]} ${t.count}× (${Math.round(t.minutes)}min${km}${hr})`);
    }

    lines.push(
      `- Week van ${label}: ${weekActs.length} sessies, ${Math.round(totalMin)}min totaal, TRIMP ${weekTrimp}` +
        (parts.length ? `\n    ${parts.join(' · ')}` : '')
    );
  }

  // Herstel-trend: laatste 7 dagen vs daarvoor
  const recovery = buildRecoveryTrend(health, referenceDate);
  if (recovery) lines.push(recovery);

  return lines.join('\n');
}

function avg(nums: number[]): number | null {
  const valid = nums.filter((n) => n > 0);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function buildRecoveryTrend(health: GarminHealthStats[], ref: Date): string | null {
  if (!health || health.length === 0) return null;
  const cutoff7 = isoDaysAgo(7, ref);
  const last7 = health.filter((h) => h.date >= cutoff7);
  if (last7.length === 0) return null;

  const sleep = avg(last7.map((h) => h.sleepDurationHours));
  const sleepScore = avg(last7.map((h) => h.sleepScore));
  const hrv = avg(last7.map((h) => h.avgOvernightHrv));
  const restHR = avg(last7.map((h) => h.restingHR));

  const bits: string[] = [];
  if (sleep !== null) bits.push(`slaap ${sleep.toFixed(1)}u`);
  if (sleepScore !== null) bits.push(`slaapscore ${Math.round(sleepScore)}`);
  if (hrv !== null) bits.push(`HRV ${Math.round(hrv)}ms`);
  if (restHR !== null) bits.push(`rust-HR ${Math.round(restHR)}`);
  if (bits.length === 0) return null;

  return `HERSTEL (gem. laatste 7 dagen): ${bits.join(', ')}`;
}
