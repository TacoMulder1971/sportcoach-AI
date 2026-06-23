// Gedeelde datum-helpers voor de AI-coaches.
// Doel: voorkomen dat de coach "gokt" welke dag het is. Alle berekeningen gaan
// via Intl.DateTimeFormat in de Amsterdam-tijdzone (toLocaleDateString is
// onbetrouwbaar in Node.js/Vercel) en relatieve dag-labels worden hard berekend
// uit echte datums i.p.v. door het model geraden.

const DAY_NAMES = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];

export interface AmsterdamNow {
  /** "2026-06-23" — ISO-datum in Amsterdam-tijdzone */
  isoDate: string;
  /** "maandag" */
  dayName: string;
  /** "23 juni 2026" */
  dateStr: string;
  /** "14:05" */
  timeStr: string;
  /** "ochtend" | "middag" | "avond" */
  dagdeel: 'ochtend' | 'middag' | 'avond';
  /** uur (0-23) in Amsterdam */
  hours: number;
}

/** Huidige datum/tijd betrouwbaar in de Amsterdam-tijdzone. */
export function getAmsterdamNow(now: Date = new Date()): AmsterdamNow {
  const hours = parseInt(
    new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', hour: 'numeric', hour12: false }).format(now),
    10
  );
  const minutes = parseInt(
    new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', minute: 'numeric' }).format(now),
    10
  );
  const isoDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(now);
  const dayName = new Intl.DateTimeFormat('nl-NL', { timeZone: 'Europe/Amsterdam', weekday: 'long' }).format(now);
  const dateStr = new Intl.DateTimeFormat('nl-NL', {
    timeZone: 'Europe/Amsterdam', day: 'numeric', month: 'long', year: 'numeric',
  }).format(now);
  const timeStr = `${hours}:${minutes.toString().padStart(2, '0')}`;
  const dagdeel = hours < 12 ? 'ochtend' : hours < 17 ? 'middag' : 'avond';
  return { isoDate, dayName, dateStr, timeStr, dagdeel, hours };
}

/** Aantal hele dagen tussen twee ISO-datums (YYYY-MM-DD). Positief = `iso` ligt vóór `todayIso`. */
export function daysBetween(iso: string, todayIso: string): number {
  // Beide als UTC-middernacht parsen → schone integer-dagen, geen TZ-drift.
  return Math.round(
    (new Date(`${todayIso}T00:00:00Z`).getTime() - new Date(`${iso}T00:00:00Z`).getTime()) / 86400000
  );
}

/**
 * Relatief dag-label voor een activiteit/check-in t.o.v. vandaag.
 * VANDAAG / GISTEREN / "WOENSDAG, 4 DAGEN GELEDEN" / "OVER 2 DAGEN".
 * Voor alles ouder dan gisteren forceren we de weekdag-naam: vriendelijke
 * termen als "eergisteren" worden door modellen snel verkeerd toegepast.
 */
export function relativeDayLabel(iso: string, todayIso: string): string {
  const daysAgo = daysBetween(iso, todayIso);
  if (daysAgo === 0) return 'VANDAAG';
  if (daysAgo === 1) return 'GISTEREN';
  const dayName = DAY_NAMES[new Date(`${iso}T00:00:00Z`).getUTCDay()].toUpperCase();
  if (daysAgo < 0) {
    const inDays = Math.abs(daysAgo);
    return `${dayName}, OVER ${inDays} ${inDays === 1 ? 'DAG' : 'DAGEN'}`;
  }
  return `${dayName}, ${daysAgo} DAGEN GELEDEN`;
}

/**
 * Harde timing-instructie voor coach-prompts. Voorkomt dat het model "gisteren"
 * gokt voor activiteiten die dagen oud zijn.
 */
export function buildTimingRule(amsterdam: AmsterdamNow): string {
  return `TIMING (KRITIEK): Vandaag is het ${amsterdam.dayName} ${amsterdam.dateStr}, ${amsterdam.timeStr} (${amsterdam.dagdeel}). `
    + `Elke activiteit en check-out hieronder heeft een dag-label tussen [ ]. `
    + `Noem iets alleen "vandaag" bij [VANDAAG] en alleen "gisteren" bij [GISTEREN]. `
    + `Voor alles ouder: gebruik de WEEKDAG-naam uit het label (bijv. "woensdag"), NOOIT "gisteren" of "eergisteren". `
    + `Verzin NOOIT zelf wanneer iets gedaan is — lees het label.`;
}
