'use client';

import { StrengthWorkout } from '@/lib/strength';

// Toont de oefenlijst van een krachtsessie (Home-tab, donker thema).
// Geen hartslagzones — sets/reps of tijd per oefening.
export default function StrengthWorkoutDetail({ workout }: { workout: StrengthWorkout }) {
  return (
    <div className="space-y-4">
      {workout.intro && <p className="text-sm text-gray-400 leading-relaxed">{workout.intro}</p>}

      {workout.blocks.map((block, bi) => (
        <div key={bi}>
          <div className="flex items-baseline justify-between mb-2">
            <p className="text-sm font-semibold text-rose-400">{block.label}</p>
            {block.note && <p className="text-[11px] text-gray-500">{block.note}</p>}
          </div>
          <div className="rounded-2xl bg-white/[0.03] border border-white/5 divide-y divide-white/5">
            {block.exercises.map((ex, ei) => (
              <div key={ei} className="flex items-start gap-3 px-3 py-2.5">
                <span className="mt-0.5 w-5 h-5 rounded-md bg-rose-500/15 text-rose-300 text-[11px] font-bold flex items-center justify-center flex-shrink-0 tabular-nums">
                  {ei + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-gray-100">{ex.name}</span>
                    <span className="text-sm font-semibold text-gray-200 tabular-nums whitespace-nowrap">{ex.prescription}</span>
                  </div>
                  {ex.note && <p className="text-xs text-gray-500 mt-0.5">{ex.note}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <a
        href="/data?section=instellingen"
        className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-300"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          <path d="m15 5 4 4" />
        </svg>
        Oefeningen aanpassen
      </a>
    </div>
  );
}
