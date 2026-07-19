'use client';

import { Fragment, useMemo } from 'react';
import { TrainingDay, TrainingSession, HEART_RATE_ZONES, Sport, HeartRateZoneInfo } from '@/lib/types';
import { findBrickPair, formatDuration } from '@/lib/schedule';
import { getRunZones, getCyclingZones, getSwimPaceTargets } from '@/lib/storage';
import { SwimPaceTargets, formatSwimPaceRange } from '@/lib/swim';
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

// Badge-tekst per sessie: zwemmen krijgt richttempo per 100m (bpm is in het
// water onbruikbaar), andere sporten het hartslagbereik.
function zoneBadgeText(session: TrainingSession, zoneInfo: HeartRateZoneInfo, swimPaces: SwimPaceTargets | null): string {
  if (session.sport === 'zwemmen') {
    const t = swimPaces?.zones.find(z => z.zone === zoneInfo.zone);
    return t
      ? `${zoneInfo.zone} · ${zoneInfo.label} · ${formatSwimPaceRange(t)} /100m`
      : `${zoneInfo.zone} · ${zoneInfo.label}`;
  }
  return `${zoneInfo.zone} · ${zoneInfo.label} · ${zoneInfo.min}–${zoneInfo.max} bpm`;
}

function capitalize(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export default function TrainingCard({ training, isToday = false, compact = false, dark = false }: TrainingCardProps) {
  const hasSwim = training.sessions.some((s) => s.sport === 'zwemmen');
  const swimPaces = useMemo(() => (hasSwim ? getSwimPaceTargets() : null), [hasSwim]);
  // Brick-dag: wissel-connector tussen de fiets- en loopsessie
  const brick = findBrickPair(training.sessions);

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
                <Fragment key={idx}>
                {brick?.runIndex === idx && (
                  <div className="flex items-center justify-center">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2.5 py-0.5 rounded-full">
                      Snelle wissel — direct door
                    </span>
                  </div>
                )}
                <div className="flex items-start gap-3">
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
                          {zoneBadgeText(session, zoneInfo, swimPaces)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                </Fragment>
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
          <Fragment key={idx}>
          {brick?.runIndex === idx && (
            <div className="flex items-center justify-center">
              <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                Snelle wissel — direct door
              </span>
            </div>
          )}
          <div className="flex items-start gap-3">
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
                {session.zone && (() => {
                  const zoneInfo = zonesForSport(session.sport).find((z) => z.zone === session.zone);
                  if (!zoneInfo) return null;
                  return (
                    <span
                      className={`${isToday ? 'text-sm px-2' : 'text-xs px-1.5'} py-0.5 rounded font-medium text-white`}
                      style={{ backgroundColor: zoneInfo.color }}
                    >
                      {zoneBadgeText(session, zoneInfo, swimPaces)}
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
