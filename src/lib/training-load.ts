import { GarminActivity, GarminHealthStats, TrainingLoadData, TrainingReadiness, TrainingSession, TrainingAdvice, HeartRateZone, HeartRateZoneInfo, HEART_RATE_ZONES, Sport, TrainingWeek } from './types';
import { getTrainingForDayOffset } from './schedule';

const DEFAULT_MAX_HR = 172;
const REST_HR = 55; // geschatte rustHR, wordt overschreven door Garmin data

/**
 * Bereken TRIMP (Training Impulse) per activiteit
 * TRIMP = duur(min) × intensiteitsfactor
 * Intensiteitsfactor = (avgHR - restHR) / (maxHR - restHR)
 * maxHR is sport-specifiek: fietsen krijgt cycling max HR mee als die beschikbaar is.
 */
export function calcTRIMP(activity: GarminActivity, restingHR: number, maxHR = DEFAULT_MAX_HR): number {
  if (!activity.avgHR || activity.avgHR <= restingHR) return 0;
  const intensity = (activity.avgHR - restingHR) / (maxHR - restingHR);
  return Math.round(activity.durationMinutes * intensity);
}

/**
 * Filter activiteiten van de laatste 7 dagen
 */
function getLast7DaysActivities(activities: GarminActivity[]): GarminActivity[] {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const cutoff = sevenDaysAgo.toISOString().split('T')[0];
  return activities.filter((a) => a.date >= cutoff);
}

/**
 * Bereken Training Load over 7 dagen
 * Zones: <150 laag, 150-350 optimaal, 350-500 hoog, >500 overbelast
 */
export function calculateTrainingLoad(
  activities: GarminActivity[],
  health: GarminHealthStats | null
): TrainingLoadData {
  const restingHR = health?.restingHR || REST_HR;
  const recent = getLast7DaysActivities(activities);
  const weekLoad = recent.reduce((sum, a) => sum + calcTRIMP(a, restingHR), 0);

  if (weekLoad < 150) {
    return {
      weekLoad,
      status: 'laag',
      statusColor: 'text-blue-500',
      advice: 'Je training load is laag. Je kunt gerust wat meer doen deze week.',
    };
  }
  if (weekLoad < 350) {
    return {
      weekLoad,
      status: 'optimaal',
      statusColor: 'text-green-500',
      advice: 'Goede balans! Je traint in een productieve zone.',
    };
  }
  if (weekLoad < 500) {
    return {
      weekLoad,
      status: 'hoog',
      statusColor: 'text-orange-500',
      advice: 'Hoge belasting. Zorg voor voldoende herstel en slaap.',
    };
  }
  return {
    weekLoad,
    status: 'overbelast',
    statusColor: 'text-red-500',
    advice: 'Overbelasting! Neem een rustdag of verlaag de intensiteit.',
  };
}

/**
 * Bereken totale TRIMP van activiteiten binnen de laatste X uur
 */
function getRecentTRIMP(activities: GarminActivity[], restingHR: number, hours: number = 48): number {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - hours);
  const cutoffDate = cutoff.toISOString().split('T')[0];
  const recent = activities.filter((a) => a.date >= cutoffDate);
  return recent.reduce((sum, a) => sum + calcTRIMP(a, restingHR), 0);
}

/**
 * Belasting-score op basis van recente TRIMP (0-5)
 * Hoe zwaarder de recente training, hoe lager de score
 * Weegt zwaarder dan andere factoren (5 van 9 punten)
 */
function getLoadScore(recentTRIMP: number): number {
  if (recentTRIMP < 30) return 5;
  if (recentTRIMP < 60) return 4;
  if (recentTRIMP < 100) return 3;
  if (recentTRIMP < 150) return 2;
  if (recentTRIMP < 200) return 1;
  return 0;
}

/**
 * Trainingsgereedheid: visueel groen/geel/rood systeem
 * Met slaapdata: HRV + Slaap + Lichaam (0-9)
 * Zonder slaapdata: RustHR + Hersteltijd + Lichaam (0-9)
 */
