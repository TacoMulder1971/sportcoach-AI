// Pure helpers voor materiaal-tracking. Worden hergebruikt door:
// - MaterialSection (UI op /data)
// - EquipmentAssignChip (per-activiteit toewijzing)
// - chat/daily-message routes (attentie-regel in coach context)

import { Equipment, GarminActivity, MaintenanceItem, ActivityAssignments } from './types';

// Sport-groepen: alle fietsen (race/MTB/stad) zijn onderling uitwisselbaar voor
// een fiets-activiteit, ongeacht of Garmin 'm als fietsen of mountainbike labelt.
const SPORT_GROUPS: Record<string, string[]> = {
  fietsen: ['fietsen', 'mountainbike'],
  mountainbike: ['fietsen', 'mountainbike'],
  hardlopen: ['hardlopen'],
  zwemmen: ['zwemmen'],
};

/** De sport-groep waartoe een sport behoort (fietsen + mountainbike = één groep). */
export function sportGroup(sport: string): string[] {
  return SPORT_GROUPS[sport] ?? [sport];
}

/** Zitten twee sporten in dezelfde uitwisselbare groep? */
export function inSameSportGroup(a: string, b: string): boolean {
  return sportGroup(a).includes(b);
}

/**
 * Welke equipment-items kan de atleet aan deze activiteit koppelen?
 * Voor fiets-activiteiten: alle actieve fietsen (race/MTB/stad), ook al staat de
 * activiteit als 'fietsen' en de fiets als 'mountainbike' (of andersom).
 */
export function assignableEquipment(
  activity: { sport: string; date: string },
  equipment: Equipment[],
): Equipment[] {
  const group = SPORT_GROUPS[activity.sport] ?? [activity.sport];
  return equipment.filter(e =>
    e.status === 'active' &&
    group.includes(e.sport) &&
    e.acquiredAt <= activity.date &&
    (!e.retiredAt || activity.date <= e.retiredAt)
  );
}

export type WearStatus = 'ok' | 'warning' | 'overdue' | 'na';
export type MaintenanceState = {
  status: 'ok' | 'warning' | 'overdue';
  daysAgo: number;
  kmSince: number;
  pctOfInterval: number; // 0..1+ — meest urgente van km/days
  reason: string;        // korte uitleg waarom amber/rood
};

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function daysBetween(a: string, b: string): number {
  const aD = new Date(a).getTime();
  const bD = new Date(b).getTime();
  return Math.max(0, Math.round((bD - aD) / 86400000));
}

/**
 * Bepaal welk Equipment van toepassing was op een activiteit.
 * Volgorde:
 *  1. Expliciete override (assignments[activity.id])
 *  2. Default (isDefault=true) voor (sport, datum-window)
 *  3. Eerste actieve match voor (sport, datum-window)
 *  4. Eerste match überhaupt
 *  5. null
 */
export function equipmentForActivity(
  activity: { id: string | number; sport: string; date: string },
  equipment: Equipment[],
  assignments: ActivityAssignments,
): Equipment | null {
  const key = String(activity.id);
  const override = assignments[key];
  if (override) {
    const found = equipment.find(e => e.id === override);
    if (found) return found;
  }
  const candidates = equipment.filter(e =>
    e.sport === activity.sport &&
    e.acquiredAt <= activity.date &&
    (!e.retiredAt || activity.date <= e.retiredAt)
  );
  return candidates.find(e => e.isDefault && e.status === 'active')
      ?? candidates.find(e => e.status === 'active')
      ?? candidates[0]
      ?? null;
}

/**
 * Bepaalt of een activiteit moet worden uitgesloten van trainingsstatistieken.
 * Op dit moment: stadsfiets-ritten tellen niet mee als training (woon-werkverkeer).
 * Worden wel getoond in de Activiteiten-lijst en in km-tellers per equipment.
 */
export function isExcludedFromStats(
  activity: { id: string | number; sport: string; date: string },
  equipment: Equipment[],
  assignments: ActivityAssignments,
): boolean {
  const assigned = equipmentForActivity(activity, equipment, assignments);
  return assigned?.type === 'stadsfiets';
}

