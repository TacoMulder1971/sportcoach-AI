import { trainingPlan } from '@/data/training-plan';
import { TrainingDay, TrainingWeek } from './types';

const DEFAULT_CYCLE_START = '2026-02-23';

export function getTodayDayIndex(): number {
  const day = new Date().getDay();
  // JS: 0=Sunday, convert to 0=Monday
  return day === 0 ? 6 : day - 1;
}

export function getCurrentWeekNumber(cycleStartDate?: string): 1 | 2 {
  const startDate = new Date(cycleStartDate || DEFAULT_CYCLE_START);
  const today = new Date();
  const diffDays = Math.floor(
    (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const weeksSinceStart = Math.floor(diffDays / 7);
  return (weeksSinceStart % 2 === 0 ? 1 : 2) as 1 | 2;
}

export function getTodayTraining(
  plan?: TrainingWeek[],
  cycleStartDate?: string
): TrainingDay | null {
  const p = plan || trainingPlan;
  const weekNum = getCurrentWeekNumber(cycleStartDate);
  const dayIndex = getTodayDayIndex();
  const week = p.find((w) => w.weekNumber === weekNum);
  return week?.days.find((d) => d.dayIndex === dayIndex) ?? null;
}

export function getWeekTrainings(
  weekNumber: 1 | 2,
  plan?: TrainingWeek[]
): TrainingDay[] {
  const p = plan || trainingPlan;
  const week = p.find((w) => w.weekNumber === weekNumber);
  return week?.days ?? [];
}

export function getDaysUntilRace(raceDate: string): number {
  const race = new Date(raceDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  race.setHours(0, 0, 0, 0);
  return Math.ceil((race.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hrs}u ${mins}min` : `${hrs}u`;
}

export function getDaysInCurrentCycle(cycleStartDate?: string): number {
  const startDate = new Date(cycleStartDate || DEFAULT_CYCLE_START);
  const today = new Date();
  const diffDays = Math.floor(
    (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  return (diffDays % 14) + 1; // dag 1-14 in de cyclus
}

export function getMondayOfCurrentWeek(): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay(); // 0=Sun
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysToMonday);
  return monday.toISOString().split('T')[0];
}

export function getNextMonday(): string {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun
  const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 7 : 8 - dayOfWeek;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);
  return nextMonday.toISOString().split('T')[0];
}