export function getTrainingReadiness(
  health: GarminHealthStats | null,
  hasTrainingToday: boolean,
  activities: GarminActivity[] = []
): TrainingReadiness | null {
  if (!health) return null;

  const hasSleepData = health.sleepScore > 0;
  const hasHrv = (health.avgOvernightHrv ?? 0) > 0 || (health.hrvStatus && health.hrvStatus !== 'onbekend');
  const hasRestingHR = (health.restingHR ?? 0) > 0;
  // bodyBatteryChange exact 0 én geen rustHR/slaap → meest waarschijnlijk: horloge niet gedragen
  const hasBodyBattery = (health.bodyBatteryChange ?? 0) !== 0 || hasRestingHR;

  let score1: number | null = null;
  let score2: number | null = null;
  let score3: number | null = null;
  let max1 = 2, max2 = 2, max3 = 5;
  let label1: string;
  let label2: string;
  let label3: string;
  let mode: 'full' | 'fallback';

  if (hasSleepData) {
    // --- VOLLEDIGE MODUS: HRV + Slaap + Belasting ---
    mode = 'full';
    max1 = 2; max2 = 2; max3 = 5;

    // HRV (0-2) — null als geen HRV-data
    label1 = 'HRV';
    if (hasHrv) {
      const hrvStatus = (health.hrvStatus || '').toLowerCase();
      if (hrvStatus === 'balanced' || hrvStatus === 'good' || hrvStatus === 'optimal') {
        score1 = 2;
      } else if ((health.avgOvernightHrv ?? 0) > 30) {
        score1 = 1;
      } else {
        score1 = 0;
      }
    }

    // Slaap (0-2)
    label2 = 'Slaap';
    if (health.sleepScore > 70) score2 = 2;
    else if (health.sleepScore > 45) score2 = 1;
    else score2 = 0;

    // Belasting (0-5) — altijd berekenbaar uit activiteiten
    label3 = 'Belasting';
    const restingHR = health.restingHR || REST_HR;
    const recentTRIMP = getRecentTRIMP(activities, restingHR);
    score3 = getLoadScore(recentTRIMP);
  } else {
    // --- FALLBACK MODUS: RustHR + Belasting + Lichaam ---
    // Geen slaap-data betekent vaak dat horloge 's nachts uit was.
    // We tellen factoren met ontbrekende data niet mee als 0.
    mode = 'fallback';
    max1 = 2; max2 = 5; max3 = 2;

    // Rust-hartslag (0-2) — null als geen meting
    label1 = 'Rust HR';
    if (hasRestingHR) {
      if (health.restingHR < 54) score1 = 2;
      else if (health.restingHR < 60) score1 = 1;
      else score1 = 0;
    }

    // Belasting (0-5) — altijd berekenbaar
    label2 = 'Belasting';
    const restingHR = health.restingHR || REST_HR;
    const recentTRIMP = getRecentTRIMP(activities, restingHR);
    score2 = getLoadScore(recentTRIMP);

    // Lichaam (0-2) — null als geen battery én geen rustHR
    label3 = 'Lichaam';
    if (hasBodyBattery) {
      if (health.bodyBatteryChange > 20) score3 = 2;
      else if (health.bodyBatteryChange > 5) score3 = 1;
      else score3 = 0;
      // Bonus: 1 punt als rustHR laag is en battery niets opleverde
      if (score3 === 0 && hasRestingHR && health.restingHR < 55) score3 = 1;
    }
  }

  // Som alleen scoorbare factoren — null wordt overgeslagen
  const scoredFactors = [
    { score: score1, max: max1 },
    { score: score2, max: max2 },
    { score: score3, max: max3 },
  ].filter(f => f.score !== null);

  // Als er geen enkele factor scoorbaar is, kunnen we niets zeggen
  if (scoredFactors.length === 0) return null;

  const total = scoredFactors.reduce((sum, f) => sum + (f.score as number), 0);
  const maxAvailable = scoredFactors.reduce((sum, f) => sum + f.max, 0);
  const ratio = maxAvailable > 0 ? total / maxAvailable : 0;
  const dataComplete = score1 !== null && score2 !== null && score3 !== null;

  const factors = { label1, score1, max1, label2, score2, max2, label3, score3, max3 };
  const baseAdvice = (good: string, mid: string, bad: string): string => {
    const tail = dataComplete ? '' : ' (data incompleet — sommige factoren ontbreken)';
    if (ratio >= 7 / 9) return good + tail;
    if (ratio >= 4 / 9) return mid + tail;
    return bad + tail;
  };

  if (ratio >= 7 / 9) {
    return {
      level: 'klaar',
      label: 'Klaar',
      color: 'text-green-600',
      bgColor: 'bg-green-500',
      score: total,
      maxScore: maxAvailable,
      mode,
      dataComplete,
      advice: baseAdvice(
        hasTrainingToday ? 'Je bent goed hersteld. Ga vol voor de training!' : 'Top hersteld. Geniet van je rustdag.',
        '', ''
      ),
      factors,
    };
  }
  if (ratio >= 4 / 9) {
    return {
      level: 'matig',
      label: 'Matig',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-400',
      score: total,
      maxScore: maxAvailable,
      mode,
      dataComplete,
      advice: baseAdvice(
        '',
        hasTrainingToday ? 'Redelijk hersteld. Train, maar luister naar je lichaam.' : 'Matig herstel. Neem het rustig aan vandaag.',
        ''
      ),
      factors,
    };
  }
  return {
    level: 'rust_nodig',
    label: 'Rust nodig',
    color: 'text-red-500',
    bgColor: 'bg-red-500',
    score: total,
    maxScore: maxAvailable,
    mode,
    dataComplete,
    advice: baseAdvice(
      '', '',
      hasTrainingToday ? 'Neem het rustig aan of kies voor een lichte hersteltraining.' : 'Focus op herstel: rust, voeding en slaap.'
    ),
    factors,
  };
}