/**
 * Filter activiteiten voor training-statistieken (TRIMP, weekvolume, trends).
 * Sluit stadsfiets-ritten uit; alles anders blijft.
 */
export function filterStatsActivities<T extends { id: string | number; sport: string; date: string }>(
  activities: T[],
  equipment: Equipment[],
  assignments: ActivityAssignments,
): T[] {
  if (!activities.length) return activities;
  if (equipment.length === 0) return activities; // niets om op te filteren
  return activities.filter(a => !isExcludedFromStats(a, equipment, assignments));
}

/** Som van Garmin-km die aan dit equipment zijn toegewezen + startKm. */
export function calculateEquipmentKm(
  eq: Equipment,
  activities: GarminActivity[],
  equipment: Equipment[],
  assignments: ActivityAssignments,
): number {
  let total = eq.startKm || 0;
  for (const a of activities) {
    if (equipmentForActivity(a, equipment, assignments)?.id === eq.id) {
      total += a.distanceKm || 0;
    }
  }
  return total;
}

export function equipmentWearStatus(usedKm: number, limit?: number): WearStatus {
  if (!limit || limit <= 0) return 'na';
  const pct = usedKm / limit;
  if (pct >= 1) return 'overdue';
  if (pct >= 0.8) return 'warning';
  return 'ok';
}

/**
 * Status van een onderhouds-item: neemt het meest urgente (km óf dagen).
 * pctOfInterval = 1.0 betekent precies op interval, > 1.0 over tijd.
 */
export function maintenanceStatus(
  m: MaintenanceItem,
  currentKm: number,
): MaintenanceState {
  const today = todayISO();
  const daysAgo = daysBetween(m.lastDoneAt, today);
  const kmSince = Math.max(0, currentKm - (m.lastDoneKm ?? 0));

  const dayPct = m.intervalDays ? daysAgo / m.intervalDays : 0;
  const kmPct = m.intervalKm ? kmSince / m.intervalKm : 0;
  const pct = Math.max(dayPct, kmPct);

  let status: MaintenanceState['status'] = 'ok';
  if (pct >= 1) status = 'overdue';
  else if (pct >= 0.8) status = 'warning';

  let reason = '';
  if (status === 'overdue') {
    if (kmPct >= 1 && dayPct >= 1) {
      reason = `${Math.round(kmSince - (m.intervalKm || 0))} km en ${daysAgo - (m.intervalDays || 0)} dagen over limiet`;
    } else if (kmPct >= 1) {
      reason = `${Math.round(kmSince - (m.intervalKm || 0))} km over limiet`;
    } else {
      reason = `${daysAgo - (m.intervalDays || 0)} dagen over limiet`;
    }
  } else if (status === 'warning') {
    if (kmPct >= 0.8 && (m.intervalKm || 0) > 0) {
      reason = `nog ${Math.max(0, Math.round((m.intervalKm || 0) - kmSince))} km`;
    } else {
      reason = `nog ${Math.max(0, (m.intervalDays || 0) - daysAgo)} dagen`;
    }
  }

  return { status, daysAgo, kmSince, pctOfInterval: pct, reason };
}

/** Bouwt een korte attentie-regel voor de coach prompt; lege string als niks urgent is. */
export function buildEquipmentAttentionLine(
  equipment: Equipment[],
  activities: GarminActivity[],
  assignments: ActivityAssignments,
): string {
  const active = equipment.filter(e => e.status === 'active');
  const parts: string[] = [];

  for (const eq of active) {
    const km = calculateEquipmentKm(eq, activities, equipment, assignments);

    // Slijtage
    const wear = equipmentWearStatus(km, eq.kmLimit);
    if (wear === 'warning' || wear === 'overdue') {
      parts.push(`${eq.name} ${Math.round(km)}/${eq.kmLimit}km`);
    }

    // Onderhoud
    for (const m of eq.maintenance || []) {
      const s = maintenanceStatus(m, km);
      if (s.status === 'warning' || s.status === 'overdue') {
        parts.push(`${eq.name} ${m.name.toLowerCase()} ${s.reason}`);
      }
    }
  }

  return parts.length === 0 ? '' : `- Materiaal-attentie: ${parts.join('; ')}`;
}
