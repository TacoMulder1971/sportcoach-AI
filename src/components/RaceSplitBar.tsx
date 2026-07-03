'use client';

import { RaceSplit } from '@/lib/races';
import { formatDuration } from '@/lib/storage';

const EMOJI: Record<string, string> = {
  zwemmen: '🏊', fietsen: '🚴', hardlopen: '🏃', transitie: '↔️',
};

export default function RaceSplitBar({ splits }: { splits: RaceSplit[] }) {
  if (splits.length === 0) return null;
  const total = splits.reduce((s, x) => s + x.timeSeconds, 0) || 1;

  return (
    <div className="space-y-3">
      {/* Tijdlijn-balk: onderdelen op schaal van hun duur */}
      <div className="flex w-full h-3 rounded-full overflow-hidden">
        {splits.map((s, i) => (
          <div
            key={i}
            style={{ width: `${(s.timeSeconds / total) * 100}%`, backgroundColor: s.color }}
            title={`${s.label} · ${formatDuration(s.timeSeconds)}`}
          />
        ))}
      </div>

      {/* Onderdeel-rijen */}
      <div className="divide-y divide-white/5">
        {splits.map((s, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <span
              className="w-1.5 h-8 rounded-full flex-shrink-0"
              style={{ backgroundColor: s.color }}
            />
            <span className="w-5 text-center">{EMOJI[s.discipline] || '•'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-100">{s.label}</p>
              <p className="text-xs text-gray-500">
                {s.distanceKm && s.distanceKm > 0 && (
                  <>{s.distanceKm < 1 ? `${Math.round(s.distanceKm * 1000)}m` : `${s.distanceKm.toFixed(2)}km`}</>
                )}
                {s.pace && <> · {s.pace}</>}
                {s.avgHR && <> · HR {s.avgHR}</>}
                {s.avgPower && <> · {s.avgPower}W</>}
              </p>
            </div>
            <span className="text-sm font-bold text-white tabular-nums flex-shrink-0">
              {formatDuration(s.timeSeconds)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
