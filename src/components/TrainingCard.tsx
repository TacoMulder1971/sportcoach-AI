'use client';

import { TrainingDay, HEART_RATE_ZONES, Sport, HeartRateZoneInfo } from '@/lib/types';
import { formatDuration } from '@/lib/schedule';
import { getRunZones, getCyclingZones } from '@/lib/storage';
import SportIcon from './SportIcon';

interface TrainingCardProps {
  training: TrainingDay;
  isToday?: boolean;
  compact?: boolean;
  dark?: boolean;
}

// Sport-specifieke zones (zoals op de Home-tab); fallback op de statische run-zones.
function zonesForSport(sport: Sport): HeartRateZoneInfo[] {
  if (sport === 'hardlopen') return getRunZones();
  if (sport === 'fietsen' || sport === 'mountainbike') return getCyclingZones();
  return HEART_RATE_ZONES;
}

function capitalize(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export default function TrainingCard({ training, isToday = false, compact = false, dark = false }: TrainingCardProps) {
  if (dark) {
    return (
      <div
        className={`rounded-3xl p-4 border transition-all ${
          isToday
            ? 'bg-[#0d0d0f] border-blue-500/40 shadow-[0_0_0_1px_rgba(59,130,246,0.25),0_8px_30px_rgba(0,0,0,0.5)]'
            : 'bg-[#0d0d0f] border-white/5'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`font-semibold ${isToday ? 'text-blue-400' : 'text-gray-100'}`}>
              {training.day}
            </span>
            {isToday && (
              <span className="text-[10px] font-bold uppercase tracking-wide bg-blue-500 text-white px-2 py-0.5 rounded-full">
                Vandaag
              </span>
            )}
          </div>
          {training.isRestDay && (
            <span className="text-[10px] font-semibold uppercase tracking-wide bg-white/5 text-gray-400 border border-white/10 px-2 py-0.5 rounded-full">
              Rustdag
            </span>
          )}
        </div>

        {training.isRestDay ? (
          <p className="text-gray-500 text-sm">Geen training gepland — focus op herstel.</p>
        ) : (
          <div className="space-y-3">
            {training.sessions.map((session, idx) => {
              const zoneInfo = session.zone
                ? zonesForSport(session.sport).find((z) => z.zone === session.zone)
                : null;
              return (
                <div key={idx} className="flex items-start gap-3">
                  <SportIcon sport={session.sport} size="xl" />
                  <div className="flex-1 min-w-0">
                    {training.sessions.length > 1 && (
                      <p className="text-gray-500 text-[11px] font-semibold uppercase tracking-wide mb-0.5">
                        Onderdeel {idx + 1} van {training.sessions.length}
                      </p>
                    )}
                    <p className="text-base text-gray-100 leading-relaxed">{session.description}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      {session.type && (
                        <span className="text-xs font-medium text-gray-300 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                          {capitalize(session.type)}
                        </span>
                      )}
                      {session.durationMinutes && (
                        <span className="text-xs font-medium text-gray-300 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                          {formatDuration(session.durationMinutes)}
                        </span>
                      )}
                      {zoneInfo && (
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${zoneInfo.color}26`, color: zoneInfo.color }}
                        >
                          {zoneInfo.zone} · {zoneInfo.label} · {zoneInfo.min}–{zoneInfo.max} bpm
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl p-4 transition-all ${
        isToday
          ? 'bg-blue-50 border-2 border-blue-500 shadow-md'
          : 'bg-white border border-gray-200'
      } ${compact ? '' : 'shadow-sm'}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`${isToday ? 'text-lg font-bold text-blue-700' : 'font-semibold text-gray-900'}`}>
            {training.day}
          </span>
          {isToday && (
            <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">
              Vandaag
            </span>
          )}
        </div>
        {training.isRestDay && (
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            Rustdag
          </span>
        )}
      </div>

      <div className="space-y-2">
        {training.sessions.map((session, idx) => (
          <div key={idx} className="flex items-start gap-3">
            <SportIcon sport={session.sport} size="lg" />
            <div className="flex-1 min-w-0">
              <p className={`${isToday ? 'text-base font-semibold' : 'text-sm font-medium'} text-gray-900`}>
                {session.description}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {session.durationMinutes && (
                  <span className={`${isToday ? 'text-sm' : 'text-xs'} text-gray-500`}>
                    {formatDuration(session.durationMinutes)}
                  </span>
                )}
                {session.zone && (
                  <span
                    className={`${isToday ? 'text-sm px-2' : 'text-xs px-1.5'} py-0.5 rounded font-medium text-white`}
                    style={{
                      backgroundColor:
                        HEART_RATE_ZONES.find((z) => z.zone === session.zone)?.color ?? '#888',
                    }}
                  >
                    {session.zone}{' '}
                    ({HEART_RATE_ZONES.find((z) => z.zone === session.zone)?.min}–
                    {HEART_RATE_ZONES.find((z) => z.zone === session.zone)?.max} bpm)
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
