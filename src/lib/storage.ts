import { CheckIn, ChatMessage, UserProfile, DEFAULT_PROFILE, GarminSyncData, StoredPlan, TrainingWeek } from './types';
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
} as const;

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
  return checkIns.slice(-count);
}

export function updateCheckIn(id: string, updates: Partial<CheckIn>): void {
  const checkIns = getCheckIns();
  const index = checkIns.findIndex((c) => c.id === id);
  if (index !== -1) {
    checkIns[index] = { ...checkIns[index], ...updates };
    setItem(KEYS.CHECK_INS, checkIns);
  }
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
