'use client';

import { useMemo, useState } from 'react';
import { TRAINING_PHASES, getCurrentPhase, getDaysUntilRace, getPhaseStatus } from '@/lib/periodization';
import { getActivePlan } from '@/lib/storage';
import { getWeekTrainings, getCurrentWeekNumber, getMondayOfCurrentWeek } from '@/lib/schedule';
import { GarminSyncData } from '@/lib/types';

interface RaceProgressMeterProps {
  garmin: GarminSyncData | null;
}

// Totale trackbare voorbereiding: Basis(50) + Opbouw(28) + Piek(21) + Taper(14) + Wedstrijd(7) = 120 dagen
const TOTAL_PREP_DAYS = 120;

// Faseduur in dagen (voor proportionele weergave)
const PHASE_DURATIONS: Record<string, number> = {
  basis: 50,
  opbouw: 28,
  piek: 21,
  taper: 14,
  wedstrijd: 7,
};

export default function RaceProgressMeter({ garmin }: RaceProgressMeterProps) {
  const [goalsOpen, setGoalsOpen] = useState(false);

  const daysUntilRace = getDaysUntilRace();
  const currentPhase = getCurrentPhase();

  const prepCompleted = Math.min(100, Math.max(0, Math.round(((TOTAL_PREP_DAYS - daysUntilRace) / TOTAL_PREP_DAYS) * 100)));
  const weeksUntilRace = Math.ceil(daysUntilRace / 7);

  const { plannedMinutes, actualMinutes } = useMemo(() => {
    const { plan, cycleStartDate } = getActivePlan();
    const weekNum = getCurrentWeekNumber(cycleStartDate);
    const weekDays = getWeekTrainings(weekNum, plan);
    const planned = weekDays
      .flatMap((d) => d.sessions)
      .reduce((s, sess) => s + (sess.durationMinutes || 0), 0);

    const monday = getMondayOfCurrentWeek();
    const actual = garmin?.activities
      .filter((a) => a.date >= monday)
      .reduce((s, a) => s + a.durationMinutes, 0) ?? 0;

    return { plannedMinutes: planned, actualMinutes: actual };
  }, [garmin]);

  const formatMinutes = (min: number) => {
    if (min === 0) return '—';
    if (min < 60) return `${min}m`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}u${m}m` : `${h}u`;
  };

  return (
    <div className="bg-white rounded-xl p-4 border border-gray-200 mb-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700">Voortgang naar race</h2>
        <span className="text-xs font-medium text-gray-500">{prepCompleted}% voltooid</span>
      </div>

      {/* Fasetijdlijn */}
      <div className="mb-3">
        <div className="flex rounded-full overflow-hidden h-3">
          {TRAINING_PHASES.map((phase) => {
            const status = getPhaseStatus(phase);
            const widthPct = ((PHASE_DURATIONS[phase.id] || 0) / TOTAL_PREP_DAYS) * 100;
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
                title={phase.label}
              />
            );
          })}
        </div>

        {/* Fasenlabels */}
        <div className="flex mt-1">
          {TRAINING_PHASES.map((phase) => {
            const status = getPhaseStatus(phase);
            const widthPct = ((PHASE_DURATIONS[phase.id] || 0) / TOTAL_PREP_DAYS) * 100;
            const isCurrent = status === 'current';

            return (
              <div
                key={phase.id}
                style={{ width: `${widthPct}%` }}
                className="text-center"
              >
                {(isCurrent || widthPct >= 20) && (
                  <span
                    className="text-[9px] leading-tight block truncate px-0.5"
                    style={{ color: isCurrent ? phase.color : '#9ca3af', fontWeight: isCurrent ? 600 : 400 }}
                  >
                    {phase.label.replace('fase', '').replace('week', 'wk').trim()}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats rij */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center">
          <div className="text-lg font-bold text-gray-900">{weeksUntilRace}</div>
          <div className="text-[10px] text-gray-500">weken tot race</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-gray-900">{formatMinutes(plannedMinutes)}</div>
          <div className="text-[10px] text-gray-500">gepland week</div>
        </div>
        <div className="text-center">
          <div
            className="text-lg font-bold"
            style={{ color: actualMinutes >= plannedMinutes * 0.9 ? '#22c55e' : actualMinutes > 0 ? '#f59e0b' : '#9ca3af' }}
          >
            {formatMinutes(actualMinutes)}
          </div>
          <div className="text-[10px] text-gray-500">actueel week</div>
        </div>
      </div>

      {/* Huidige fase + doelen */}
      <button
        onClick={() => setGoalsOpen((o) => !o)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: currentPhase.color }}
          />
          <span className="text-xs font-medium" style={{ color: currentPhase.color }}>
            {currentPhase.label}
          </span>
        </div>
        <span className="text-gray-400 text-xs">{goalsOpen ? '▲' : '▼'}</span>
      </button>

      {goalsOpen && (
        <ul className="mt-2 space-y-1">
          {currentPhase.goals.map((goal) => (
            <li key={goal} className="text-xs text-gray-600 flex items-start gap-1.5">
              <span style={{ color: currentPhase.color }} className="mt-0.5">•</span>
              {goal}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
