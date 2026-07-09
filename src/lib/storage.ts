import { CheckIn, ChatMessage, UserProfile, DEFAULT_PROFILE, GarminSyncData, GarminActivity, GarminHealthStats, StoredPlan, TrainingWeek, HeartRateZone, NutritionLog, Goal, GoalResult, GOAL_TYPES, Equipment, MaintenanceItem, ActivityAssignments, EQUIPMENT_DEFAULT_MAINTENANCE, SwimVariant, ActivitySwimVariants, RaceWeather, GarminCredentials, YazioCredentials, computeHRZones, HRZoneConfig, hrZoneConfigToZones, HeartRateZoneInfo, SessionBreakdown, TrainingSession } from './types';
import { trainingPlan } from '@/data/training-plan';
import { StrengthWorkout, StrengthWorkoutId, DEFAULT_STRENGTH_WORKOUTS, pickStrengthWorkoutId } from './strength';
import { SwimPaceTargets, estimateSwimPaceTargets, buildSwimPaceTargetsFromZones } from './swim';

// Safe UUID generator that works on HTTP (crypto.randomUUID requires HTTPS on iOS Safari)
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

const KEYS = {
  CHECK_INS: 'tricoach_checkins',
  CHAT_MESSAGES: 'tricoach_chat',
  PROFILE: 'tricoach_profile',
  GARMIN_DATA: 'tricoach_garmin',
  PLANS: 'tricoach_plans',
  ACTIVE_PLAN_ID: 'tricoach_active_plan_id',
  DAILY_MESSAGE: 'tricoach_daily_message',
  WEEKLY_REPORT: 'tricoach_weekly_report',
  NUTRITION: 'tricoach_nutrition',
  GOALS: 'tricoach_goals',
  GOALS_MIGRATED: 'tricoach_goals_migrated',
  GOAL_RESULT_DISMISSED: 'tricoach_goal_result_dismissed',
  EQUIPMENT: 'tricoach_equipment',
  ACTIVITY_ASSIGNMENTS: 'tricoach_activity_assignments',
  EQUIPMENT_MIGRATED_V1: 'tricoach_equipment_migrated_v1',
  SWIM_VARIANTS: 'tricoach_swim_variants',
  LAST_SWIM_VARIANT: 'tricoach_last_swim_variant',
  ACTIVITY_ARCHIVE: 'tricoach_activity_archive',
  HEALTH_ARCHIVE: 'tricoach_health_archive',
  RACE_WEATHER: 'tricoach_race_weather',
  GARMIN_CREDENTIALS: 'tricoach_garmin_credentials',
  YAZIO_CREDENTIALS: 'tricoach_yazio_credentials',
  SESSION_BREAKDOWN: 'tricoach_session_breakdown',
  STRENGTH_WORKOUTS: 'tricoach_strength_workouts',
  CYCLE_WEEK_FLIP: 'tricoach_cycle_week_flip',
} as const;

const AUTO_BACKUP_KEY = 'tricoach_last_backup';
const BACKUP_INTERVAL_DAYS = 7;

function getItem<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

function setItem<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    console.error('Failed to save to localStorage');
  }
}

// Check-ins
export function getCheckIns(): CheckIn[] {
  return getItem<CheckIn[]>(KEYS.CHECK_INS, []);
}

export function saveCheckIn(checkIn: CheckIn): void {
  const checkIns = getCheckIns();
  checkIns.push(checkIn);
  setItem(KEYS.CHECK_INS, checkIns);
}

export function getCheckInsForDate(date: string): CheckIn[] {
  return getCheckIns().filter((c) => c.date === date);
}

export function getRecentCheckIns(count: number = 7): CheckIn[] {
  const checkIns = getCheckIns();
  return checkIns.slice(-count).reverse();
}

export function updateCheckIn(id: string, updates: Partial<CheckIn>): void {
  const checkIns = getCheckIns();
  const index = checkIns.findIndex((c) => c.id === id);
  if (index !== -1) {
    checkIns[index] = { ...checkIns[index], ...updates };
    setItem(KEYS.CHECK_INS, checkIns);
  }
}

// Daily message — cache 1x per dag
interface DailyMessage {
  key: string; // "2026-03-17"
  message: string;
}

function getTodayAmsterdam(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' });
}

export function getDailyMessage(): DailyMessage | null {
  const stored = getItem<DailyMessage | null>(KEYS.DAILY_MESSAGE, null);
  if (!stored) return null;
  return stored.key === getTodayAmsterdam() ? stored : null;
}

export function saveDailyMessage(message: string): void {
  setItem(KEYS.DAILY_MESSAGE, { key: getTodayAmsterdam(), message });
}

export function clearDailyMessage(): void {
  setItem(KEYS.DAILY_MESSAGE, null);
}

// Gedetailleerde sessie-uitsplitsing — cache 1x per dag, opnieuw bij schemawijziging
interface SessionBreakdownCache {
  key: string;          // Amsterdam-datum
  signature: string;    // handtekening van de sessies van vandaag
  breakdowns: SessionBreakdown[]; // per sessie-index, uitgelijnd op de sessies
}

/** Handtekening van de sessies — wijzigt zodra het schema voor vandaag verandert. */
export function sessionsSignature(
  sessions: { sport: string; type: string; durationMinutes?: number; zone?: string; description: string }[]
): string {
  return sessions
    .map((s) => `${s.sport}|${s.type}|${s.durationMinutes ?? ''}|${s.zone ?? ''}|${s.description}`)
    .join('::');
}

export function getSessionBreakdowns(signature: string): SessionBreakdown[] | null {
  const stored = getItem<SessionBreakdownCache | null>(KEYS.SESSION_BREAKDOWN, null);
  if (!stored) return null;
  if (stored.key !== getTodayAmsterdam() || stored.signature !== signature) return null;
  return stored.breakdowns;
}

export function saveSessionBreakdowns(signature: string, breakdowns: SessionBreakdown[]): void {
  setItem(KEYS.SESSION_BREAKDOWN, { key: getTodayAmsterdam(), signature, breakdowns });
}

