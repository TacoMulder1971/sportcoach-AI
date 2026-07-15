export type Sport = 'zwemmen' | 'fietsen' | 'hardlopen' | 'mountainbike' | 'wandelen' | 'voetballen' | 'multisport' | 'kracht' | 'rust';

export interface GarminCredentials {
  email: string;
  password: string;
}

export interface YazioCredentials {
  email: string;
  password: string;
}

// Zwem-locatie varianten — onderscheiden binnen-/buitenbad en openwater per activiteit
export type SwimVariant = 'zwembad_binnen' | 'zwembad_buiten' | 'openwater';

// Per-activiteit override van de zwem-variant (apart van GarminActivity opgeslagen)
export type ActivitySwimVariants = Record<string, SwimVariant>; // activityId -> variant

export const SWIM_VARIANT_LABEL: Record<SwimVariant, string> = {
  zwembad_binnen: 'Zwembad (binnen)',
  zwembad_buiten: 'Zwembad (buiten)',
  openwater: 'Openwater',
};

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

// Bevroren dagplanning voor de "Volgens plan"-kaart: wat stond er op deze
// kalenderdag gepland onder het toen-actieve schema. Voorbije dagen worden
// nooit overschreven, zodat een schemawissel de adherentie-historie niet
// herschrijft. Zie recordPlannedDays() in storage.ts.
export interface PlannedDayRecord {
  date: string;                // Amsterdamse kalenderdag (YYYY-MM-DD)
  hasPlan: boolean;            // false = geen actief schema op deze dag
  restDay: boolean;
  sessions: TrainingSession[]; // leeg bij rustdag of geen plan
}

// Gedetailleerde uitsplitsing van één trainingssessie (warming-up, blokken, cooldown).
// AI-gegenereerd on-demand en per dag gecached — zie /api/session-breakdown.
export type SegmentKind = 'warmup' | 'block' | 'cooldown';

export interface SessionSegment {
  kind: SegmentKind;
  label: string;        // bijv. "Warming-up", "Blok 1 — intervallen", "Cooldown"
  minutes: number;
  zone?: HeartRateZone; // Z1–Z5
  detail: string;       // wat te doen (Nederlands)
  technique?: string;   // korte techniekfocus (Nederlands, optioneel)
}

