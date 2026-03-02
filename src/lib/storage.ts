import { CheckIn, ChatMessage, UserProfile, DEFAULT_PROFILE } from './types';

// Safe UUID generator that works on HTTP (crypto.randomUUID requires HTTPS on iOS Safari)
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

const KEYS = {
  CHECK_INS: 'tricoach_checkins',
  CHAT_MESSAGES: 'tricoach_chat',
  PROFILE: 'tricoach_profile',
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