// ── Krachtworkouts (aanpasbare oefenlijsten) ────────────────────────
// De gebruiker kan de core- en kracht-workout aanpassen. Aangepaste versies
// worden hier opgeslagen; niet-aangepaste vallen terug op DEFAULT_STRENGTH_WORKOUTS.
export function getStrengthWorkouts(): Record<StrengthWorkoutId, StrengthWorkout> {
  const stored = getItem<Partial<Record<StrengthWorkoutId, StrengthWorkout>>>(KEYS.STRENGTH_WORKOUTS, {});
  return {
    core7: stored.core7 ?? DEFAULT_STRENGTH_WORKOUTS.core7,
    'tri-strength': stored['tri-strength'] ?? DEFAULT_STRENGTH_WORKOUTS['tri-strength'],
  };
}

export function saveStrengthWorkout(workout: StrengthWorkout): void {
  const stored = getItem<Partial<Record<StrengthWorkoutId, StrengthWorkout>>>(KEYS.STRENGTH_WORKOUTS, {});
  setItem(KEYS.STRENGTH_WORKOUTS, { ...stored, [workout.id]: workout });
}

/** Zet één workout terug naar de standaard (verwijdert de aangepaste versie). */
export function resetStrengthWorkout(id: StrengthWorkoutId): void {
  const stored = getItem<Partial<Record<StrengthWorkoutId, StrengthWorkout>>>(KEYS.STRENGTH_WORKOUTS, {});
  delete stored[id];
  setItem(KEYS.STRENGTH_WORKOUTS, stored);
}

/** De (mogelijk aangepaste) workout die bij een geplande krachtsessie hoort. */
export function getStrengthWorkoutForSession(session: TrainingSession): StrengthWorkout {
  return getStrengthWorkouts()[pickStrengthWorkoutId(session)];
}

// Auto-sync throttle (1x per dag)
const AUTO_SYNC_KEY = 'tricoach_last_auto_sync';

export function shouldAutoSync(): boolean {
  if (typeof window === 'undefined') return false;
  const last = localStorage.getItem(AUTO_SYNC_KEY);
  if (!last) return true;
  const today = new Date().toISOString().split('T')[0];
  return last !== today;
}

export function markAutoSyncDone(): void {
  const today = new Date().toISOString().split('T')[0];
  localStorage.setItem(AUTO_SYNC_KEY, today);
}

// Chat messages
export function getChatMessages(): ChatMessage[] {
  return getItem<ChatMessage[]>(KEYS.CHAT_MESSAGES, []);
}

export function saveChatMessage(message: ChatMessage): void {
  const messages = getChatMessages();
  messages.push(message);
  setItem(KEYS.CHAT_MESSAGES, messages);
}

export function clearChatMessages(): void {
  setItem(KEYS.CHAT_MESSAGES, []);
}

// Profile
export function getProfile(): UserProfile {
  return getItem<UserProfile>(KEYS.PROFILE, DEFAULT_PROFILE);
}

export function saveProfile(profile: UserProfile): void {
  setItem(KEYS.PROFILE, profile);
}

/** Effectieve cycling max HR. */
export function getMaxHRCycling(): number {
  const p = getProfile();
  return p.hrZonesCycling?.maxHR ?? p.maxHRCycling ?? (p.maxHR - 8);
}

/** Zones voor hardlopen: aangepaste config of berekend uit max HR. */
export function getRunZones(): HeartRateZoneInfo[] {
  const p = getProfile();
  if (p.hrZonesRun) return hrZoneConfigToZones(p.hrZonesRun);
  return computeHRZones(p.maxHR);
}

/** Zones voor fietsen: aangepaste config of berekend uit max HR. */
export function getCyclingZones(): HeartRateZoneInfo[] {
  const p = getProfile();
  if (p.hrZonesCycling) return hrZoneConfigToZones(p.hrZonesCycling);
  return computeHRZones(getMaxHRCycling());
}

/** Zone-tekst voor AI-prompts, per sport. */
export function buildHRZoneText(): string {
  const p = getProfile();
  const runZones = getRunZones();
  const bikeZones = getCyclingZones();
  const runMaxHR = p.hrZonesRun?.maxHR ?? p.maxHR;
  const bikeMaxHR = getMaxHRCycling();
  const fmt = (z: HeartRateZoneInfo[]) =>
    z.map(z => `${z.zone}(${z.min}-${z.max} ${z.label})`).join(', ');
  return `Hardlopen: Max HR ${runMaxHR} bpm, Zones: ${fmt(runZones)} | Fietsen: Max HR ${bikeMaxHR} bpm, Zones: ${fmt(bikeZones)}`;
}

// Garmin data
export function getGarminData(): GarminSyncData | null {
  return getItem<GarminSyncData | null>(KEYS.GARMIN_DATA, null);
}

export function saveGarminData(data: GarminSyncData): void {
  setItem(KEYS.GARMIN_DATA, data);
}

/**
 * Synchroniseer met Garmin: haalt alleen details op voor nieuwe activiteiten,
 * behoudt hrZones van bestaande, mergt álles in het archief en houdt de
 * live-weergave compact (40). Geeft de verse data terug, of de bestaande
 * cache bij een mislukte sync (offline / Garmin down). Eén bron voor alle
 * sync-aanroepen (dashboard, data-pagina, check-out).
 */
export async function syncGarminData(): Promise<GarminSyncData | null> {
  const existingData = getGarminData();
  const existingActivityIds = existingData?.activities?.map(a => a.id) || [];
  // Credentials meesturen (multi-user); server valt terug op env vars als ze ontbreken
  const creds = getGarminCredentials();

  const res = await fetch('/api/garmin/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ existingActivityIds, email: creds?.email, password: creds?.password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Sync mislukt');
  }
  const data: GarminSyncData = await res.json();

  // Behoud hrZones van bestaande activiteiten (server stuurt die niet altijd mee)
  if (existingData?.activities) {
    const existingMap = new Map(existingData.activities.map(a => [a.id, a]));
    for (const activity of data.activities) {
      if (!activity.hrZones && existingMap.has(activity.id)) {
        activity.hrZones = existingMap.get(activity.id)?.hrZones;
      }
    }
  }

  // Eerst alles in het archief, daarna de live-weergave compact houden.
  mergeActivitiesIntoArchive(data.activities);
  mergeHealthIntoArchive(data.health);
  data.activities = data.activities.slice(0, 40);
  saveGarminData(data);
  markAutoSyncDone();
  return data;
}