export interface SessionBreakdown {
  segments: SessionSegment[];
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

export interface HRZoneConfig {
  z1min: number; // ondergrens Z1 (Z1 loopt van z1min t/m z2min-1)
  z2min: number;
  z3min: number;
  z4min: number;
  z5min: number;
  maxHR: number; // bovengrens Z5
}

/** Handmatig zwem-richttempo voor één zone (sec/100m). */
export interface SwimPaceZone {
  minSecPer100: number; // sneller uiteinde
  maxSecPer100: number; // langzamer uiteinde
}

/** Sporten die een gebruiker kan trainen (subset van Sport). */
export type TrainingSport = 'zwemmen' | 'fietsen' | 'hardlopen' | 'mountainbike';
export const ALL_TRAINING_SPORTS: TrainingSport[] = ['zwemmen', 'fietsen', 'hardlopen', 'mountainbike'];

export type AthleteLevel = 'beginner' | 'gevorderd' | 'ervaren';
export type Gender = 'man' | 'vrouw' | 'anders';

export interface UserProfile {
  name: string;
  maxHR: number;                // max hartslag hardlopen (legacy, ook z5max)
  maxHRCycling?: number;        // max hartslag fietsen (legacy)
  hrZonesRun?: HRZoneConfig;    // aangepaste zones hardlopen
  hrZonesCycling?: HRZoneConfig;// aangepaste zones fietsen
  swimPaceZones?: SwimPaceZone[]; // handmatige zwemtempo's Z1–Z5; leeg = automatisch uit archief
  raceDate: string;
  raceGoal: string;
  raceType: string;
  // Personalisatie (2026-07-06, multi-user): ontbreekt `onboarded` dan is het
  // een legacy-profiel → migratie in getProfile() vult de velden aan.
  sports?: TrainingSport[];         // welke sporten traint deze gebruiker
  birthYear?: number;               // → default max HR (220 − leeftijd)
  gender?: Gender;
  weightKg?: number;                // lichaamsgewicht in kg
  heightCm?: number;                // lengte in cm
  level?: AthleteLevel;
  trainingDaysPerWeek?: number;     // 2..7
  strengthTraining?: boolean;       // 40-min krachttraining inplannen (core is altijd aan)
  coachNotes?: string;              // vrije coach-wensen, gaan mee in alle AI-prompts
  onboarded?: boolean;              // onboarding doorlopen (of legacy-migratie)
}

/**
 * Bereken zones op basis van max HR (50/60/70/80/90/100%).
 */
export function computeHRZones(maxHR: number): HeartRateZoneInfo[] {
  const pct = (p: number) => Math.round(p * maxHR);
  return [
    { zone: 'Z1', label: 'Herstel',  min: pct(0.50), max: pct(0.60), color: '#9ca3af' },
    { zone: 'Z2', label: 'Basis',    min: pct(0.60), max: pct(0.70), color: '#22c55e' },
    { zone: 'Z3', label: 'Aeroob',   min: pct(0.70), max: pct(0.80), color: '#3b82f6' },
    { zone: 'Z4', label: 'Drempel',  min: pct(0.80), max: pct(0.90), color: '#f59e0b' },
    { zone: 'Z5', label: 'VO2max',   min: pct(0.90), max: maxHR,     color: '#ef4444' },
  ];
}

/** Zones voor hardlopen bij standaard max HR 172 (backward-compat). */
export const HEART_RATE_ZONES: HeartRateZoneInfo[] = computeHRZones(172);

export const SPORT_ICONS: Record<Sport, string> = {
  zwemmen: 'Z',
  fietsen: 'F',
  hardlopen: 'H',
  mountainbike: 'M',
  wandelen: 'W',
  voetballen: 'V',
  multisport: 'MS',
  kracht: 'K',
  rust: 'R',
};

export const SPORT_COLORS: Record<Sport, string> = {
  zwemmen: 'bg-blue-500',
  fietsen: 'bg-green-500',
  hardlopen: 'bg-orange-500',
  mountainbike: 'bg-emerald-600',
  wandelen: 'bg-teal-500',
  voetballen: 'bg-yellow-500',
  multisport: 'bg-purple-500',
  kracht: 'bg-rose-500',
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
  maxHRCycling: 164,
  raceDate: '2026-06-13',
  raceGoal: 'Onder de 3 uur',
  raceType: '1/4 Triatlon',
};

/** Zet een HRZoneConfig om naar HeartRateZoneInfo[]. */
export function hrZoneConfigToZones(cfg: HRZoneConfig): HeartRateZoneInfo[] {
  return [
    { zone: 'Z1', label: 'Herstel',  min: cfg.z1min, max: cfg.z2min - 1, color: '#9ca3af' },
    { zone: 'Z2', label: 'Basis',    min: cfg.z2min, max: cfg.z3min - 1, color: '#22c55e' },
    { zone: 'Z3', label: 'Aeroob',   min: cfg.z3min, max: cfg.z4min - 1, color: '#3b82f6' },
    { zone: 'Z4', label: 'Drempel',  min: cfg.z4min, max: cfg.z5min - 1, color: '#f59e0b' },
    { zone: 'Z5', label: 'VO2max',   min: cfg.z5min, max: cfg.maxHR,     color: '#ef4444' },
  ];
}

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
  splits?: { distance: number; durationSeconds: number; avgHR: number; avgPower?: number; sport?: string }[]; // rondes/blokken
  isMultisport?: boolean;      // brick-training of triatlon (Garmin multi_sport / triathlon)
  swimVariant?: SwimVariant;   // door Garmin afgeleide zwem-locatie (binnen/openwater); user-override apart opgeslagen
}

