export type Sport = 'zwemmen' | 'fietsen' | 'hardlopen' | 'mountainbike' | 'rust';

export type HeartRateZone = 'Z1' | 'Z2' | 'Z3' | 'Z4';

export interface HeartRateZoneInfo {
  zone: HeartRateZone;
  label: string;
  min: number;
  max: number;
  color: string;
}

export interface TrainingSession {
  sport: Sport;
  type: string; // e.g. "interval", "duur", "tempo", "herstel"
  durationMinutes?: number;
  zone?: HeartRateZone;
  description: string;
}

export interface TrainingDay {
  day: string; // ma, di, wo, do, vr, za, zo
  dayIndex: number; // 0=ma, 6=zo
  sessions: TrainingSession[];
  isRestDay: boolean;
}

export interface TrainingWeek {
  weekNumber: 1 | 2;
  label: string;
  days: TrainingDay[];
}

export interface CheckIn {
  id: string;
  date: string; // ISO date
  trainingDay: string;
  feeling: 1 | 2 | 3 | 4 | 5;
  note: string;
  sessions: TrainingSession[];
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface UserProfile {
  name: string;
  maxHR: number;
  raceDate: string; // ISO date
  raceGoal: string;
  raceType: string;
}

export const HEART_RATE_ZONES: HeartRateZoneInfo[] = [
  { zone: 'Z1', label: 'Herstel', min: 103, max: 120, color: '#22c55e' },
  { zone: 'Z2', label: 'Aeroob', min: 121, max: 137, color: '#3b82f6' },
  { zone: 'Z3', label: 'Tempo', min: 138, max: 151, color: '#f59e0b' },
  { zone: 'Z4', label: 'Drempel', min: 152, max: 163, color: '#ef4444' },
];

export const SPORT_ICONS: Record<Sport, string> = {
  zwemmen: 'Z',
  fietsen: 'F',
  hardlopen: 'H',
  mountainbike: 'M',
  rust: 'R',
};

export const SPORT_COLORS: Record<Sport, string> = {
  zwemmen: 'bg-blue-500',
  fietsen: 'bg-green-500',
  hardlopen: 'bg-orange-500',
  mountainbike: 'bg-emerald-600',
  rust: 'bg-gray-400',
};

export const FEELING_SCALE: Record<number, { label: string; color: string; textColor: string }> = {
  1: { label: 'Zeer slecht', color: 'bg-red-500', textColor: 'text-white' },
  2: { label: 'Matig', color: 'bg-orange-400', textColor: 'text-white' },
  3: { label: 'Oké', color: 'bg-yellow-400', textColor: 'text-gray-800' },
  4: { label: 'Goed', color: 'bg-lime-500', textColor: 'text-white' },
  5: { label: 'Uitstekend', color: 'bg-green-500', textColor: 'text-white' },
};

export const DEFAULT_PROFILE: UserProfile = {
  name: '',
  maxHR: 172,
  raceDate: '2026-06-13',
  raceGoal: 'Onder de 3 uur',
  raceType: '1/4 Triatlon',
};

// Garmin types
export interface GarminActivity {
  id: number;
  date: string; // ISO date
  sport: Sport | 'overig';
  activityName: string;
  durationMinutes: number;
  distanceKm: number;
  avgHR: number;
  maxHR: number;
  calories: number;
  avgSpeed: number; // km/h
}

export interface GarminHealthStats {
  date: string;
  sleepDurationHours: number;
  sleepScore: number;
  deepSleepMinutes: number;
  remSleepMinutes: number;
  avgOvernightHrv: number;
  hrvStatus: string;
  restingHR: number;
  bodyBatteryChange: number;
  steps: number;
}

export interface TrainingLoadData {
  weekLoad: number; // TRIMP over 7 dagen
  status: 'laag' | 'optimaal' | 'hoog' | 'overbelast';
  statusColor: string;
  advice: string;
}

export interface GarminSyncData {
  activities: GarminActivity[];
  health: GarminHealthStats | null;
  syncedAt: string;
}
