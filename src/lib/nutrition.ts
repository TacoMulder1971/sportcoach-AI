// Pure voedingslogica voor het wekelijkse voedingsrapport ("eet ik genoeg?").
// Combineert gelogde voeding (Yazio/MFP) met trainingsverbranding (Garmin) en
// een geschatte dagelijkse energiebehoefte uit het profiel.

import { NutritionLog, GarminActivity, UserProfile } from './types';
import { amsterdamDateForOffset } from './schedule';

const DAY_ABBR = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];

// Activiteitsfactor voor het dagelijks leven búiten training (licht actief);
// de training zelf wordt apart opgeteld via de Garmin-calorieën.
const DAILY_LIFE_FACTOR = 1.4;

// Een gelogde dag telt als "duidelijk te weinig" bij een tekort groter dan dit.
const SHORTFALL_KCAL = 400;
// Fallback-ondergrens als de behoefte onbekend is (geen gewicht/lengte in profiel).
const FALLBACK_LOW_KCAL = 1500;

export interface NutritionDaySummary {
  date: string;               // "2026-07-14"
  dayLabel: string;           // "ma"
  intake: NutritionLog | null;
  trainingMinutes: number;
  trainingKcal: number;
  sports: string[];
  estimatedNeedKcal: number | null; // BMR × 1.4 + trainingskcal (null zonder profielgegevens)
  balanceKcal: number | null;       // inname − behoefte (null als een van beide ontbreekt)
}

export interface NutritionWeekSummary {
  days: NutritionDaySummary[];      // 7 volle dagen, oud → nieuw (laatste = gisteren)
  daysLogged: number;
  avgIntakeKcal: number | null;
  avgCarbsG: number | null;
  avgProteinG: number | null;
  avgFatG: number | null;
  proteinPerKg: number | null;      // gem. eiwit / lichaamsgewicht
  totalTrainingMinutes: number;
  avgTrainingKcal: number;          // gemiddeld over alle 7 dagen (ook rustdagen)
  avgNeedKcal: number | null;       // gemiddelde geschatte behoefte over de week
  avgBalanceKcal: number | null;    // gemiddelde balans over gelogde dagen
  shortfallDays: number;            // gelogde dagen duidelijk onder de behoefte
  bmrKcal: number | null;
  weightKg: number | null;
}

/** BMR via Mifflin-St Jeor. Null als gewicht/lengte/geboortejaar ontbreken. */
export function estimateBMR(profile: UserProfile): number | null {
  const { weightKg, heightCm, birthYear, gender } = profile;
  if (!weightKg || !heightCm || !birthYear) return null;
  const age = new Date().getFullYear() - birthYear;
  if (age < 10 || age > 100) return null;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const offset = gender === 'vrouw' ? -161 : gender === 'anders' ? -78 : 5;
  return Math.round(base + offset);
}

/**
 * Bouw het weekoverzicht over de laatste 7 vólle dagen (gisteren t/m 7 dagen
 * geleden) — vandaag telt niet mee omdat er nog maaltijden kunnen komen.
 * `activities` = de stats-activiteiten (stadsfiets al uitgefilterd).
 */
export function buildNutritionWeekSummary(
  logs: NutritionLog[],
  activities: GarminActivity[],
  profile: UserProfile
): NutritionWeekSummary {
  const bmr = estimateBMR(profile);
  const logByDate = new Map(logs.map(l => [l.date, l]));

  const days: NutritionDaySummary[] = [];
  for (let offset = -7; offset <= -1; offset++) {
    const date = amsterdamDateForOffset(offset);
    const dayActs = activities.filter(a => a.date === date);
    const trainingKcal = dayActs.reduce((s, a) => s + (a.calories || 0), 0);
    const trainingMinutes = dayActs.reduce((s, a) => s + (a.durationMinutes || 0), 0);
    const intake = logByDate.get(date) ?? null;
    const need = bmr !== null ? Math.round(bmr * DAILY_LIFE_FACTOR) + trainingKcal : null;
    days.push({
      date,
      dayLabel: DAY_ABBR[new Date(`${date}T00:00:00`).getDay()],
      intake,
      trainingMinutes,
      trainingKcal,
      sports: [...new Set(dayActs.map(a => a.sport))],
      estimatedNeedKcal: need,
      balanceKcal: intake && need !== null ? intake.calories - need : null,
    });
  }

  const logged = days.filter(d => d.intake);
  const avg = (get: (d: NutritionDaySummary) => number): number | null =>
    logged.length > 0 ? Math.round(logged.reduce((s, d) => s + get(d), 0) / logged.length) : null;

  const avgIntakeKcal = avg(d => d.intake!.calories);
  const avgProteinG = avg(d => d.intake!.proteinG);
  const balances = logged.filter(d => d.balanceKcal !== null);
  const avgBalanceKcal = balances.length > 0
    ? Math.round(balances.reduce((s, d) => s + (d.balanceKcal as number), 0) / balances.length)
    : null;

  const needs = days.filter(d => d.estimatedNeedKcal !== null);
  const avgNeedKcal = needs.length > 0
    ? Math.round(needs.reduce((s, d) => s + (d.estimatedNeedKcal as number), 0) / needs.length)
    : null;

  const shortfallDays = logged.filter(d =>
    d.balanceKcal !== null ? d.balanceKcal < -SHORTFALL_KCAL : d.intake!.calories < FALLBACK_LOW_KCAL
  ).length;

  const weightKg = profile.weightKg || null;

  return {
    days,
    daysLogged: logged.length,
    avgIntakeKcal,
    avgCarbsG: avg(d => d.intake!.carbsG),
    avgProteinG,
    avgFatG: avg(d => d.intake!.fatG),
    proteinPerKg: weightKg && avgProteinG !== null ? Math.round((avgProteinG / weightKg) * 10) / 10 : null,
    totalTrainingMinutes: days.reduce((s, d) => s + d.trainingMinutes, 0),
    avgTrainingKcal: Math.round(days.reduce((s, d) => s + d.trainingKcal, 0) / days.length),
    avgNeedKcal,
    avgBalanceKcal,
    shortfallDays,
    bmrKcal: bmr,
    weightKg,
  };
}