// ─── Activiteiten-archief ────────────────────────────────────────
// Garmin sync overschrijft GARMIN_DATA met de laatste 30 activiteiten. Voor
// historische trends (bv. de weken vóór een wedstrijd) bouwen we een groeiend
// archief op dat bij elke sync wordt samengevoegd (dedup op id).

export function getActivityArchive(): GarminActivity[] {
  return getItem<GarminActivity[]>(KEYS.ACTIVITY_ARCHIVE, []);
}

/** Welke versie van twee activiteiten met hetzelfde id is "rijker" (meer detail)? */
function richerActivity(a: GarminActivity, b: GarminActivity): GarminActivity {
  const scoreOf = (x: GarminActivity) =>
    (x.hrZones?.length ? 2 : 0) + (x.splits?.length ? 2 : 0) + (x.avgHR > 0 ? 1 : 0);
  return scoreOf(b) > scoreOf(a) ? b : a;
}

export function mergeActivitiesIntoArchive(activities: GarminActivity[]): void {
  if (!activities || activities.length === 0) return;
  const existing = getActivityArchive();
  const byId = new Map<number, GarminActivity>(existing.map(a => [a.id, a]));
  for (const a of activities) {
    const prev = byId.get(a.id);
    byId.set(a.id, prev ? richerActivity(prev, a) : a);
  }
  const merged = Array.from(byId.values()).sort((x, y) => y.date.localeCompare(x.date));
  setItem(KEYS.ACTIVITY_ARCHIVE, merged);
}

/** Activiteiten uit het archief binnen [start, end] (ISO-datums, inclusief). */
export function getArchivedActivitiesInRange(start: string, end: string): GarminActivity[] {
  return getActivityArchive().filter(a => a.date >= start && a.date <= end);
}

/**
 * Verwijder één activiteit uit zowel de live Garmin-data als het archief.
 * Let op: niet permanent — een volgende Garmin-sync kan dezelfde activiteit
 * opnieuw binnenhalen tenzij die ook op Garmin zelf is verwijderd.
 */
export function deleteActivity(id: number): void {
  const data = getGarminData();
  if (data) {
    data.activities = data.activities.filter(a => a.id !== id);
    saveGarminData(data);
  }
  const archive = getActivityArchive().filter(a => a.id !== id);
  setItem(KEYS.ACTIVITY_ARCHIVE, archive);
}

// ─── Gezondheids-archief (HRV / Body Battery / slaap per dag) ─────
export function getHealthArchive(): GarminHealthStats[] {
  return getItem<GarminHealthStats[]>(KEYS.HEALTH_ARCHIVE, []);
}

export function mergeHealthIntoArchive(health: GarminHealthStats | null): void {
  if (!health || !health.date) return;
  const existing = getHealthArchive();
  const idx = existing.findIndex(h => h.date === health.date);
  if (idx >= 0) existing[idx] = health;
  else existing.push(health);
  existing.sort((a, b) => b.date.localeCompare(a.date));
  setItem(KEYS.HEALTH_ARCHIVE, existing);
}

export function getArchivedHealthInRange(start: string, end: string): GarminHealthStats[] {
  return getHealthArchive().filter(h => h.date >= start && h.date <= end);
}

// ─── Weer-cache per wedstrijd ────────────────────────────────────
export function getRaceWeather(goalId: string): RaceWeather | null {
  const map = getItem<Record<string, RaceWeather>>(KEYS.RACE_WEATHER, {});
  return map[goalId] ?? null;
}

export function saveRaceWeather(goalId: string, weather: RaceWeather): void {
  const map = getItem<Record<string, RaceWeather>>(KEYS.RACE_WEATHER, {});
  map[goalId] = weather;
  setItem(KEYS.RACE_WEATHER, map);
}

// Training plans
const DEFAULT_CYCLE_START = '2026-02-23';
const ZONE_MIGRATION_KEY = 'tricoach_zones_v5_migrated';

// Eenmalige migratie: 4-zone → 5-zone (Z1→Z2, Z2→Z3, Z3→Z4, Z4→Z5)
function migrateZonesInPlan(plan: TrainingWeek[]): TrainingWeek[] {
  const zoneMap: Record<string, HeartRateZone> = { Z1: 'Z2', Z2: 'Z3', Z3: 'Z4', Z4: 'Z5' };
  return plan.map((week) => ({
    ...week,
    days: week.days.map((day) => ({
      ...day,
      sessions: day.sessions.map((session) => ({
        ...session,
        zone: session.zone ? (zoneMap[session.zone] ?? session.zone) as HeartRateZone : session.zone,
        description: session.description
          .replace(/\bZ4\b/g, 'Z5')
          .replace(/\bZ3\b/g, 'Z4')
          .replace(/\bZ2\b/g, 'Z3')
          .replace(/\bZ1\b/g, 'Z2'),
      })),
    })),
  }));
}

function runZoneMigration(): void {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(ZONE_MIGRATION_KEY)) return;
  try {
    const plans = getItem<StoredPlan[]>(KEYS.PLANS, []);
    if (plans.length > 0) {
      const migrated = plans.map((p) => ({ ...p, plan: migrateZonesInPlan(p.plan) }));
      setItem(KEYS.PLANS, migrated);
    }
    localStorage.setItem(ZONE_MIGRATION_KEY, 'true');
  } catch {
    console.error('Zone migration failed');
  }
}

export function getStoredPlans(): StoredPlan[] {
  return getItem<StoredPlan[]>(KEYS.PLANS, []);
}

export function saveStoredPlan(plan: StoredPlan): void {
  const plans = getStoredPlans();
  plans.push(plan);
  setItem(KEYS.PLANS, plans);
  // Schema is gewijzigd → coach-van-de-dag moet opnieuw genereren met nieuwe data
  clearDailyMessage();
}

