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
 * Trainingsgereedheid: visueel groen/geel/rood systeem
 * Combineert HRV, slaap en lichaam tot een score van 0-9
 */
export function getTrainingReadiness(
  health: GarminHealthStats | null,
  hasTrainingToday: boolean
): TrainingReadiness | null {
  if (!health) return null;

  // HRV score (0-3)
  let hrvScore = 0;
  const hrvStatus = (health.hrvStatus || '').toLowerCase();
  if (hrvStatus === 'balanced' || hrvStatus === 'good' || hrvStatus === 'optimal') {
    hrvScore = 3;
  } else if (health.avgOvernightHrv > 40) {
    hrvScore = 2;
  } else if (health.avgOvernightHrv > 25) {
    hrvScore = 1;
  }

  // Slaap score (0-3)
  let sleepScore = 0;
  if (health.sleepScore > 75) {
    sleepScore = 3;
  } else if (health.sleepScore > 55) {
    sleepScore = 2;
  } else if (health.sleepScore > 40) {
    sleepScore = 1;
  }

  // Lichaam score: battery + rusthartslag (0-3)
  let bodyScore = 0;
  if (health.bodyBatteryChange > 20) {
    bodyScore += 2;
  } else if (health.bodyBatteryChange > 5) {
    bodyScore += 1;
  }
  if (health.restingHR > 0 && health.restingHR < 55) {
    bodyScore += 1;
  }
  bodyScore = Math.min(3, bodyScore);

  const total = hrvScore + sleepScore + bodyScore;

  if (total >= 7) {
    return {
      level: 'klaar',
      label: 'Klaar',
      color: 'text-green-600',
      bgColor: 'bg-green-500',
      score: total,
      advice: hasTrainingToday
        ? 'Je bent goed hersteld. Ga vol voor de training!'
        : 'Top hersteld. Geniet van je rustdag.',
      factors: { hrv: hrvScore, sleep: sleepScore, body: bodyScore },
    };
  }
  if (total >= 4) {
    return {
      level: 'matig',
      label: 'Matig',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-400',
      score: total,
      advice: hasTrainingToday
        ? 'Redelijk hersteld. Train, maar luister naar je lichaam.'
        : 'Matig herstel. Neem het rustig aan vandaag.',
      factors: { hrv: hrvScore, sleep: sleepScore, body: bodyScore },
    };
  }
  return {
    level: 'rust_nodig',
    label: 'Rust nodig',
    color: 'text-red-500',
    bgColor: 'bg-red-500',
    score: total,
    advice: hasTrainingToday
      ? 'Neem het rustig aan of kies voor een lichte hersteltraining.'
      : 'Focus op herstel: rust, voeding en slaap.',
    factors: { hrv: hrvScore, sleep: sleepScore, body: bodyScore },
  };
}
