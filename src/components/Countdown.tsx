'use client';

import { useEffect, useState } from 'react';
import { getDaysUntilRace } from '@/lib/schedule';
import { getActiveRaceDate, getActiveRaceLabel, formatRaceDateNL, getGoals, getUpcomingGoals, formatDuration, getProfile } from '@/lib/storage';
import { Goal, TrainingSport } from '@/lib/types';
import { resolveSports } from '@/lib/athlete';
import SportIcon from './SportIcon';
import { TRAINING_PHASES, getCurrentPhase, getPhaseStatus, getPhaseProgress } from '@/lib/periodization';

const TOTAL_PREP_DAYS_DEFAULT = 104; // ~3,5 maanden (fallback bij korte trajecten)
const PHASE_DURATIONS: Record<string, number> = {
  basis: 50, opbouw: 28, piek: 21, taper: 14, wedstrijd: 7,
};

interface CountdownProps {
  gradientClassName?: string;
}

export default function Countdown({ gradientClassName = 'bg-gradient-to-r from-blue-600 to-indigo-700' }: CountdownProps = {}) {
  const [days, setDays] = useState<number | null>(null);
  const [raceDate, setRaceDate] = useState<string>('2026-06-13');
  const [raceLabel, setRaceLabel] = useState<string>('1/4 triatlon');
  const [raceDateFmt, setRaceDateFmt] = useState<string>('');
  const [lastRace, setLastRace] = useState<Goal | null>(null);
  const [hasGoals, setHasGoals] = useState(true);
  // Icoontjes op basis van de sporten van de atleet (client-only).
  const [heroSports, setHeroSports] = useState<TrainingSport[]>([]);

  useEffect(() => {
    setHeroSports(resolveSports(getProfile()));
    const d = getActiveRaceDate();
    setDays(getDaysUntilRace(d));
    setRaceLabel(getActiveRaceLabel());
    setRaceDateFmt(formatRaceDateNL(d));

    // Geen aankomende wedstrijd? Dan de meest recente race (actief of gearchiveerd)
    // voor de "race zit erop"-weergave.
    if (getUpcomingGoals().length === 0) {
      const today = new Date().toISOString().split('T')[0];
      const past = getGoals()
        .filter(g => g.date < today)
        .sort((a, b) => b.date.localeCompare(a.date));
      setLastRace(past[0] ?? null);
      setHasGoals(getGoals().length > 0);
      if (past[0]) setRaceDateFmt(formatRaceDateNL(past[0].date));
    } else {
      setRaceDate(d);
    }
  }, []);

  if (days === null) return null;

  // ── Na de race / geen doel: geen countdown maar een overgangs-hero ──
  if (days < 0) {
    const hasResult = !!lastRace?.result;
    return (
      <div className={`${gradientClassName} rounded-t-3xl p-6 text-white`}>
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-2xl font-bold leading-tight">
              {lastRace ? `${lastRace.name} zit erop!` : hasGoals ? 'Race voltooid!' : 'Nog geen doel'}
            </p>
            <p className="text-blue-50 text-base mt-1">
              {lastRace || hasGoals ? raceDateFmt : 'Plan je volgende wedstrijd'}
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <SportIcon sport="zwemmen" size="xl" />
            <SportIcon sport="fietsen" size="xl" />
            <SportIcon sport="hardlopen" size="xl" />
          </div>
        </div>

        <p className="text-blue-50/90 text-sm mt-4 leading-relaxed">
          {!hasGoals
            ? 'Kies een wedstrijd als doel — dan bouwt je coach daar het schema en de periodisering omheen.'
            : hasResult && lastRace?.result
            ? `Eindtijd ${formatDuration(lastRace.result.totalTimeSeconds)}. Tijd voor herstel — en voor je volgende doel.`
            : 'Vul je resultaat in, dan maakt je coach een evaluatie van je race en je voorbereiding.'}
        </p>

        <span className="inline-flex items-center gap-1.5 mt-3 bg-white/15 border border-white/25 rounded-full px-3.5 py-1.5 text-sm font-semibold">
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
    <div className={`${gradientClassName} rounded-t-3xl p-6 text-white`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-3xl font-bold">
            {days > 0 ? `${days} dagen` : days === 0 ? 'Vandaag!' : 'Voltooid'}
          </p>
          <p className="text-blue-50 text-base mt-1">tot {raceLabel}</p>
        </div>
        <div className="flex gap-2">
          {heroSports.map((s) => <SportIcon key={s} sport={s} size="xl" />)}
        </div>
      </div>

      {/* Fasetijdlijn */}
      <div className="mt-4">
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

      <p className="text-blue-50 text-sm mt-2">
        {raceDateFmt} · {currentPhase.label} · {phaseProgress}% voltooid
      </p>
    </div>
  );
}