/**
 * Schat de TRIMP van een geplande training op basis van zones en duur
 */
export function estimatePlannedTRIMP(sessions: TrainingSession[]): number {
  const zoneAvgHR: Record<string, number> = {};
  for (const z of HEART_RATE_ZONES) {
    zoneAvgHR[z.zone] = Math.round((z.min + z.max) / 2);
  }

  let total = 0;
  for (const s of sessions) {
    // Kracht en rust leveren geen aerobe TRIMP-belasting op.
    if (s.sport === 'kracht' || s.sport === 'rust') continue;
    const avgHR = zoneAvgHR[s.zone || 'Z2'] || 112;
    const duration = s.durationMinutes || 30;
    const intensity = (avgHR - REST_HR) / (DEFAULT_MAX_HR - REST_HR);
    if (intensity > 0) {
      total += Math.round(duration * intensity);
    }
  }
  return total;
}

/**
 * Geeft concreet trainingsadvies: ga ervoor, pas aan, of neem rust
 * Combineert gereedheid-score met zwaarte van de geplande training
 */
export function getTrainingAdvice(readiness: TrainingReadiness, plannedTRIMP: number): TrainingAdvice {
  const score = readiness.score;
  const isHeavy = plannedTRIMP > 80;
  const isMedium = plannedTRIMP > 40;

  // Bepaal advies op basis van matrix
  let level: 'go' | 'adjust' | 'rest';

  if (score >= 7) {
    level = 'go';
  } else if (score >= 5) {
    level = isHeavy ? 'adjust' : 'go';
  } else if (score === 4) {
    level = isHeavy ? 'rest' : isMedium ? 'adjust' : 'go';
  } else if (score >= 2) {
    level = isMedium ? 'rest' : 'adjust';
  } else {
    level = 'rest';
  }

  if (level === 'go') {
    return {
      level: 'go',
      label: 'Ga ervoor!',
      color: 'text-green-700',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      iconColor: 'text-green-600',
      message: score >= 7
        ? 'Je bent top hersteld. Voluit gaan vandaag!'
        : 'Je bent voldoende hersteld voor deze training.',
    };
  }

  if (level === 'adjust') {
    return {
      level: 'adjust',
      label: 'Pas aan',
      color: 'text-amber-700',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
      iconColor: 'text-amber-600',
      message: isHeavy
        ? 'Zware training gepland, maar je bent niet optimaal hersteld. Verlaag de intensiteit of duur.'
        : 'Je herstel is matig. Luister naar je lichaam en verlaag zo nodig het tempo.',
    };
  }

  return {
    level: 'rest',
    label: 'Beter rusten',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    iconColor: 'text-red-500',
    message: isHeavy
      ? 'Je lichaam heeft rust nodig. Sla deze zware training over of doe een licht hersteloefening.'
      : 'Je bent onvoldoende hersteld. Neem een rustdag voor beter herstel.',
  };
}

