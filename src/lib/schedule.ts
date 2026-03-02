import { trainingPlan } from '@/data/training-plan';
import { TrainingDay } from './types';

export function getTodayDayIndex(): number {
  const day = new Date().getDay();
  // JS: 0=Sunday, convert to 0=Monday
  return day === 0 ? 6 : day - 1;
}

export function getCurrentWeekNumber(): 1 | 2 {
  // Determine which week of the 2-week cycle we're in
  const startDate = new Date('2026-02-23'); // Start van cyclus (een maandag)
  const today = new Date();
  const diffDays = Math.floor(
    (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  const weeksSinceStart = Math.floor(diffDays / 7);
  return (weeksSinceStart % 2 === 0 ? 1 : 2) as 1 | 2;
}

export function getTodayTraining(): TrainingDay | null {
  const weekNum = getCurrentWeekNumber();
  const dayIndex = getTodayDayIndex();
  const week = trainingPlan.find((w) => w.weekNumber === weekNum);
  return week?.days.find((d) => d.dayIndex === dayIndex) ?? null;
}

export function getWeekTrainings(weekNumber: 1 | 2): TrainingDay[] {
  const week = trainingPlan.find((w) => w.weekNumber === weekNumber);
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
