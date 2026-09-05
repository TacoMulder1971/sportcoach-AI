'use client';

import { useEffect, useState } from 'react';
import { getUpcomingGoals, getProfile, getRacePrepChecked, toggleRacePrepDevice } from '@/lib/storage';
import { getDaysUntilRace } from '@/lib/schedule';
import { buildRacePrepAdvice, RacePrepAdvice } from '@/lib/race-prep';

function IconBattery({ className = 'w-4 h-4', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="16" height="10" rx="2" />
      <path d="M22 11v2" />
      <path d="m11 9-2 3h3l-2 3" />
    </svg>
  );
}

/**
 * Oplaad-herinnering in de laatste dagen vóór een wedstrijd: horloge,
 * fietscomputer en elektronische schakeling (Di2). Verschijnt vanaf 3 dagen
 * ervoor en verdwijnt zodra alles is afgevinkt. Rendert niets als er geen
 * wedstrijd in zicht is.
 */
export default function RacePrepCard() {
  const [advice, setAdvice] = useState<RacePrepAdvice | null>(null);
  const [checked, setChecked] = useState<string[]>([]);

  useEffect(() => {
    const goal = getUpcomingGoals()[0] ?? null;
    const a = buildRacePrepAdvice(goal, goal ? getDaysUntilRace(goal.date) : null, getProfile());
    setAdvice(a);
    if (a) setChecked(getRacePrepChecked(a.goalId));
  }, []);

  if (!advice) return null;

  const allDone = advice.devices.every((d) => checked.includes(d.id));
  const accent = allDone ? '#22c55e' : advice.urgent ? '#f59e0b' : '#3b82f6';

  return (
    <div
      className="bg-[#0d0d0f] rounded-3xl p-4 border"
      style={{ borderColor: `${accent}33` }}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center flex-shrink-0">
          <IconBattery style={{ color: accent, filter: `drop-shadow(0 0 6px ${accent})` }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: accent }}>
            {allDone ? 'Apparatuur is opgeladen' : 'Laad je apparatuur op'}
          </p>
          <p className="text-sm text-gray-300 mt-0.5 leading-relaxed">
            {allDone
              ? `Alles staat klaar voor ${advice.raceName}. Niets meer aan doen.`
              : advice.timing}
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        {advice.devices.map((d) => {
          const done = checked.includes(d.id);
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => setChecked(toggleRacePrepDevice(advice.goalId, d.id))}
              className="w-full flex items-start gap-3 text-left bg-white/5 rounded-xl px-3 py-2"
            >
              <span
                className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-md border flex items-center justify-center ${
                  done ? 'bg-green-500 border-green-500' : 'border-white/25'
                }`}
              >
                {done && (
                  <svg className="w-3 h-3 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </span>
              <span className="min-w-0">
                <span className={`block text-sm font-medium ${done ? 'text-gray-500 line-through' : 'text-gray-100'}`}>
                  {d.label}
                </span>
                {d.hint && !done && (
                  <span className="block text-xs text-gray-500 mt-0.5 leading-relaxed">{d.hint}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
