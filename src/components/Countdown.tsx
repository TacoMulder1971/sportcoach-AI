'use client';

import { useEffect, useState } from 'react';
import { getDaysUntilRace } from '@/lib/schedule';
import { getActiveRaceDate, getActiveRaceLabel, formatRaceDateNL, getGoals, getUpcomingGoals, formatDuration, getProfile } from '@/lib/storage';
import { Goal, TrainingSport, GOAL_TYPES } from '@/lib/types';
import { resolveSports } from '@/lib/athlete';
import SportIcon from './SportIcon';
import { TRAINING_PHASES, getCurrentPhase, getPhaseStatus, getPhaseProgress } from '@/lib/periodization';

const TOTAL_PREP_DAYS_DEFAULT = 104; // ~3,5 maanden (fallback bij korte trajecten)
const PHASE_DURATIONS: Record<string, number> = {
  basis: 50, opbouw: 28, piek: 21, taper: 14, wedstrijd: 7,
};

// Sport-icoontjes horen bij de wedstrijd, niet bij het hele sportprofiel:
// een triatlon toont zwem/fiets/loop, een marathon alleen hardlopen.
function sportsForGoal(goal: Goal | null): TrainingSport[] | null {
  if (!goal) return null;
  const info = GOAL_TYPES.find(t => t.type === goal.type);
  if (info?.multiSport && info.disciplines) return [...new Set<TrainingSport>(info.disciplines)];
  switch (goal.type) {
    case 'fietstocht': return ['fietsen'];
    case 'zwemtocht': return ['zwemmen'];
    case 'eigen': return null; // onbekende sport → val terug op profielsporten
    default: return ['hardlopen']; // loopafstanden (5k t/m marathon)
  }
}

interface CountdownProps {
  gradientClassName?: string;
}

