'use client';

import { useEffect, useState } from 'react';
import { getDaysUntilRace } from '@/lib/schedule';
import { getActiveRaceDate, getActiveRaceLabel, formatRaceDateNL } from '@/lib/storage';
import SportIcon from './SportIcon';
import { TRAINING_PHASES, getCurrentPhase, getPhaseStatus, getPhaseProgress } from '@/lib/periodization';

const TOTAL_PREP_DAYS_DEFAULT = 104; // ~3,5 maanden (fallback bij korte trajecten)
const PHASE_DURATIONS: Record<string, number> = {
  basis: 50, opbouw: 28, piek: 21, taper: 14, wedstrijd: 7,
};

export default function Countdown() {
  const [days, setDays] = useState<number | null>(null);
  const [raceDate, setRaceDate] = useState<string>('2026-06-13');
  const [raceLabel, setRaceLabel] = useState<string>('1/4 triatlon');
  const [raceDateFmt, setRaceDateFmt] = useState<string>('');

  useEffect(() => {
    const d = getActiveRaceDate();
    setRaceDate(d);
    setDays(getDaysUntilRace(d));
    setRaceLabel(getActiveRaceLabel());
    setRaceDateFmt(formatRaceDateNL(d));
  }, []);

  if (days === null) return null;

  const currentPhase = getCurrentPhase(raceDate);
  const phaseProgress = getPhaseProgress(raceDate);
  const totalPrep = Math.max(TOTAL_PREP_DAYS_DEFAULT, days + 7);

  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-blue-200 text-sm font-medium">Countdown</p>
          <p className="text-3xl font-bold mt-1">
            {days > 0 ? `${days} dagen` : days === 0 ? 'Vandaag!' : 'Voltooid'}
          </p>
          <p className="text-blue-200 text-sm mt-1">tot {raceLabel}</p>
        </div>
        <div className="flex gap-2">
          <SportIcon sport="zwemmen" size="xl" />
          <SportIcon sport="fietsen" size="xl" />
          <SportIcon sport="hardlopen" size="xl" />
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
                  className="text-[9px] leading-tight block truncate px-0.5"
                  style={{ color: isCurrent ? 'white' : 'rgba(255,255,255,0.45)', fontWeight: isCurrent ? 700 : 400 }}
                >
                  {phase.label.replace('fase', '').replace('week', 'wk').trim()}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-blue-200 text-xs mt-2">
        {raceDateFmt} · {currentPhase.label} · {phaseProgress}% voltooid
      </p>
    </div>
  );
}
