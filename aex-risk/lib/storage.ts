// SSR-veilige, dag-gecachete client-opslag voor het risico-resultaat.
// Bewust hetzelfde patroon als SportCoach (getItem/setItem + datum-key).

import { AexRisk, CachedRisk } from './types';

const KEY = 'aexrisk_daily';

function getItem<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = localStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : fallback;
  } catch {
    return fallback;
  }
}

function setItem<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    console.error('Kon niet opslaan in localStorage');
  }
}

// Amsterdam-datum als YYYY-MM-DD (cache-key per dag).
export function getTodayAmsterdam(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' });
}

// Geeft het risico van vandaag terug, of null als er geen verse cache is.
export function getCachedRisk(): AexRisk | null {
  const stored = getItem<CachedRisk | null>(KEY, null);
  if (!stored) return null;
  return stored.key === getTodayAmsterdam() ? stored.risk : null;
}

export function saveRisk(risk: AexRisk): void {
  const payload: CachedRisk = { key: getTodayAmsterdam(), risk };
  setItem(KEY, payload);
}
