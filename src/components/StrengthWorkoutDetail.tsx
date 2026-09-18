'use client';

import { StrengthWorkout, exerciseVideoUrl } from '@/lib/strength';

// Toont de oefenlijst van een krachtsessie (Home-tab, donker thema).
// Geen hartslagzones — sets/reps of tijd per oefening.
//
// `varied` = deze lijst is voor vandaag samengesteld (wisselt per krachtdag);
// zonder dat zie je de vaste basislijst uit de instellingen.
export default function StrengthWorkoutDetail({
  workout,
  varied,
  refreshing,
  onRefresh,
}: {
  workout: StrengthWorkout;
  varied?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <div className="space-y-4">
      {workout.intro && <p className="text-sm text-gray-400 leading-relaxed">{workout.intro}</p>}

      {refreshing && !varied ? (
        <p className="text-xs text-gray-500">Nieuwe oefeningen samenstellen...</p>
      ) : varied ? (
        <p className="text-xs text-gray-500">Voor vandaag samengesteld — wisselt per krachtdag.</p>
      ) : null}

      {workout.blocks.map((block, bi) => (
        <div key={bi}>
          {/* Lange labels duwen de notitie naar een eigen regel i.p.v. twee
              smalle kolommen naast elkaar (op 375px onleesbaar). */}
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 mb-2">
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
                  {/* Uitleg opzoeken — zoeklink, zie exerciseVideoUrl */}
                  <a
                    href={exerciseVideoUrl(ex)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-1 -ml-1 px-1 py-0.5 text-[11px] font-medium text-gray-500 hover:text-rose-300"
                    aria-label={`Bekijk uitleg van ${ex.name} op YouTube`}
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="m10 8 6 4-6 4V8Z" />
                    </svg>
                    Bekijk uitleg
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-4 flex-wrap">
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-300 disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              <path d="M3 21v-5h5" />
            </svg>
            {refreshing ? 'Bezig...' : 'Andere oefeningen'}
          </button>
        )}
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
    </div>
  );
}
