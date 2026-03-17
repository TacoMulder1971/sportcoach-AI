import { GarminActivity, GarminHealthStats, TrainingLoadData, TrainingReadiness, TrainingSession, TrainingAdvice, HEART_RATE_ZONES } from './types';

const MAX_HR = 172;
const REST_HR = 55; // geschatte rustHR, wordt overschreven door Garmin data

/**
 * Bereken TRIMP (Training Impulse) per activiteit
 * TRIMP = duur(min) × intensiteitsfactor
 * Intensiteitsfactor = (avgHR - restHR) / (maxHR - restHR)
 */
function calcTRIMP(activity: GarminActivity, restingHR: number): number {
  if (!activity.avgHR || activity.avgHR <= restingHR) return 0;
  const intensity = (activity.avgHR - restingHR) / (MAX_HR - restingHR);
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

  let score1 = 0;
  let score2 = 0;
  let score3 = 0;
  let label1: string;
  let label2: string;
  let label3: string;
  let mode: 'full' | 'fallback';

  if (hasSleepData) {
    // --- VOLLEDIGE MODUS: HRV + Slaap + Lichaam ---
    mode = 'full';

    // HRV (0-2)
    label1 = 'HRV';
    const hrvStatus = (health.hrvStatus || '').toLowerCase();
    if (hrvStatus === 'balanced' || hrvStatus === 'good' || hrvStatus === 'optimal') {
      score1 = 2;
    } else if (health.avgOvernightHrv > 30) {
      score1 = 1;
    }

    // Slaap (0-2)
    label2 = 'Slaap';
    if (health.sleepScore > 70) {
      score2 = 2;
    } else if (health.sleepScore > 45) {
      score2 = 1;
    }

    // Belasting (0-5) — hoe zwaarder recent getraind, hoe lager
    label3 = 'Belasting';
    const restingHR = health.restingHR || REST_HR;
    const recentTRIMP = getRecentTRIMP(activities, restingHR);
    score3 = getLoadScore(recentTRIMP);
  } else {
    // --- FALLBACK MODUS: RustHR + Hersteltijd + Lichaam ---
    mode = 'fallback';

    // Rust-hartslag (0-2)
    label1 = 'Rust HR';
    if (health.restingHR > 0) {
      if (health.restingHR < 54) {
        score1 = 2;
      } else if (health.restingHR < 60) {
        score1 = 1;
      }
    }

    // Belasting (0-5) — hoe zwaarder recent getraind, hoe lager
    label2 = 'Belasting';
    const restingHR = health.restingHR || REST_HR;
    const recentTRIMP = getRecentTRIMP(activities, restingHR);
    score2 = getLoadScore(recentTRIMP);

    // Lichaam (0-2) — body battery als beschikbaar
    label3 = 'Lichaam';
    if (health.bodyBatteryChange > 20) {
      score3 = 2;
    } else if (health.bodyBatteryChange > 5) {
      score3 = 1;
    }
    // In fallback: als geen battery data, geef 1 punt als rustHR laag
    if (score3 === 0 && health.restingHR > 0 && health.restingHR < 55) {
      score3 = 1;
    }
  }

  const total = score1 + score2 + score3;
  const max1 = hasSleepData ? 2 : 2;
  const max2 = hasSleepData ? 2 : 5;
  const max3 = hasSleepData ? 5 : 2;
  const factors = { label1, score1, max1, label2, score2, max2, label3, score3, max3 };

  if (total >= 7) {
    return {
      level: 'klaar',
      label: 'Klaar',
      color: 'text-green-600',
      bgColor: 'bg-green-500',
      score: total,
      mode,
      advice: hasTrainingToday
        ? 'Je bent goed hersteld. Ga vol voor de training!'
        : 'Top hersteld. Geniet van je rustdag.',
      factors,
    };
  }
  if (total >= 4) {
    return {
      level: 'matig',
      label: 'Matig',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-400',
      score: total,
      mode,
      advice: hasTrainingToday
        ? 'Redelijk hersteld. Train, maar luister naar je lichaam.'
        : 'Matig herstel. Neem het rustig aan vandaag.',
      factors,
    };
  }
  return {
    level: 'rust_nodig',
    label: 'Rust nodig',
    color: 'text-red-500',
    bgColor: 'bg-red-500',
    score: total,
    mode,
    advice: hasTrainingToday
      ? 'Neem het rustig aan of kies voor een lichte hersteltraining.'
      : 'Focus op herstel: rust, voeding en slaap.',
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
    const avgHR = zoneAvgHR[s.zone || 'Z2'] || 112;
    const duration = s.durationMinutes || 30;
    const intensity = (avgHR - REST_HR) / (MAX_HR - REST_HR);
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