/**
 * Dagelijkse TRIMP-geschiedenis over de afgelopen N dagen
 * Dagdrempels: <21 laag, 21-50 optimaal, 50-71 hoog, >71 overbelast
 */
export function getDailyTRIMPHistory(
  activities: GarminActivity[],
  restingHR: number,
  days = 42
): { date: string; trimp: number; zone: 'laag' | 'optimaal' | 'hoog' | 'overbelast' }[] {
  const result: { date: string; trimp: number; zone: 'laag' | 'optimaal' | 'hoog' | 'overbelast' }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayActivities = activities.filter((a) => a.date === dateStr);
    const trimp = dayActivities.reduce((sum, a) => sum + calcTRIMP(a, restingHR), 0);

    let zone: 'laag' | 'optimaal' | 'hoog' | 'overbelast';
    if (trimp < 21) zone = 'laag';
    else if (trimp < 50) zone = 'optimaal';
    else if (trimp < 72) zone = 'hoog';
    else zone = 'overbelast';

    result.push({ date: dateStr, trimp, zone });
  }
  return result;
}

const ZONE_ORDER: HeartRateZone[] = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'];

/**
 * Bepaal in welke hartslagzone een gemiddelde HR valt.
 */
export function getHRZone(avgHR: number, zones: HeartRateZoneInfo[]): HeartRateZone | null {
  if (!avgHR) return null;
  for (const z of [...zones].reverse()) {
    if (avgHR >= z.min) return z.zone;
  }
  return null;
}

export interface ActivityMatchScore {
  score: number; // 0-100
  label: string;
  durationScore: number; // 0-100
  zoneScore: number; // 0-100
  plannedZone?: HeartRateZone;
  actualZone: HeartRateZone | null;
  plannedMinutes?: number;
}

/**
 * Vergelijk een uitgevoerde activiteit met de geplande sessie van die dag.
 * Duur en hartslagzone wegen elk 50% mee in de match-score.
 */
export function computeActivityMatchScore(
  activity: GarminActivity,
  session: TrainingSession,
  zones: HeartRateZoneInfo[]
): ActivityMatchScore {
  const actualZone = getHRZone(activity.avgHR, zones);

  // Neutrale score (70) als er geen geplande duur/zone is om tegen af te zetten.
  let durationScore = 70;
  if (session.durationMinutes) {
    const ratio = activity.durationMinutes / session.durationMinutes;
    durationScore = Math.max(0, Math.round(100 - Math.abs(1 - ratio) * 150));
  }

  let zoneScore = 70;
  if (session.zone && actualZone) {
    const diff = Math.abs(ZONE_ORDER.indexOf(session.zone) - ZONE_ORDER.indexOf(actualZone));
    zoneScore = diff === 0 ? 100 : diff === 1 ? 65 : 25;
  }

  const score = Math.round(durationScore * 0.5 + zoneScore * 0.5);
  const label = score >= 85 ? 'Precies volgens plan' : score >= 60 ? 'Redelijk uitgevoerd' : 'Flink afgeweken';

  return { score, label, durationScore, zoneScore, plannedZone: session.zone, actualZone, plannedMinutes: session.durationMinutes };
}

// ─── Plan-adherentie: gepland vs. gedaan over de afgelopen week ──────

export interface AdherencePlannedSession {
  session: TrainingSession;
  done: boolean;
  matchScore?: number; // uitvoeringsscore (0-100) als er een activiteit gematcht is
}

export interface AdherenceDay {
  date: string;      // ISO
  dayLabel: string;  // bv. "ma 29 jun"
  restDay: boolean;
  planned: AdherencePlannedSession[];
}

