// Seizoensplan — het lange-termijnkader waar elk 2-weeks schema een uitwerking van is.
//
// Waarom deze laag bestaat: de Seizoen-tab toonde tot nu toe alleen een afgeleide
// fasetijdlijn (dagen-tot-race → vaste fase), terwijl het enige echt opgeslagen
// plan het 2-weeks schema was. Die twee liepen uiteen zodra een 2-weeks blok over
// een fasegrens heen liep. Hier komt het kader vast te liggen: aaneengesloten
// blokken van meerdere weken met doel, belastingsrichting en sleutelsessies.
//
// Bewust géén losse sessies — die blijven uit /schema/nieuw komen.

import { Goal, SeasonBlock, SeasonPlan } from './types';
import { TRAINING_PHASES, POST_RACE_PHASE, getPhaseForDate, daysUntilRaceOn } from './periodization';
import { mondayOfWeekUTC } from './schedule';

const MAX_SEASON_WEEKS = 60; // vangnet: een race over 3 jaar levert geen eindeloos raster op

/** Eén week in het seizoensraster. Het raster is deterministisch (code), de AI vult alleen de blok-indeling in. */
export interface SeasonWeekSlot {
  index: number;
  startDate: string;      // maandag
  endDate: string;        // zondag
  phaseId: string;
  phaseLabel: string;
  daysUntilRace: number | null;  // vanaf de maandag van deze week
  raceName?: string;             // wedstrijd die ín deze week valt
  raceDate?: string;
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso.split('T')[0]}T00:00:00Z`);
  if (isNaN(d.getTime())) return iso;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split('T')[0];
}

/** "10 aug" — UTC-geformatteerd zodat de datum niet wegglijdt. */
export function formatDayNL(iso: string): string {
  const d = new Date(`${iso.split('T')[0]}T00:00:00Z`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** "10 aug – 23 aug" */
export function formatRangeNL(startISO: string, endISO: string): string {
  return `${formatDayNL(startISO)} – ${formatDayNL(endISO)}`;
}

export function phaseLabelFor(phaseId: string): string {
  if (phaseId === POST_RACE_PHASE.id) return POST_RACE_PHASE.label;
  return TRAINING_PHASES.find((p) => p.id === phaseId)?.label || phaseId;
}

export function phaseColorFor(phaseId: string): string {
  if (phaseId === POST_RACE_PHASE.id) return POST_RACE_PHASE.color;
  return TRAINING_PHASES.find((p) => p.id === phaseId)?.color || '#6b7280';
}

/**
 * Deterministisch weekraster van `fromISO` (maandag van die week) tot en met de
 * week waarin de laatste wedstrijd valt. Elke week krijgt de fase die hoort bij
 * de eerstvolgende wedstrijd op of ná die week.
 */
export function buildSeasonWeekGrid(fromISO: string, goals: Goal[]): SeasonWeekSlot[] {
  const races = [...goals]
    .filter((g) => g.status === 'active' && !!g.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (races.length === 0) return [];

  const firstMonday = mondayOfWeekUTC(fromISO);
  const lastRace = races[races.length - 1];
  // Als de laatste race al voorbij is, valt er geen seizoen meer te plannen.
  if (lastRace.date < firstMonday) return [];

  const lastMonday = mondayOfWeekUTC(lastRace.date);
  const totalWeeks = Math.min(
    MAX_SEASON_WEEKS,
    Math.round(
      (new Date(`${lastMonday}T00:00:00Z`).getTime() - new Date(`${firstMonday}T00:00:00Z`).getTime()) / 604800000,
    ) + 1,
  );

  const slots: SeasonWeekSlot[] = [];
  for (let i = 0; i < totalWeeks; i++) {
    const startDate = addDaysISO(firstMonday, i * 7);
    const endDate = addDaysISO(startDate, 6);
    // Eerstvolgende race op of ná het begin van deze week bepaalt de fase.
    const nextRace = races.find((r) => r.date >= startDate);
    const inWeek = races.find((r) => r.date >= startDate && r.date <= endDate);
    const phase = nextRace ? getPhaseForDate(startDate, nextRace.date) : POST_RACE_PHASE;
    slots.push({
      index: i,
      startDate,
      endDate,
      phaseId: phase.id,
      phaseLabel: phase.label,
      daysUntilRace: nextRace ? daysUntilRaceOn(startDate, nextRace.date) : null,
      raceName: inWeek?.name,
      raceDate: inWeek?.date,
    });
  }
  return slots;
}

/** Ruwe blok-indeling zoals de AI die aanlevert: indices in het weekraster. */
export interface SeasonBlockSpec {
  startWeek: number;
  endWeek: number;
  phaseId?: string;
  label?: string;
  focus?: string;
  targetWeeklyTrimpMin?: number;
  targetWeeklyTrimpMax?: number;
  keyWorkouts?: string[];
}

const KNOWN_PHASE_IDS = new Set([...TRAINING_PHASES.map((p) => p.id), POST_RACE_PHASE.id]);

/**
 * Zet de AI-indeling om naar echte blokken met datums. Repareert onderweg:
 * gaten, overlap en een te vroeg afgekapte reeks worden rechtgetrokken zodat
 * de blokken gegarandeerd aaneengesloten het hele raster dekken.
 */
export function materializeBlocks(specs: SeasonBlockSpec[], grid: SeasonWeekSlot[]): SeasonBlock[] {
  if (grid.length === 0) return [];
  const lastIndex = grid.length - 1;

  const cleaned = (Array.isArray(specs) ? specs : [])
    .filter((s) => s && Number.isFinite(Number(s.startWeek)) && Number.isFinite(Number(s.endWeek)))
    .map((s) => ({
      ...s,
      startWeek: Math.max(0, Math.round(Number(s.startWeek))),
      endWeek: Math.min(lastIndex, Math.round(Number(s.endWeek))),
    }))
    .filter((s) => s.endWeek >= s.startWeek)
    .sort((a, b) => a.startWeek - b.startWeek);

  if (cleaned.length === 0) return [];

  const blocks: SeasonBlock[] = [];
  let cursor = 0;
  for (const spec of cleaned) {
    if (cursor > lastIndex) break;
    // Gaten en overlap wegwerken: elk blok begint waar het vorige eindigde.
    const start = cursor;
    const end = Math.max(start, Math.min(lastIndex, spec.endWeek));
    blocks.push(toBlock(spec, start, end, grid));
    cursor = end + 1;
  }

  // Staart aanvullen als de AI te vroeg stopte.
  if (cursor <= lastIndex && blocks.length > 0) {
    const last = blocks[blocks.length - 1];
    last.endDate = grid[lastIndex].endDate;
    last.weeks = Math.round(
      (new Date(`${last.endDate}T00:00:00Z`).getTime() - new Date(`${last.startDate}T00:00:00Z`).getTime()) / 604800000,
    ) + 1;
    last.raceName = last.raceName ?? raceInRange(grid, last.startDate, last.endDate);
  }

  return blocks;
}

function raceInRange(grid: SeasonWeekSlot[], startISO: string, endISO: string): string | undefined {
  return grid.find((w) => w.raceName && w.startDate >= startISO && w.endDate <= endISO)?.raceName;
}

function toBlock(spec: SeasonBlockSpec, start: number, end: number, grid: SeasonWeekSlot[]): SeasonBlock {
  const startDate = grid[start].startDate;
  const endDate = grid[end].endDate;
  const phaseId = spec.phaseId && KNOWN_PHASE_IDS.has(spec.phaseId) ? spec.phaseId : grid[start].phaseId;
  const min = Number(spec.targetWeeklyTrimpMin);
  const max = Number(spec.targetWeeklyTrimpMax);
  return {
    startDate,
    endDate,
    weeks: end - start + 1,
    phaseId,
    label: (spec.label || phaseLabelFor(phaseId)).trim(),
    focus: (spec.focus || '').trim(),
    targetWeeklyTrimpMin: Number.isFinite(min) && min > 0 ? Math.round(min) : undefined,
    targetWeeklyTrimpMax: Number.isFinite(max) && max > 0 ? Math.round(max) : undefined,
    keyWorkouts: Array.isArray(spec.keyWorkouts)
      ? spec.keyWorkouts.filter((k) => typeof k === 'string' && k.trim()).map((k) => k.trim()).slice(0, 5)
      : undefined,
    raceName: raceInRange(grid, startDate, endDate),
  };
}

/** Het blok waarin een kalenderdag valt (null als de dag buiten het plan ligt). */
export function getSeasonBlockForDate(plan: SeasonPlan | null, dateISO: string): SeasonBlock | null {
  if (!plan) return null;
  const day = dateISO.split('T')[0];
  return plan.blocks.find((b) => day >= b.startDate && day <= b.endDate) || null;
}

/** Alle blokken die [startISO, endISO] raken. */
export function getSeasonBlocksInRange(plan: SeasonPlan | null, startISO: string, endISO: string): SeasonBlock[] {
  if (!plan) return [];
  return plan.blocks.filter((b) => b.startDate <= endISO && b.endDate >= startISO);
}

export function describeBlockLoad(block: SeasonBlock): string | null {
  const { targetWeeklyTrimpMin: min, targetWeeklyTrimpMax: max } = block;
  if (min && max) return `${min}–${max} TRIMP/week`;
  if (max) return `tot ${max} TRIMP/week`;
  if (min) return `vanaf ${min} TRIMP/week`;
  return null;
}

/**
 * Status van een opgeslagen seizoensplan t.o.v. de huidige situatie.
 * 'verlopen' = het plan loopt niet meer tot vandaag; 'wedstrijden-gewijzigd' =
 * er zijn races bijgekomen of afgevallen sinds het plan gemaakt werd.
 */
export type SeasonPlanStatus = 'actueel' | 'verlopen' | 'wedstrijden-gewijzigd';

export function seasonPlanStatus(plan: SeasonPlan, upcomingGoalIds: string[], todayISO: string): SeasonPlanStatus {
  if (todayISO > plan.endDate) return 'verlopen';
  // Alleen een wedstrijd die het plan níet kent maakt het verouderd. Een race die
  // simpelweg voorbij is verdwijnt uit getUpcomingGoals() maar is geen reden om
  // het plan af te keuren — de rest van het seizoen loopt gewoon door.
  const planned = new Set(plan.goalIds);
  if (upcomingGoalIds.some((id) => !planned.has(id))) return 'wedstrijden-gewijzigd';
  return 'actueel';
}

/**
 * Seizoenskader als AI-context voor de schema-generatie: welk blok hoort bij
 * welke week van het 2-weeks schema, met doel en belastingsrichting.
 */
export function buildSeasonContextText(
  plan: SeasonPlan | null,
  windows: { label: string; start: string; end: string }[],
): string {
  if (!plan || plan.blocks.length === 0) return '';

  const lines: string[] = [];
  for (const w of windows) {
    const blocks = getSeasonBlocksInRange(plan, w.start, w.end);
    if (blocks.length === 0) {
      lines.push(`- ${w.label} (${formatRangeNL(w.start, w.end)}): valt buiten het seizoensplan.`);
      continue;
    }
    for (const b of blocks) {
      const load = describeBlockLoad(b);
      const keys = b.keyWorkouts?.length ? ` | sleutelsessies: ${b.keyWorkouts.join(', ')}` : '';
      const race = b.raceName ? ` | WEDSTRIJD in dit blok: ${b.raceName}` : '';
      lines.push(
        `- ${w.label} (${formatRangeNL(w.start, w.end)}) valt in blok "${b.label}" [${phaseLabelFor(b.phaseId)}, ${formatRangeNL(b.startDate, b.endDate)}]: ${b.focus}${load ? ` | doelbelasting ${load}` : ''}${keys}${race}`,
      );
    }
  }

  return `SEIZOENSPLAN — dit 2-weeks schema is een UITWERKING van het onderstaande kader. Wijk hier niet van af.
Rode draad van het seizoen: ${plan.summary}

${lines.join('\n')}

Houd de doelbelasting en de sleutelsessies van het blok aan. Als een week in een ander blok valt dan de vorige, laat het schema die overgang ook echt zien (bijv. taper = duidelijk minder volume, niet een paar procent).`;
}

/** Compacte één-regel-context voor chat en dag-aanpassingen. */
export function buildCurrentBlockText(plan: SeasonPlan | null, todayISO: string): string {
  const block = getSeasonBlockForDate(plan, todayISO);
  if (!block) return '';
  const load = describeBlockLoad(block);
  return `SEIZOENSBLOK NU: "${block.label}" (${phaseLabelFor(block.phaseId)}, ${formatRangeNL(block.startDate, block.endDate)}) — ${block.focus}${load ? ` Doelbelasting: ${load}.` : ''}`;
}
