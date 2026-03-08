import { GarminActivity, GarminHealthStats, TrainingLoadData, TrainingReadiness } from './types';

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
 * Bereken uren sinds laatste training
 */
function hoursSinceLastActivity(activities: GarminActivity[]): number {
  if (activities.length === 0) return 999;
  const sorted = [...activities].sort((a, b) => b.date.localeCompare(a.date));
  const lastDate = new Date(sorted[0].date + 'T18:00:00'); // schat einde training
  const now = new Date();
  return (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60);
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

    // HRV (0-3)
    label1 = 'HRV';
    const hrvStatus = (health.hrvStatus || '').toLowerCase();
    if (hrvStatus === 'balanced' || hrvStatus === 'good' || hrvStatus === 'optimal') {
      score1 = 3;
    } else if (health.avgOvernightHrv > 40) {
      score1 = 2;
    } else if (health.avgOvernightHrv > 25) {
      score1 = 1;
    }

    // Slaap (0-3)
    label2 = 'Slaap';
    if (health.sleepScore > 75) {
      score2 = 3;
    } else if (health.sleepScore > 55) {
      score2 = 2;
    } else if (health.sleepScore > 40) {
      score2 = 1;
    }

    // Lichaam (0-3)
    label3 = 'Lichaam';
    if (health.bodyBatteryChange > 20) {
      score3 += 2;
    } else if (health.bodyBatteryChange > 5) {
      score3 += 1;
    }
    if (health.restingHR > 0 && health.restingHR < 55) {
      score3 += 1;
    }
    score3 = Math.min(3, score3);
  } else {
    // --- FALLBACK MODUS: RustHR + Hersteltijd + Lichaam ---
    mode = 'fallback';

    // Rust-hartslag (0-3)
    label1 = 'Rust HR';
    if (health.restingHR > 0) {
      if (health.restingHR < 52) {
        score1 = 3;
      } else if (health.restingHR < 56) {
        score1 = 2;
      } else if (health.restingHR < 60) {
        score1 = 1;
      }
    }

    // Hersteltijd sinds laatste training (0-3)
    label2 = 'Herstel';
    const hours = hoursSinceLastActivity(activities);
    if (hours > 36) {
      score2 = 3;
    } else if (hours > 20) {
      score2 = 2;
    } else if (hours > 10) {
      score2 = 1;
    }

    // Lichaam (0-3) — body battery als beschikbaar
    label3 = 'Lichaam';
    if (health.bodyBatteryChange > 20) {
      score3 += 2;
    } else if (health.bodyBatteryChange > 5) {
      score3 += 1;
    }
    // In fallback: als geen battery data, geef 1 punt als rustHR laag
    if (health.bodyBatteryChange === 0 && health.restingHR > 0 && health.restingHR < 55) {
      score3 += 1;
    }
    score3 = Math.min(3, score3);
  }

  const total = score1 + score2 + score3;
  const factors = { label1, score1, label2, score2, label3, score3 };

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