export interface WeekAdherence {
  plannedCount: number;
  completedCount: number;
  completionPct: number;        // gedane sessies / geplande sessies
  avgMatchScore: number | null; // gemiddelde uitvoeringsscore van de gedane sessies
  label: string;
  days: AdherenceDay[];
}

/** Sport-match voor adherentie: fietsen en mountainbike zijn uitwisselbaar. */
function sportsMatch(planned: Sport, actual: string): boolean {
  if (planned === actual) return true;
  const bike = (s: string) => s === 'fietsen' || s === 'mountainbike';
  return bike(planned) && bike(actual);
}

/**
 * Plan-adherentie over de laatste 7 volledige dagen (gisteren t/m 7 dagen terug):
 * hoeveel van de geplande sessies zijn uitgevoerd, en hoe goed (match-score).
 * Kracht telt niet mee (geen betrouwbare Garmin-registratie); vandaag telt niet
 * mee omdat de training van vandaag nog kan komen. null als er in het venster
 * niets gepland stond.
 */
export function computeWeekAdherence(
  plan: TrainingWeek[],
  cycleStartDate: string,
  activities: GarminActivity[],
  zonesForSport: (sport: Sport) => HeartRateZoneInfo[],
): WeekAdherence | null {
  const days: AdherenceDay[] = [];
  let plannedCount = 0;
  let completedCount = 0;
  const matchScores: number[] = [];

  for (let offset = -7; offset <= -1; offset++) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const dateStr = d.toISOString().split('T')[0];
    const dayLabel = d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });

    const training = getTrainingForDayOffset(offset, plan, cycleStartDate);
    const sessions = training && !training.isRestDay
      ? training.sessions.filter((s) => s.sport !== 'kracht' && s.sport !== 'rust')
      : [];

    const dayActivities = activities.filter((a) => a.date === dateStr);
    const used = new Set<number>();

    const planned: AdherencePlannedSession[] = sessions.map((session) => {
      const idx = dayActivities.findIndex((a, i) => !used.has(i) && sportsMatch(session.sport, a.sport));
      if (idx === -1) return { session, done: false };
      used.add(idx);
      const activity = dayActivities[idx];
      const match = computeActivityMatchScore(activity, session, zonesForSport(session.sport));
      matchScores.push(match.score);
      return { session, done: true, matchScore: match.score };
    });

    plannedCount += planned.length;
    completedCount += planned.filter((p) => p.done).length;
    days.push({ date: dateStr, dayLabel, restDay: !training || training.isRestDay, planned });
  }

  if (plannedCount === 0) return null;

  const completionPct = Math.round((completedCount / plannedCount) * 100);
  const avgMatchScore = matchScores.length > 0
    ? Math.round(matchScores.reduce((s, v) => s + v, 0) / matchScores.length)
    : null;
  const label = completionPct >= 85
    ? 'Sterk volgens plan'
    : completionPct >= 60
    ? 'Redelijk volgens plan'
    : 'Veel sessies gemist';

  return { plannedCount, completedCount, completionPct, avgMatchScore, label, days };
}

/**
 * Wekelijkse TRIMP-totalen voor de afgelopen N weken (maandag t/m zondag)
 */
export function getWeeklyTRIMPTotals(
  activities: GarminActivity[],
  restingHR: number,
  weeksBack = 6
): { weekStart: string; weekLabel: string; trimp: number }[] {
  const result: { weekStart: string; weekLabel: string; trimp: number }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Maandag van huidige week
  const dayOfWeek = today.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() - daysToMonday);

  for (let w = weeksBack - 1; w >= 0; w--) {
    const monday = new Date(thisMonday);
    monday.setDate(thisMonday.getDate() - w * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const mondayStr = monday.toISOString().split('T')[0];
    const sundayStr = sunday.toISOString().split('T')[0];

    const weekActivities = activities.filter((a) => a.date >= mondayStr && a.date <= sundayStr);
    const trimp = weekActivities.reduce((sum, a) => sum + calcTRIMP(a, restingHR), 0);

    const weekLabel = monday.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
    result.push({ weekStart: mondayStr, weekLabel, trimp });
  }
  return result;
}