export default function Countdown({ gradientClassName = 'bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900' }: CountdownProps = {}) {
  const [days, setDays] = useState<number | null>(null);
  const [raceDate, setRaceDate] = useState<string>('2026-06-13');
  const [raceLabel, setRaceLabel] = useState<string>('1/4 triatlon');
  const [raceName, setRaceName] = useState<string>('');
  const [targetTime, setTargetTime] = useState<number | null>(null);
  const [raceDateFmt, setRaceDateFmt] = useState<string>('');
  const [lastRace, setLastRace] = useState<Goal | null>(null);
  const [hasGoals, setHasGoals] = useState(true);
  // Icoontjes van de aankomende wedstrijd (client-only).
  const [heroSports, setHeroSports] = useState<TrainingSport[]>([]);

  useEffect(() => {
    const d = getActiveRaceDate();
    setDays(getDaysUntilRace(d));
    setRaceLabel(getActiveRaceLabel());
    setRaceDateFmt(formatRaceDateNL(d));

    const upcoming = getUpcomingGoals();
    const next = upcoming[0] ?? null;
    setHeroSports(sportsForGoal(next) ?? resolveSports(getProfile()));
    if (next) {
      setRaceName(next.name);
      setTargetTime(next.targetTimeSeconds ?? null);
    }

    // Geen aankomende wedstrijd? Dan de meest recente race (actief of gearchiveerd)
    // voor de "race zit erop"-weergave.
    if (upcoming.length === 0) {
      const today = new Date().toISOString().split('T')[0];
      const past = getGoals()
        .filter(g => g.date < today)
        .sort((a, b) => b.date.localeCompare(a.date));
      setLastRace(past[0] ?? null);
      setHasGoals(getGoals().length > 0);
      if (past[0]) {
        setRaceDateFmt(formatRaceDateNL(past[0].date));
        setHeroSports(sportsForGoal(past[0]) ?? resolveSports(getProfile()));
      }
    } else {
      setRaceDate(d);
    }
  }, []);

  if (days === null) return null;

  // ── Na de race / geen doel: geen countdown maar een overgangs-hero ──
  if (days < 0) {
    const hasResult = !!lastRace?.result;
    return (
      <div className={`relative overflow-hidden ${gradientClassName} rounded-3xl p-6 text-white shadow-lg`}>
        <div className="absolute -right-8 -top-10 w-40 h-40 rounded-full bg-blue-500/10 blur-2xl" />
        <div className="relative flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-2xl font-bold leading-tight">
              {lastRace ? `${lastRace.name} zit erop!` : hasGoals ? 'Race voltooid!' : 'Nog geen doel'}
            </p>
            <p className="text-blue-200/80 text-base mt-1">
              {lastRace || hasGoals ? raceDateFmt : 'Plan je volgende wedstrijd'}
            </p>
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            {heroSports.map((s) => <SportIcon key={s} sport={s} size="lg" />)}
          </div>
        </div>

        <p className="relative text-blue-100/90 text-sm mt-4 leading-relaxed">
          {!hasGoals
            ? 'Kies een wedstrijd als doel — dan bouwt je coach daar het schema en de periodisering omheen.'
            : hasResult && lastRace?.result
            ? `Eindtijd ${formatDuration(lastRace.result.totalTimeSeconds)}. Tijd voor herstel — en voor je volgende doel.`
            : 'Vul je resultaat in, dan maakt je coach een evaluatie van je race en je voorbereiding.'}
        </p>

        <span className="relative inline-flex items-center gap-1.5 mt-3 bg-white/15 border border-white/25 rounded-full px-3.5 py-1.5 text-sm font-semibold">
          {!hasGoals ? 'Stel een doel in' : hasResult ? 'Kies je volgende doel' : 'Vul je resultaat in'}
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </span>
      </div>
    );
  }

  const currentPhase = getCurrentPhase(raceDate);
  const phaseProgress = getPhaseProgress(raceDate);
  const totalPrep = Math.max(TOTAL_PREP_DAYS_DEFAULT, days + 7);

  return (
    <div className={`relative overflow-hidden ${gradientClassName} rounded-3xl p-6 text-white shadow-lg`}>
      <div className="absolute -right-8 -top-10 w-40 h-40 rounded-full bg-blue-500/10 blur-2xl" />
      <div className="relative flex items-center justify-between gap-3">
        <p className="text-blue-300 text-[11px] font-semibold uppercase tracking-wide min-w-0 truncate">Volgende wedstrijd</p>
        <div className="flex gap-1.5 flex-shrink-0">
          {heroSports.map((s) => <SportIcon key={s} sport={s} size="md" />)}
        </div>
      </div>
      <p className="relative text-2xl font-bold mt-2 truncate">{raceName || raceLabel}</p>
      {raceName && <p className="relative text-blue-200/80 text-sm">{raceLabel}</p>}

      <div className="relative mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-4xl font-extrabold leading-none">
            {days > 0 ? days : days === 0 ? 'Vandaag!' : '–'}
          </p>
          <p className="text-blue-200/80 text-xs mt-1">
            {days > 0 ? 'dagen te gaan' : days === 0 ? 'racedag!' : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="text-blue-100 text-sm font-medium">{raceDateFmt}</p>
          {targetTime != null && (
            <p className="text-blue-300 text-xs font-semibold">Doel: {formatDuration(targetTime)}</p>
          )}
        </div>
      </div>

      {/* Fasetijdlijn */}
      <div className="relative mt-4">
        <div className="flex rounded-full overflow-hidden h-2">
          {TRAINING_PHASES.map((phase) => {
            const status = getPhaseStatus(phase, raceDate);
            const widthPct = ((PHASE_DURATIONS[phase.id] || 0) / totalPrep) * 100;
            const isCurrent = status === 'current';
            const isDone = status === 'done';
            return (
              <div
                key={phase.id}
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: phase.color,
                  opacity: isDone ? 0.9 : isCurrent ? 1 : 0.25,
                }}
              />
            );
          })}
        </div>
        <div className="flex mt-1">
          {TRAINING_PHASES.map((phase) => {
            const status = getPhaseStatus(phase, raceDate);
            const widthPct = ((PHASE_DURATIONS[phase.id] || 0) / totalPrep) * 100;
            const isCurrent = status === 'current';
            return (
              <div key={phase.id} style={{ width: `${widthPct}%` }} className="text-center">
                <span
                  className="text-[10px] leading-tight block truncate px-0.5"
                  style={{ color: isCurrent ? 'white' : 'rgba(255,255,255,0.7)', fontWeight: isCurrent ? 700 : 400 }}
                >
                  {phase.label.replace('fase', '').replace('week', 'wk').trim()}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="relative text-blue-200/80 text-sm mt-2">
        {currentPhase.label} · {phaseProgress}% voltooid
      </p>
    </div>
  );
}
