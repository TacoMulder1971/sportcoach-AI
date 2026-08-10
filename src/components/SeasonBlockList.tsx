'use client';

import { SeasonBlock } from '@/lib/types';
import { formatRangeNL, phaseLabelFor, phaseColorFor, describeBlockLoad } from '@/lib/season';

interface Props {
  blocks: SeasonBlock[];
  /** Kalenderdag die als "nu" gemarkeerd wordt (Amsterdamse datum). */
  todayISO?: string;
}

/**
 * Tijdlijn van seizoensblokken. Zelfde vorm als de oude fasetijdlijn (rail met
 * stippen), maar gevoed door het opgeslagen seizoensplan i.p.v. de vaste
 * dagen-tot-race-vensters.
 */
export default function SeasonBlockList({ blocks, todayISO }: Props) {
  if (blocks.length === 0) return null;

  return (
    <div className="relative">
      {blocks.map((block, idx) => {
        const isCurrent = !!todayISO && todayISO >= block.startDate && todayISO <= block.endDate;
        const isPast = !!todayISO && todayISO > block.endDate;
        const color = phaseColorFor(block.phaseId);
        const load = describeBlockLoad(block);

        return (
          <div key={`${block.startDate}-${idx}`} className="flex gap-3 relative">
            <div className="flex flex-col items-center w-8 flex-shrink-0">
              <div
                className="w-4 h-4 rounded-full border-2 z-10"
                style={{
                  borderColor: isCurrent || isPast ? color : 'rgba(255,255,255,0.2)',
                  backgroundColor: isCurrent ? color : isPast ? color : '#0d0d0f',
                  opacity: isPast ? 0.5 : 1,
                }}
              />
              {idx < blocks.length - 1 && (
                <div className={`w-0.5 flex-1 ${isPast ? 'bg-gray-600' : 'bg-white/10'}`} />
              )}
            </div>

            <div
              className={`flex-1 mb-4 rounded-3xl p-4 border ${
                isCurrent
                  ? 'bg-blue-500/10 border-blue-500/40 shadow-[0_0_0_1px_rgba(59,130,246,0.2)]'
                  : isPast
                  ? 'bg-[#0d0d0f] border-white/5 opacity-60'
                  : 'bg-[#0d0d0f] border-white/5'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className={`font-semibold ${isCurrent ? 'text-blue-300' : 'text-gray-100'}`}>
                  {block.label}
                </h3>
                {isCurrent && (
                  <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full flex-shrink-0">Nu</span>
                )}
              </div>

              <p className="text-xs text-gray-500 mb-2">
                {formatRangeNL(block.startDate, block.endDate)} · {block.weeks} {block.weeks === 1 ? 'week' : 'weken'} ·{' '}
                <span style={{ color }}>{phaseLabelFor(block.phaseId)}</span>
              </p>

              {block.focus && <p className="text-sm text-gray-300 mb-3">{block.focus}</p>}

              {(load || block.keyWorkouts?.length) && (
                <div className="flex flex-wrap gap-1.5">
                  {load && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-300">
                      {load}
                    </span>
                  )}
                  {block.keyWorkouts?.map((k, ki) => (
                    <span
                      key={ki}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-400"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              )}

              {block.raceName && (
                <p className="text-xs text-amber-300 mt-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Wedstrijd in dit blok: {block.raceName}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
