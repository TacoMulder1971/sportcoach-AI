import { CheckIn, ChatMessage, UserProfile, DEFAULT_PROFILE, GarminSyncData, StoredPlan, TrainingWeek, HeartRateZone, NutritionLog, Goal, GoalResult, GOAL_TYPES } from './types';
import { trainingPlan } from '@/data/training-plan';

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

// Garmin data
export function getGarminData(): GarminSyncData | null {
  return getItem<GarminSyncData | null>(KEYS.GARMIN_DATA, null);
}

export function saveGarminData(data: GarminSyncData): void {
  setItem(KEYS.GARMIN_DATA, data);
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
}

export function getActivePlan(): { plan: TrainingWeek[]; cycleStartDate: string; id: string } {
  runZoneMigration();
  const activeId = getItem<string | null>(KEYS.ACTIVE_PLAN_ID, null);
  if (activeId) {
    const plans = getStoredPlans();
    const active = plans.find((p) => p.id === activeId);
    if (active) {
      return { plan: active.plan, cycleStartDate: active.cycleStartDate, id: active.id };
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

/**
 * Check of een actief doel al voorbij is (datum < vandaag)
 * en er nog geen resultaat is ingevuld. Gebruikt voor popup.
 */
export function getPendingResultGoal(): Goal | null {
  const active = getActiveGoal();
  if (!active || active.result) return null;
  const today = new Date().toISOString().split('T')[0];
  if (active.date >= today) return null;
  // Check of user de popup al weggeklikt heeft
  const dismissed = getItem<string[]>(KEYS.GOAL_RESULT_DISMISSED, []);
  if (dismissed.includes(active.id)) return null;
  return active;
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
  const dateStr = getActiveRaceDate();
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
 * Context-string voor AI prompts.
 * Bv. "1/4 triatlon op 13 juni 2026, nog 51 dagen. Doel: onder 3:00:00."
 */
export function buildRaceContextText(): string {
  const label = getActiveRaceLabel();
  const dateFmt = formatRaceDateNL();
  const days = getDaysUntilActiveRace();
  const goalText = getActiveRaceGoalText();
  const daysText = days >= 0 ? `, nog ${days} dagen` : ` (voorbij)`;
  return `${label} op ${dateFmt}${daysText}. Doel: ${goalText}.`;
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
    const reflection = g.result?.trainingReflection ? ` — ${g.result.trainingReflection.slice(0, 120)}` : '';
    return `- ${label} (${dateFmt}): ${time}${reflection}`;
  });
  return `RECENTE DOELEN:\n${lines.join('\n')}`;
}
