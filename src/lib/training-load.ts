import { GarminActivity, GarminHealthStats, TrainingLoadData } from './types';

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
 * Genereer advies op basis van Body Battery + geplande training
 */
export function getBatteryAdvice(
  health: GarminHealthStats | null,
  hasTrainingToday: boolean
): { level: string; color: string; advice: string } {
  if (!health) {
    return { level: '–', color: 'text-gray-400', advice: 'Sync je Garmin om advies te krijgen.' };
  }

  const battery = health.bodyBatteryChange;
  const hrv = health.avgOvernightHrv;
  const sleepScore = health.sleepScore;

  // Herstel score: combinatie van battery change, HRV en slaap
  let recoveryScore = 0;
  if (battery > 30) recoveryScore += 2;
  else if (battery > 10) recoveryScore += 1;
  if (hrv > 50) recoveryScore += 2;
  else if (hrv > 30) recoveryScore += 1;
  if (sleepScore > 70) recoveryScore += 2;
  else if (sleepScore > 50) recoveryScore += 1;

  if (recoveryScore >= 5) {
    return {
      level: 'Goed hersteld',
      color: 'text-green-500',
      advice: hasTrainingToday
        ? 'Je bent goed hersteld. Ga vol voor de geplande training!'
        : 'Goed hersteld. Rustdag of lichte activiteit is prima.',
    };
  }
  if (recoveryScore >= 3) {
    return {
      level: 'Voldoende',
      color: 'text-yellow-500',
      advice: hasTrainingToday
        ? 'Redelijk hersteld. Doe de training, maar luister naar je lichaam.'
        : 'Matig herstel. Neem het rustig aan vandaag.',
    };
  }
  return {
    level: 'Onvoldoende',
    color: 'text-red-500',
    advice: hasTrainingToday
      ? 'Slecht hersteld. Overweeg een lichtere training of rustdag.'
      : 'Matig hersteld. Focus op herstel: rust, voeding en slaap.',
  };
}
