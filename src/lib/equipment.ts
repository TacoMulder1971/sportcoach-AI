// Pure helpers voor materiaal-tracking. Worden hergebruikt door:
// - MaterialSection (UI op /data)
// - EquipmentAssignChip (per-activiteit toewijzing)
// - chat/daily-message routes (attentie-regel in coach context)

import { Equipment, GarminActivity, MaintenanceItem, ActivityAssignments } from './types';
import { expandMultisportActivity } from './training-load';

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
 * Welke equipment-items kan de atleet HANDMATIG aan deze activiteit koppelen?
 * Voor fiets-activiteiten: alle actieve fietsen (race/MTB/stad), ook al staat de
 * activiteit als 'fietsen' en de fiets als 'mountainbike' (of andersom).
 *
 * Bewust GEEN datum-filter: je wilt ook oudere ritten (van vóór de aanschafdatum)
 * kunnen taggen. De aanschafdatum-grens geldt alleen voor automatische toewijzing
 * (zie equipmentForActivity).
 */
export function assignableEquipment(
  activity: { sport: string; date: string },
  equipment: Equipment[],
): Equipment[] {
  const group = SPORT_GROUPS[activity.sport] ?? [activity.sport];
  return equipment.filter(e =>
    e.status === 'active' &&
    group.includes(e.sport)
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
 *  1. Expliciete override (assignments[activity.id]), mits dezelfde sport-groep
 *  2. Default (isDefault=true) voor de sport
 *  3. Eerste actieve match voor de sport
 *  4. Eerste match überhaupt
 *  5. null
 *
 * Kandidaten worden begrensd op `acquiredAt`/`retiredAt`: materiaal claimt geen
 * activiteiten van vóór de aanschaf of ná het afdanken. Bestond er op die datum
 * nog geen materiaal voor die sport, dan valt het terug op de volledige lijst.
 * Een verkeerde toewijzing corrigeer je per activiteit met de chip (die mag wél
 * naar oudere ritten wijzen — de override heeft altijd voorrang).
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
    // Bij een multisport-onderdeel hangt de override aan de parent-activiteit en
    // geldt hij dus voor álle disciplines; alleen toepassen als de sport klopt.
    if (found && inSameSportGroup(found.sport, activity.sport)) return found;
  }
  const inService = equipment.filter(e =>
    e.sport === activity.sport &&
    (!e.retiredAt || activity.date <= e.retiredAt)
  );
  // Automatische toewijzing kijkt naar de aanschafdatum: een activiteit van vóór
  // de aanschaf hoort niet bij dit materiaal. Bestond er destijds nog niets, dan
  // valt het terug op de hele lijst — beter iets dan km die nergens meetellen.
  const acquired = inService.filter(e => !e.acquiredAt || activity.date >= e.acquiredAt);
  const candidates = acquired.length > 0 ? acquired : inService;
  return candidates.find(e => e.isDefault && e.status === 'active')
      ?? candidates.find(e => e.status === 'active')
      ?? candidates[0]
      ?? null;
}

/**
 * Klapt multisport-activiteiten (brick/triatlon) uit naar hun losse disciplines,
 * zodat het fietsdeel op de fiets en het loopdeel op de schoenen landt. De
 * parent-`distanceKm` is namelijk de som van álle onderdelen en zou dus dubbel
 * tellen. Hergebruikt `expandMultisportActivity` uit training-load.
 */
export function expandForEquipment(activities: GarminActivity[]): GarminActivity[] {
  return activities.flatMap(a => (a.isMultisport ? expandMultisportActivity(a) : [a]));
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
  for (const a of expandForEquipment(activities)) {
    if (equipmentForActivity(a, equipment, assignments)?.id === eq.id) {
      total += a.distanceKm || 0;
    }
  }
  return total;
}

/** Km-stand van dit materiaal t/m een datum (inclusief) — voor onderhouds-ijkpunten. */
export function calculateEquipmentKmUpTo(
  eq: Equipment,
  date: string,
  activities: GarminActivity[],
  equipment: Equipment[],
  assignments: ActivityAssignments,
): number {
  return calculateEquipmentKm(
    eq,
    activities.filter(a => a.date <= date),
    equipment,
    assignments,
  );
}

/**
 * Km-stand waarop een onderhoudsbeurt is gedaan. `lastDoneKm` is leidend, maar
 * een handmatig toegevoegd item start op 0 terwijl de fiets al kilometers had —
 * dan zou "sinds de beurt" de hele levensduur van de fiets tellen. In dat geval
 * leiden we het ijkpunt af uit de historie t/m `lastDoneAt`.
 */
export function maintenanceBaselineKm(
  eq: Equipment,
  m: MaintenanceItem,
  activities: GarminActivity[],
  equipment: Equipment[],
  assignments: ActivityAssignments,
): number {
  if (typeof m.lastDoneKm === 'number' && m.lastDoneKm > 0) return m.lastDoneKm;
  return calculateEquipmentKmUpTo(eq, m.lastDoneAt, activities, equipment, assignments);
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
  /** Km-stand bij de laatste beurt; default `m.lastDoneKm`. Zie maintenanceBaselineKm. */
  baselineKm?: number,
): MaintenanceState {
  const today = todayISO();
  const daysAgo = daysBetween(m.lastDoneAt, today);
  const kmSince = Math.max(0, currentKm - (baselineKm ?? m.lastDoneKm ?? 0));

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
      const s = maintenanceStatus(m, km, maintenanceBaselineKm(eq, m, activities, equipment, assignments));
      if (s.status === 'warning' || s.status === 'overdue') {
        parts.push(`${eq.name} ${m.name.toLowerCase()} ${s.reason}`);
      }
    }
  }

  return parts.length === 0 ? '' : `- Materiaal-attentie: ${parts.join('; ')}`;
}
