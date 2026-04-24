export type Sport = 'zwemmen' | 'fietsen' | 'hardlopen' | 'mountainbike' | 'rust';

export type HeartRateZone = 'Z1' | 'Z2' | 'Z3' | 'Z4' | 'Z5';

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

export interface CheckInMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface CheckIn {
  id: string;
  date: string; // ISO date
  trainingDay: string;
  feeling: 1 | 2 | 3 | 4 | 5;
  note: string;
  sessions: TrainingSession[];
  feedback?: string; // AI coach feedback na check-in (backward compat)
  messages?: CheckInMessage[]; // gesprek na check-in
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
  { zone: 'Z1', label: 'Herstel', min: 86, max: 103, color: '#9ca3af' },
  { zone: 'Z2', label: 'Basis', min: 103, max: 120, color: '#22c55e' },
  { zone: 'Z3', label: 'Aeroob', min: 120, max: 138, color: '#3b82f6' },
  { zone: 'Z4', label: 'Drempel', min: 138, max: 155, color: '#f59e0b' },
  { zone: 'Z5', label: 'VO2max', min: 155, max: 172, color: '#ef4444' },
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
  date: string; // ISO date "2026-03-29"
  startTime?: string; // "07:45" lokale tijd
  sport: Sport | 'overig';
  activityName: string;
  durationMinutes: number;
  distanceKm: number;
  avgHR: number;
  maxHR: number;
  calories: number;
  avgSpeed: number; // km/h
  trainingEffectAerobic: number; // 0-5
  trainingEffectAnaerobic: number; // 0-5
  avgRunCadence: number; // spm (hardlopen)
  avgBikeCadence: number; // rpm (fietsen)
  elevationGain: number; // meters
  elevationLoss: number; // meters
  vo2Max: number;
  avgPace: string; // berekend: "5:23/km" of "28.5 km/h"
  hrZones?: { zone: string; minutes: number }[]; // bijv. [{zone:"Z1", minutes:5}, {zone:"Z2", minutes:25}]
  avgPower?: number;           // watt (fietsen met Edge 530)
  normalizedPower?: number;    // gecorrigeerd vermogen in watt
  trainingStressScore?: number; // TSS per activiteit
  splits?: { distance: number; durationSeconds: number; avgHR: number; avgPower?: number }[]; // rondes/blokken
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
  avgRespirationRate?: number;   // ademhalingen/minuut tijdens slaap
  lactateThresholdHR?: number;   // lactaatdrempel hartslag (bpm)
  lactateThresholdPace?: string; // lactaatdrempel tempo (bijv. "4:35/km")
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

export interface TrainingReadiness {
  level: 'klaar' | 'matig' | 'rust_nodig';
  label: string;
  color: string;
  bgColor: string;
  score: number; // 0-9
  advice: string;
  mode: 'full' | 'fallback'; // full=met slaapdata, fallback=zonder
  factors: { label1: string; score1: number; max1: number; label2: string; score2: number; max2: number; label3: string; score3: number; max3: number };
}

export interface TrainingAdvice {
  level: 'go' | 'adjust' | 'rest';
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  iconColor: string;
  message: string;
}

// Dynamisch schema genereren
export interface DayPreference {
  weekNumber: 1 | 2;
  dayIndex: number;
  preference: string; // vrije tekst, bv "ochtend zwemmen, avond hardlopen"
}

export interface AgendaInput {
  blockedDays: { weekNumber: 1 | 2; dayIndex: number; reason?: string }[];
  constraints: string;
  dayPreferences?: DayPreference[];
}

export interface StoredPlan {
  id: string;
  plan: TrainingWeek[];
  cycleStartDate: string; // ISO, altijd een maandag
  createdAt: string;
  agendaInput: AgendaInput;
  status: 'active' | 'archived';
}

export interface NutritionLog {
  date: string;          // "2026-03-25"
  calories: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  fiberG: number;
  aiFeedback?: string;   // gecached AI-feedback
}

// ============================================================
// Doelen (Goals) — wedstrijddoelen met resultaatarchief
// ============================================================

export type GoalType =
  | '5km'
  | '10km'
  | 'halve_marathon'
  | 'marathon'
  | 'kwart_triatlon'    // 1/4 (sprint-achtig)
  | 'halve_triatlon'    // 1/2 (70.3)
  | 'hele_triatlon'     // hele (140.6)
  | 'duatlon'
  | 'fietstocht'
  | 'zwemtocht'
  | 'eigen';

export interface GoalTypeInfo {
  type: GoalType;
  label: string;
  multiSport: boolean;                        // heeft splits per onderdeel
  disciplines?: ('zwemmen' | 'fietsen' | 'hardlopen')[]; // volgorde voor splits
}

export const GOAL_TYPES: GoalTypeInfo[] = [
  { type: '5km',              label: '5 km',              multiSport: false },
  { type: '10km',             label: '10 km',             multiSport: false },
  { type: 'halve_marathon',   label: '1/2 marathon',      multiSport: false },
  { type: 'marathon',         label: 'Marathon',          multiSport: false },
  { type: 'kwart_triatlon',   label: '1/4 triatlon',      multiSport: true,  disciplines: ['zwemmen', 'fietsen', 'hardlopen'] },
  { type: 'halve_triatlon',   label: '1/2 triatlon',      multiSport: true,  disciplines: ['zwemmen', 'fietsen', 'hardlopen'] },
  { type: 'hele_triatlon',    label: 'Hele triatlon',     multiSport: true,  disciplines: ['zwemmen', 'fietsen', 'hardlopen'] },
  { type: 'duatlon',          label: 'Duatlon',           multiSport: true,  disciplines: ['hardlopen', 'fietsen', 'hardlopen'] },
  { type: 'fietstocht',       label: 'Fietstocht',        multiSport: false },
  { type: 'zwemtocht',        label: 'Zwemtocht',         multiSport: false },
  { type: 'eigen',            label: 'Eigen doel',        multiSport: false },
];

export interface GoalSplit {
  discipline: string;        // "zwemmen" / "fietsen" / "hardlopen" / "T1" / "T2" / etc.
  timeSeconds: number;       // duur van dit onderdeel in seconden
  distanceKm?: number;       // optioneel
}

export interface GoalResult {
  totalTimeSeconds: number;  // eindtijd in seconden
  splits?: GoalSplit[];      // per onderdeel (alleen multi-sport)
  rating: 1 | 2 | 3 | 4 | 5; // beoordeling
  timeReflection: string;    // reflectie over tijd vs doel
  trainingReflection: string;// reflectie over trainingen (langer)
  filledAt: string;          // ISO datum dat resultaat is ingevuld
}

export interface Goal {
  id: string;                  // UUID — forward-compatible met multi-user DB
  type: GoalType;
  name: string;                // bv. "1/4 Triatlon Eindhoven"
  date: string;                // ISO "2026-06-13"
  targetTimeSeconds?: number;  // streeftijd in seconden (optioneel)
  location?: string;
  note?: string;
  status: 'active' | 'archived';
  result?: GoalResult;         // gevuld bij archiveren
  createdAt: string;           // ISO
  archivedAt?: string;         // ISO
}
