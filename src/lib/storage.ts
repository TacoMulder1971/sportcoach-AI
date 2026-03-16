import { CheckIn, ChatMessage, UserProfile, DEFAULT_PROFILE, GarminSyncData, StoredPlan, TrainingWeek, HeartRateZone } from './types';
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

// Daily message
interface DailyMessage {
  date: string;
  message: string;
}

export function getDailyMessage(): DailyMessage | null {
  const stored = getItem<DailyMessage | null>(KEYS.DAILY_MESSAGE, null);
  if (!stored) return null;
  const today = new Date().toISOString().split('T')[0];
  return stored.date === today ? stored : null;
}

export function saveDailyMessage(message: string): void {
  const today = new Date().toISOString().split('T')[0];
  setItem(KEYS.DAILY_MESSAGE, { date: today, message });
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