export interface GarminHealthStats {
  date: string;
  sleepDurationHours: number;
  sleepScore: number;
  deepSleepMinutes: number;
  remSleepMinutes: number;
  avgOvernightHrv: number;
  hrvStatus: string;
  hrvBaseline?: number;          // 7-daags HRV-gemiddelde (Garmin weeklyAvg) = marker binnen de band
  hrvBaselineLow?: number;       // ondergrens balans-bandbreedte (Garmin baseline.balancedLow)
  hrvBaselineHigh?: number;      // bovengrens balans-bandbreedte (Garmin baseline.balancedUpper)
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
  score: number; // som van scoorbare factoren
  maxScore: number; // som van max van scoorbare factoren (negen indien volledig)
  advice: string;
  mode: 'full' | 'fallback'; // full=met slaapdata, fallback=zonder
  dataComplete: boolean; // false als één of meer factoren ontbrekend zijn (bv. horloge 's nachts uit)
  factors: {
    label1: string; score1: number | null; max1: number;
    label2: string; score2: number | null; max2: number;
    label3: string; score3: number | null; max3: number;
  };
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

// Weersomstandigheden op een racedag (via Open-Meteo, gecached per goal)
export interface RaceWeather {
  date: string;
  tempMaxC: number;
  tempMinC: number;
  precipitationMm: number;
  windMaxKmh: number;
  weatherCode: number;        // WMO weather interpretation code
  description: string;        // NL omschrijving ("Lichte regen", "Zonnig", ...)
  source: 'archief' | 'verwachting';
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
  aiEvaluation?: string;     // AI-coach-evaluatie van de race (gegenereerd na invullen)
}

export interface DisciplineDistances {
  swim?: number;   // km
  bike?: number;   // km
  run?: number;    // km (of eerste loop bij duatlon)
  run2?: number;   // km tweede loop (alleen duatlon)
}

export interface Goal {
  id: string;                  // UUID — forward-compatible met multi-user DB
  type: GoalType;
  name: string;                // bv. "1/4 Triatlon Eindhoven"
  date: string;                // ISO "2026-06-13"
  targetTimeSeconds?: number;  // streeftijd in seconden (optioneel)
  disciplineDistancesKm?: DisciplineDistances; // werkelijke afstanden per onderdeel
  location?: string;
  note?: string;
  status: 'active' | 'archived';
  result?: GoalResult;         // gevuld bij archiveren
  createdAt: string;           // ISO
  archivedAt?: string;         // ISO
}

// ── Materiaal / Equipment ───────────────────────────────────────────
// Houdt fietsen, schoenen e.d. bij. Slijtage via km uit Garmin-activiteiten,
// onderhoud (smeren, Di2 opladen, etc.) via terugkerende intervallen.

// Drie soorten fietsen omdat ze andere onderhouds-intervallen en sport-koppeling hebben.
// 'fiets' is een legacy-waarde die automatisch wordt gemigreerd naar 'racefiets'.
export type EquipmentType =
  | 'racefiets'
  | 'mountainbike'
  | 'stadsfiets'
  | 'hardloopschoenen'
  | 'overig'
  | 'fiets'; // deprecated — gemigreerd bij app start

export interface MaintenanceItem {
  id: string;
  name: string;              // bv. "Ketting smeren", "Di2 opladen", "Ketting vervangen"
  lastDoneAt: string;        // ISO datum
  lastDoneKm?: number;       // km-stand van de equipment bij die actie (voor km-interval)
  intervalDays?: number;     // herhaalinterval in dagen
  intervalKm?: number;       // herhaalinterval in km
}

export interface Equipment {
  id: string;
  type: EquipmentType;
  name: string;              // bv. "Cervelo S5", "Saucony Endorphin Speed 4 (rood)"
  sport: Sport;              // welke sport-activiteiten tellen voor de km
  isDefault?: boolean;       // default-keuze voor activiteit-toewijzing (max 1 per type+sport)
  acquiredAt: string;        // ISO datum aankoop/installatie
  startKm: number;           // 0 default; >0 bij tweedehands of bij overzetten
  kmLimit?: number;          // vervangdrempel (alleen voor verbruiksartikelen zoals schoenen)
  status: 'active' | 'retired';
  retiredAt?: string;        // ISO; daarna geen nieuwe km meer
  maintenance?: MaintenanceItem[];
  note?: string;
  createdAt: string;         // ISO
}

// Per-activiteit override: welk Equipment is gebruikt voor een Garmin-activiteit.
// Apart van Equipment opgeslagen zodat we bij gear-wissel niets hoeven aan te raken.
export type ActivityAssignments = Record<string, string>; // activityId -> equipmentId

export const EQUIPMENT_DEFAULT_LIMITS: Partial<Record<EquipmentType, number>> = {
  hardloopschoenen: 700,
};

export const EQUIPMENT_DEFAULT_MAINTENANCE: Record<EquipmentType, Omit<MaintenanceItem, 'id' | 'lastDoneAt'>[]> = {
  racefiets: [
    { name: 'Ketting smeren', intervalKm: 300, intervalDays: 14 },
    { name: 'Ketting vervangen', intervalKm: 4000 },
    { name: 'Di2 opladen', intervalDays: 180 },
  ],
  mountainbike: [
    { name: 'Ketting smeren', intervalKm: 150, intervalDays: 10 },
    { name: 'Ketting vervangen', intervalKm: 2500 },
    { name: 'Vering service', intervalDays: 365 },
    { name: 'Remblokken controleren', intervalKm: 1000 },
  ],
  stadsfiets: [], // bewust leeg: alleen registratie, geen automatische onderhouds-suggesties
  hardloopschoenen: [],
  overig: [],
  fiets: [], // legacy
};

export const EQUIPMENT_TYPE_LABEL: Record<EquipmentType, string> = {
  racefiets: 'Racefiets',
  mountainbike: 'Mountainbike',
  stadsfiets: 'Stadsfiets',
  hardloopschoenen: 'Hardloopschoenen',
  overig: 'Overig',
  fiets: 'Fiets', // legacy
};