export function setActivePlanId(id: string): void {
  // Archiveer het huidige actieve plan
  const currentId = getItem<string | null>(KEYS.ACTIVE_PLAN_ID, null);
  if (currentId) {
    const plans = getStoredPlans();
    const idx = plans.findIndex((p) => p.id === currentId);
    if (idx !== -1) {
      plans[idx].status = 'archived';
      setItem(KEYS.PLANS, plans);
    }
  }
  setItem(KEYS.ACTIVE_PLAN_ID, id);
  // Ander actief plan → coach-van-de-dag opnieuw genereren
  clearDailyMessage();
}

/**
 * Lijn het cyclus-anker uit op de race: als de race binnen de cyclus valt,
 * koppel de week mét de race aan de LAATSTE planweek (bv. wedstrijdweek = week 2).
 * Past GEEN plan-inhoud of opgeslagen data aan — corrigeert alleen de ankerdatum
 * waarmee de "huidige week" wordt berekend, zodat de wedstrijdweek "huidig" is.
 * Laat de oorspronkelijke datum staan als er geen race binnen de cyclus valt.
 */
function alignCycleStartToRace(cycleStartDate: string, numWeeks: number, raceDate: string): string {
  if (!raceDate || numWeeks < 1) return cycleStartDate;
  // Reken volledig in UTC zodat de ankerdatum niet wegglijdt door de tijdzone.
  const race = new Date(`${raceDate}T00:00:00Z`);
  if (isNaN(race.getTime())) return cycleStartDate;
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' });
  const today = new Date(`${todayStr}T00:00:00Z`);
  const daysUntil = Math.round((race.getTime() - today.getTime()) / 86400000);
  // Race al voorbij of buiten de cyclus → niet uitlijnen
  if (daysUntil < 0 || daysUntil >= numWeeks * 7) return cycleStartDate;
  // Maandag van de raceweek, daarna terug naar de eerste planweek (race-week = laatste week)
  const anchor = new Date(race);
  const dow = anchor.getUTCDay();
  anchor.setUTCDate(anchor.getUTCDate() - (dow === 0 ? 6 : dow - 1) - (numWeeks - 1) * 7);
  return anchor.toISOString().split('T')[0];
}

/**
 * Handmatige week-correctie: als de automatische week-berekening ernaast zit
 * (bv. week 1 getoond terwijl het week 2 is), kan de gebruiker de weken wisselen.
 * Slaat een boolean op; toegepast als een verschuiving van 7 dagen op de
 * uiteindelijke ankerdatum, zodat de huidige week omklapt (week 1 ↔ 2) én de
 * hele app (home/coach/schema) consistent meebeweegt.
 */
export function getCycleWeekFlip(): boolean {
  return getItem<boolean>(KEYS.CYCLE_WEEK_FLIP, false);
}

export function toggleCycleWeekFlip(): boolean {
  const next = !getCycleWeekFlip();
  setItem(KEYS.CYCLE_WEEK_FLIP, next);
  return next;
}

function shiftDateStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr.split('T')[0]}T00:00:00Z`);
  if (isNaN(d.getTime())) return dateStr;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

export function getActivePlan(): { plan: TrainingWeek[]; cycleStartDate: string; id: string } {
  runZoneMigration();
  const activeId = getItem<string | null>(KEYS.ACTIVE_PLAN_ID, null);
  if (activeId) {
    const plans = getStoredPlans();
    const active = plans.find((p) => p.id === activeId);
    if (active) {
      let cycleStartDate = alignCycleStartToRace(active.cycleStartDate, active.plan.length, getActiveRaceDate());
      // Handmatige week-correctie wint altijd (ook over de race-uitlijning)
      if (getCycleWeekFlip()) cycleStartDate = shiftDateStr(cycleStartDate, -7);
      return { plan: active.plan, cycleStartDate, id: active.id };
    }
  }
  return { plan: trainingPlan, cycleStartDate: DEFAULT_CYCLE_START, id: 'default' };
}

export function updateActivePlan(updatedPlan: TrainingWeek[]): boolean {
  const activeId = getItem<string | null>(KEYS.ACTIVE_PLAN_ID, null);
  if (!activeId) return false;
  const plans = getStoredPlans();
  const idx = plans.findIndex((p) => p.id === activeId);
  if (idx === -1) return false;
  plans[idx].plan = updatedPlan;
  setItem(KEYS.PLANS, plans);
  // Schema is aangepast (bv. dag gewijzigd naar rust) → coach moet opnieuw genereren
  clearDailyMessage();
  return true;
}

// ─── Data Export / Import / Backup ───────────────────────────────

interface ExportData {
  version: number;
  exportedAt: string;
  keys: Record<string, unknown>;
}

export function exportAllData(): string {
  if (typeof window === 'undefined') return '{}';
  const data: ExportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    keys: {},
  };
  for (const key of Object.values(KEYS)) {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) data.keys[key] = JSON.parse(raw);
    } catch {
      // skip corrupt keys
    }
  }
  return JSON.stringify(data, null, 2);
}

export function importAllData(json: string): { success: boolean; error?: string } {
  if (typeof window === 'undefined') return { success: false, error: 'Niet beschikbaar' };
  try {
    const data: ExportData = JSON.parse(json);
    if (!data.version || !data.keys) {
      return { success: false, error: 'Ongeldig bestandsformaat' };
    }
    // Schrijf alle keys naar localStorage
    for (const [key, value] of Object.entries(data.keys)) {
      localStorage.setItem(key, JSON.stringify(value));
    }
    return { success: true };
  } catch {
    return { success: false, error: 'Kon bestand niet lezen' };
  }
}

export function shouldAutoBackup(): boolean {
  if (typeof window === 'undefined') return false;
  const last = localStorage.getItem(AUTO_BACKUP_KEY);
  if (!last) return true; // Nooit eerder gebackupt
  const lastDate = new Date(last);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays >= BACKUP_INTERVAL_DAYS;
}

export function markBackupDone(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(AUTO_BACKUP_KEY, new Date().toISOString());
}

// Wekelijks AI rapport — gecached per ISO-week (bijv. "2026-W12")
interface WeeklyReport {
  weekKey: string;
  generatedAt: string;
  summary: string;
}

function getISOWeekKey(): string {
  const now = new Date();
  const thursday = new Date(now);
  thursday.setDate(now.getDate() - ((now.getDay() + 6) % 7) + 3);
  const year = thursday.getFullYear();
  const firstThursday = new Date(year, 0, 4);
  const weekNum = 1 + Math.round(((thursday.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

export function getWeeklyReport(): WeeklyReport | null {
  const stored = getItem<WeeklyReport | null>(KEYS.WEEKLY_REPORT, null);
  if (!stored) return null;
  return stored.weekKey === getISOWeekKey() ? stored : null;
}

export function saveWeeklyReport(report: Omit<WeeklyReport, 'weekKey'>): void {
  setItem(KEYS.WEEKLY_REPORT, { ...report, weekKey: getISOWeekKey() });
}

// Nutrition logs (MyFitnessPal import)
export function getNutritionLogs(): NutritionLog[] {
  return getItem<NutritionLog[]>(KEYS.NUTRITION, []);
}

export function getNutritionForDate(date: string): NutritionLog | null {
  return getNutritionLogs().find(n => n.date === date) ?? null;
}

export function saveNutritionLogs(logs: NutritionLog[]): void {
  // Bewaar laatste 60 dagen
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  const filtered = logs.filter(n => n.date >= cutoffStr);
  setItem(KEYS.NUTRITION, filtered);
}

// Voeg nieuwe logs samen met bestaande: nieuw wint per datum, maar behoud
// bestaande aiFeedback als de nieuwe log er (nog) geen heeft. Gebruikt door de
// Yazio-sync én de CSV-import.
export function mergeNutritionLogs(incoming: NutritionLog[]): NutritionLog[] {
  const byDate = new Map<string, NutritionLog>();
  for (const log of getNutritionLogs()) byDate.set(log.date, log);
  for (const log of incoming) {
    const existing = byDate.get(log.date);
    byDate.set(log.date, {
      ...log,
      aiFeedback: log.aiFeedback ?? existing?.aiFeedback,
    });
  }
  const merged = [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
  saveNutritionLogs(merged);
  return getNutritionLogs().sort((a, b) => b.date.localeCompare(a.date));
}

export function saveNutritionFeedback(date: string, feedback: string): void {
  const logs = getNutritionLogs();
  const idx = logs.findIndex(n => n.date === date);
  if (idx >= 0) {
    logs[idx] = { ...logs[idx], aiFeedback: feedback };
    setItem(KEYS.NUTRITION, logs);
  }
}

export function getRecentNutritionLogs(days: number = 7): NutritionLog[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  return getNutritionLogs()
    .filter(n => n.date >= cutoffStr)
    .sort((a, b) => b.date.localeCompare(a.date));
}


// Parse MyFitnessPal Dutch Voedingsoverzicht CSV
export function parseMFPCsv(csvText: string): NutritionLog[] {
  const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
  const dayMap = new Map<string, NutritionLog>();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const date = cols[0]?.trim();
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    const calories = parseFloat(cols[3]) || 0;
    const fat = parseFloat(cols[4]) || 0;
    const carbs = parseFloat(cols[12]) || 0;
    const fiber = parseFloat(cols[13]) || 0;
    const protein = parseFloat(cols[15]) || 0;

    if (dayMap.has(date)) {
      const existing = dayMap.get(date)!;
      dayMap.set(date, {
        ...existing,
        calories: existing.calories + calories,
        carbsG: existing.carbsG + carbs,
        proteinG: existing.proteinG + protein,
        fatG: existing.fatG + fat,
        fiberG: existing.fiberG + fiber,
      });
    } else {
      dayMap.set(date, { date, calories, carbsG: carbs, proteinG: protein, fatG: fat, fiberG: fiber });
    }
  }

  return Array.from(dayMap.values()).map(log => ({
    ...log,
    calories: Math.round(log.calories),
    carbsG: Math.round(log.carbsG),
    proteinG: Math.round(log.proteinG),
    fatG: Math.round(log.fatG),
    fiberG: Math.round(log.fiberG),
  }));
}

export function downloadExport(): void {
  const json = exportAllData();
  const today = new Date().toISOString().split('T')[0];
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sportcoach-backup-${today}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  markBackupDone();
}

// ─── Goals (wedstrijddoelen) ─────────────────────────────────────

// Eenmalige migratie: als er nog geen goals zijn, maak eerste goal aan
// op basis van het profiel (backward compat met hardcoded 1/4 triatlon).
function runGoalsMigration(): void {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem(KEYS.GOALS_MIGRATED)) return;
  try {
    const existing = getItem<Goal[]>(KEYS.GOALS, []);
    if (existing.length === 0) {
      const profile = getProfile();
      const raceType = profile.raceType?.toLowerCase() || '';
      let type: Goal['type'] = 'eigen';
      if (raceType.includes('1/4') || raceType.includes('kwart')) type = 'kwart_triatlon';
      else if (raceType.includes('1/2') && raceType.includes('tri')) type = 'halve_triatlon';
      else if (raceType.includes('hele') && raceType.includes('tri')) type = 'hele_triatlon';
      else if (raceType.includes('marathon') && raceType.includes('1/2')) type = 'halve_marathon';
      else if (raceType.includes('marathon')) type = 'marathon';

      // Streeftijd parsen uit "Onder de 3 uur" of "2:55"
      let targetTimeSeconds: number | undefined;
      const goal = profile.raceGoal || '';
      const hourMatch = goal.match(/(\d+)\s*uur/i);
      if (hourMatch) targetTimeSeconds = parseInt(hourMatch[1]) * 3600;
      const hmsMatch = goal.match(/(\d+):(\d{2})(?::(\d{2}))?/);
      if (hmsMatch) {
        const h = parseInt(hmsMatch[1]);
        const m = parseInt(hmsMatch[2]);
        const s = hmsMatch[3] ? parseInt(hmsMatch[3]) : 0;
        targetTimeSeconds = h * 3600 + m * 60 + s;
      }

      const firstGoal: Goal = {
        id: generateId(),
        type,
        name: profile.raceType || '1/4 Triatlon',
        date: profile.raceDate || '2026-06-13',
        targetTimeSeconds,
        status: 'active',
        createdAt: new Date().toISOString(),
      };
      setItem(KEYS.GOALS, [firstGoal]);
    }
    localStorage.setItem(KEYS.GOALS_MIGRATED, 'true');
  } catch {
    console.error('Goals migration failed');
  }
}

export function getGoals(): Goal[] {
  runGoalsMigration();
  return getItem<Goal[]>(KEYS.GOALS, []);
}

/**
 * Actief doel = meest nabije actieve goal met datum ≥ vandaag,
 * of indien geen toekomstige: meest recente actieve goal.
 */
export function getActiveGoal(): Goal | null {
  const goals = getGoals().filter(g => g.status === 'active');
  if (goals.length === 0) return null;
  const today = new Date().toISOString().split('T')[0];
  const upcoming = goals.filter(g => g.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  if (upcoming.length > 0) return upcoming[0];
  // Geen toekomstige meer: geef meest recente terug (wacht op resultaat)
  return goals.sort((a, b) => b.date.localeCompare(a.date))[0];
}

export function getArchivedGoals(): Goal[] {
  return getGoals()
    .filter(g => g.status === 'archived')
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** Alle actieve doelen met datum ≥ vandaag, gesorteerd op datum (vroegste eerst). */
export function getUpcomingGoals(): Goal[] {
  const today = new Date().toISOString().split('T')[0];
  return getGoals()
    .filter(g => g.status === 'active' && g.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function saveGoal(goal: Goal): void {
  const goals = getGoals();
  const idx = goals.findIndex(g => g.id === goal.id);
  if (idx >= 0) goals[idx] = goal;
  else goals.push(goal);
  setItem(KEYS.GOALS, goals);
}

export function deleteGoal(id: string): void {
  const goals = getGoals().filter(g => g.id !== id);
  setItem(KEYS.GOALS, goals);
}

export function archiveGoal(id: string, result: GoalResult): void {
  const goals = getGoals();
  const idx = goals.findIndex(g => g.id === id);
  if (idx >= 0) {
    goals[idx] = {
      ...goals[idx],
      status: 'archived',
      result,
      archivedAt: new Date().toISOString(),
    };
    setItem(KEYS.GOALS, goals);
  }
}

/** Sla de AI-coach-evaluatie op bij een (gearchiveerd) doel met resultaat. */
export function saveGoalEvaluation(goalId: string, evaluation: string): void {
  const goals = getGoals();
  const idx = goals.findIndex(g => g.id === goalId);
  if (idx >= 0 && goals[idx].result) {
    goals[idx] = { ...goals[idx], result: { ...goals[idx].result!, aiEvaluation: evaluation } };
    setItem(KEYS.GOALS, goals);
  }
}

/**
 * Check of er een actief doel voorbij is (datum < vandaag)
 * zonder resultaat. Geeft de meest recente voorbije terug. Gebruikt voor popup.
 */
export function getPendingResultGoal(): Goal | null {
  const today = new Date().toISOString().split('T')[0];
  const dismissed = getItem<string[]>(KEYS.GOAL_RESULT_DISMISSED, []);
  const past = getGoals()
    .filter(g => g.status === 'active' && g.date < today && !g.result && !dismissed.includes(g.id))
    .sort((a, b) => b.date.localeCompare(a.date));
  return past[0] ?? null;
}

export function dismissGoalResultPrompt(goalId: string): void {
  const dismissed = getItem<string[]>(KEYS.GOAL_RESULT_DISMISSED, []);
  if (!dismissed.includes(goalId)) {
    dismissed.push(goalId);
    setItem(KEYS.GOAL_RESULT_DISMISSED, dismissed);
  }
}

/**
 * Is dit een multi-sport doel (voor splits)?
 */
export function goalIsMultiSport(goal: Goal): boolean {
  return GOAL_TYPES.find(t => t.type === goal.type)?.multiSport ?? false;
}

/**
 * Formatteer seconden → "hh:mm:ss" of "mm:ss"
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Parse "1:23:45" / "23:45" / "45" → seconden
 */
export function parseDuration(input: string): number {
  const parts = input.trim().split(':').map(p => parseInt(p));
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return 0;
}

// ─── Race-context helpers (voor AI prompts en UI countdowns) ─────────

/**
 * ISO-datum van actief doel, met fallback naar profiel/defaults.
 */
export function getActiveRaceDate(): string {
  const active = getActiveGoal();
  if (active) return active.date;
  const profile = getProfile();
  return profile.raceDate || '2026-06-13';
}

/**
 * Korte label van actief doel (bv. "1/4 triatlon").
 */
export function getActiveRaceLabel(): string {
  const active = getActiveGoal();
  if (active) {
    const info = GOAL_TYPES.find(t => t.type === active.type);
    return (info?.label || active.name).toLowerCase();
  }
  const profile = getProfile();
  return (profile.raceType || '1/4 triatlon').toLowerCase();
}

/**
 * Naam van actief doel (bv. "1/4 Triatlon Eindhoven" of "1/4 Triatlon").
 */
export function getActiveRaceName(): string {
  const active = getActiveGoal();
  if (active) return active.name;
  const profile = getProfile();
  return profile.raceType || '1/4 Triatlon';
}

/**
 * Streeftijd-tekst van actief doel (bv. "onder 3:00:00").
 */
export function getActiveRaceGoalText(): string {
  const active = getActiveGoal();
  if (active?.targetTimeSeconds) {
    return `onder ${formatDuration(active.targetTimeSeconds)}`;
  }
  const profile = getProfile();
  return profile.raceGoal || 'persoonlijk record';
}

/**
 * Dagen tot actief doel (negatief als in verleden).
 */
export function getDaysUntilActiveRace(): number {
  return getDaysUntilActiveRaceFor(getActiveRaceDate());
}

function getDaysUntilActiveRaceFor(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const race = new Date(dateStr);
  race.setHours(0, 0, 0, 0);
  return Math.ceil((race.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Race datum in NL-formaat (bv. "13 juni 2026").
 */
export function formatRaceDateNL(dateStr?: string): string {
  const d = new Date(dateStr || getActiveRaceDate());
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Context-string voor AI prompts. Toont eerstvolgende race als primair doel,
 * plus alle overige aankomende races zodat de coach de jaarplanning ziet.
 */
export function buildRaceContextText(): string {
  const upcoming = getUpcomingGoals();
  if (upcoming.length === 0) {
    // Geen aankomende wedstrijd: laatste race (actief-verlopen of gearchiveerd) als context,
    // met expliciete instructie dat de atleet in de herstel-/overgangsfase zit.
    const lastActive = getActiveGoal();
    const lastArchived = getArchivedGoals()[0];
    const last = lastActive && lastActive.date < new Date().toISOString().split('T')[0]
      ? lastActive
      : lastArchived ?? lastActive;
    if (last) {
      const info = GOAL_TYPES.find(t => t.type === last.type);
      const label = (info?.label || last.name).toLowerCase();
      const daysAgo = Math.abs(getDaysUntilActiveRaceFor(last.date));
      const resultText = last.result
        ? `Resultaat: ${formatDuration(last.result.totalTimeSeconds)}${last.targetTimeSeconds ? ` (doel was onder ${formatDuration(last.targetTimeSeconds)})` : ''}.`
        : 'Resultaat nog niet ingevuld.';
      return `GEEN AANKOMENDE WEDSTRIJD. Laatste race: ${last.name} (${label}) op ${formatRaceDateNL(last.date)}, ${daysAgo} dagen geleden. ${resultText} De atleet zit in de herstel-/overgangsfase: adviseer actief herstel, onderhoudstraining en het kiezen van een nieuw doel — geen wedstrijdvoorbereiding.`;
    }
    return 'GEEN AANKOMENDE WEDSTRIJD en geen eerdere races bekend. Adviseer algemene fitheid en help de atleet een doel te kiezen.';
  }

  const next = upcoming[0];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lines: string[] = [];

  for (const g of upcoming) {
    const info = GOAL_TYPES.find(t => t.type === g.type);
    const typeLabel = (info?.label || g.name).toLowerCase();
    const dateFmt = formatRaceDateNL(g.date);
    const raceDate = new Date(g.date);
    raceDate.setHours(0, 0, 0, 0);
    const days = Math.ceil((raceDate.getTime() - today.getTime()) / 86400000);
    const goalText = g.targetTimeSeconds ? `doel: onder ${formatDuration(g.targetTimeSeconds)}` : '';
    const primary = g.id === next.id ? ' ← VOLGENDE' : '';
    const d = g.disciplineDistancesKm;
    const distParts: string[] = [];
    if (d?.swim) distParts.push(`zwem ${d.swim}km`);
    if (d?.bike) distParts.push(`fiets ${d.bike}km`);
    if (d?.run) distParts.push(d.run2 ? `loop1 ${d.run}km` : `loop ${d.run}km`);
    if (d?.run2) distParts.push(`loop2 ${d.run2}km`);
    const distText = distParts.length ? ` [${distParts.join(', ')}]` : '';
    lines.push(`- ${g.name} (${typeLabel}) op ${dateFmt}, nog ${days} dagen${distText}${goalText ? ', ' + goalText : ''}${primary}`);
  }

  return `AANKOMENDE WEDSTRIJDEN:\n${lines.join('\n')}`;
}

/**
 * Korte archief-samenvatting voor AI-context ("recente doelen & resultaten").
 * Max 3 archieven, oudste laatst.
 */
export function buildGoalsHistoryText(): string {
  const archived = getArchivedGoals().slice(0, 3);
  if (archived.length === 0) return '';
  const lines = archived.map(g => {
    const info = GOAL_TYPES.find(t => t.type === g.type);
    const label = info?.label || g.name;
    const dateFmt = formatRaceDateNL(g.date);
    const time = g.result?.totalTimeSeconds ? formatDuration(g.result.totalTimeSeconds) : '?';
    const d = g.disciplineDistancesKm;
    const distParts: string[] = [];
    if (d?.swim) distParts.push(`zwem ${d.swim}km`);
    if (d?.bike) distParts.push(`fiets ${d.bike}km`);
    if (d?.run) distParts.push(d.run2 ? `loop1 ${d.run}km` : `loop ${d.run}km`);
    if (d?.run2) distParts.push(`loop2 ${d.run2}km`);
    const distText = distParts.length ? ` [${distParts.join(', ')}]` : '';
    const reflection = g.result?.trainingReflection ? ` — ${g.result.trainingReflection.slice(0, 120)}` : '';
    return `- ${g.name} (${label}, ${dateFmt})${distText}: ${time}${reflection}`;
  });
  return `RECENTE DOELEN:\n${lines.join('\n')}`;
}

// ─── Equipment (materiaal: fietsen, schoenen + onderhoud) ─────────

/**
 * Eenmalige migratie: legacy type='fiets' wordt 'racefiets'. Wordt automatisch
 * uitgevoerd bij elke aanroep van getEquipment() — kost niets als al gedaan.
 */
function runEquipmentMigrationV1(): void {
  if (typeof window === 'undefined') return;
  const done = getItem<boolean>(KEYS.EQUIPMENT_MIGRATED_V1, false);
  if (done) return;
  const list = getItem<Equipment[]>(KEYS.EQUIPMENT, []);
  let changed = false;
  for (const eq of list) {
    if ((eq.type as string) === 'fiets') {
      eq.type = 'racefiets';
      changed = true;
    }
  }
  if (changed) setItem(KEYS.EQUIPMENT, list);
  setItem(KEYS.EQUIPMENT_MIGRATED_V1, true);
}

export function getEquipment(): Equipment[] {
  runEquipmentMigrationV1();
  return getItem<Equipment[]>(KEYS.EQUIPMENT, []);
}

export function getActiveEquipment(): Equipment[] {
  return getEquipment().filter(e => e.status === 'active');
}

export function getRetiredEquipment(): Equipment[] {
  return getEquipment()
    .filter(e => e.status === 'retired')
    .sort((a, b) => (b.retiredAt || '').localeCompare(a.retiredAt || ''));
}

export function saveEquipment(eq: Equipment): void {
  const list = getEquipment();
  list.push(eq);
  setItem(KEYS.EQUIPMENT, list);
}

export function updateEquipment(id: string, updates: Partial<Equipment>): void {
  const list = getEquipment();
  const idx = list.findIndex(e => e.id === id);
  if (idx === -1) return;
  list[idx] = { ...list[idx], ...updates };
  setItem(KEYS.EQUIPMENT, list);
}

export function deleteEquipment(id: string): void {
  const list = getEquipment().filter(e => e.id !== id);
  setItem(KEYS.EQUIPMENT, list);
  // Verwijder ook eventuele toewijzingen die naar dit equipment verwezen
  const assignments = getActivityAssignments();
  let changed = false;
  for (const actId of Object.keys(assignments)) {
    if (assignments[actId] === id) { delete assignments[actId]; changed = true; }
  }
  if (changed) setItem(KEYS.ACTIVITY_ASSIGNMENTS, assignments);
}

export function retireEquipment(id: string, retiredAt?: string): void {
  const date = retiredAt || new Date().toISOString().split('T')[0];
  updateEquipment(id, { status: 'retired', retiredAt: date, isDefault: false });
}

/** Maakt het opgegeven Equipment de default voor zijn (type, sport) combinatie. */
export function setDefaultEquipment(id: string): void {
  const list = getEquipment();
  const target = list.find(e => e.id === id);
  if (!target) return;
  for (const e of list) {
    if (e.type === target.type && e.sport === target.sport && e.status === 'active') {
      e.isDefault = e.id === id;
    }
  }
  setItem(KEYS.EQUIPMENT, list);
}

export function markMaintenanceDone(
  equipmentId: string,
  maintenanceItemId: string,
  currentKm?: number,
  date?: string,
): void {
  const list = getEquipment();
  const eq = list.find(e => e.id === equipmentId);
  if (!eq?.maintenance) return;
  const item = eq.maintenance.find(m => m.id === maintenanceItemId);
  if (!item) return;
  item.lastDoneAt = date || new Date().toISOString().split('T')[0];
  if (typeof currentKm === 'number') item.lastDoneKm = Math.round(currentKm);
  setItem(KEYS.EQUIPMENT, list);
}

/** Genereert default onderhouds-items voor een type met today als lastDoneAt. */
export function buildDefaultMaintenance(type: Equipment['type']): MaintenanceItem[] {
  const today = new Date().toISOString().split('T')[0];
  return (EQUIPMENT_DEFAULT_MAINTENANCE[type] || []).map(m => ({
    id: generateId(),
    name: m.name,
    intervalDays: m.intervalDays,
    intervalKm: m.intervalKm,
    lastDoneAt: today,
    lastDoneKm: 0,
  }));
}

// ─── Activity → Equipment toewijzingen ──────────────────────────

export function getActivityAssignments(): ActivityAssignments {
  return getItem<ActivityAssignments>(KEYS.ACTIVITY_ASSIGNMENTS, {});
}

export function assignActivityToEquipment(activityId: string | number, equipmentId: string): void {
  const map = getActivityAssignments();
  map[String(activityId)] = equipmentId;
  setItem(KEYS.ACTIVITY_ASSIGNMENTS, map);
}

export function clearActivityAssignment(activityId: string | number): void {
  const map = getActivityAssignments();
  delete map[String(activityId)];
  setItem(KEYS.ACTIVITY_ASSIGNMENTS, map);
}

// ─── Zwem-varianten (binnen/buiten/openwater per activiteit) ─────

export function getSwimVariants(): ActivitySwimVariants {
  return getItem<ActivitySwimVariants>(KEYS.SWIM_VARIANTS, {});
}

export function setActivitySwimVariant(activityId: string | number, variant: SwimVariant): void {
  const map = getSwimVariants();
  map[String(activityId)] = variant;
  setItem(KEYS.SWIM_VARIANTS, map);
}

export function clearActivitySwimVariant(activityId: string | number): void {
  const map = getSwimVariants();
  delete map[String(activityId)];
  setItem(KEYS.SWIM_VARIANTS, map);
}

/**
 * Zwemtempo-targets per zone. Handmatig ingestelde Z1–Z5-tempo's (profiel)
 * hebben voorrang; anders afgeleid uit recente zwemtrainingen in het archief.
 */
export function getSwimPaceTargets(): SwimPaceTargets | null {
  const manual = getProfile().swimPaceZones;
  if (manual && manual.length === 5) return buildSwimPaceTargetsFromZones(manual);
  return estimateSwimPaceTargets(getActivityArchive());
}

/** Laatst gekozen zwem-variant — wordt de default bij de volgende check-out. */
export function getLastSwimVariant(): SwimVariant {
  return getItem<SwimVariant>(KEYS.LAST_SWIM_VARIANT, 'zwembad_binnen');
}

export function setLastSwimVariant(variant: SwimVariant): void {
  setItem(KEYS.LAST_SWIM_VARIANT, variant);
}

// ─── Garmin-inloggegevens (per gebruiker in localStorage) ────────

export function getGarminCredentials(): GarminCredentials | null {
  return getItem<GarminCredentials | null>(KEYS.GARMIN_CREDENTIALS, null);
}

export function saveGarminCredentials(creds: GarminCredentials): void {
  setItem(KEYS.GARMIN_CREDENTIALS, creds);
}

export function clearGarminCredentials(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEYS.GARMIN_CREDENTIALS);
}

// Yazio-credentials (voeding-koppeling) — zelfde patroon als Garmin: per gebruiker
// in localStorage, meegestuurd naar /api/yazio/sync. Env-vars als server-fallback.
export function getYazioCredentials(): YazioCredentials | null {
  return getItem<YazioCredentials | null>(KEYS.YAZIO_CREDENTIALS, null);
}

export function saveYazioCredentials(creds: YazioCredentials): void {
  setItem(KEYS.YAZIO_CREDENTIALS, creds);
}

export function clearYazioCredentials(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(KEYS.YAZIO_CREDENTIALS);
}
