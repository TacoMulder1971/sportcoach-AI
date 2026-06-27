'use client';

import { useState } from 'react';
import SportIcon from '@/components/SportIcon';
import { GarminActivity, TrainingSession, HEART_RATE_ZONES } from '@/lib/types';
import { getRunZones, getCyclingZones } from '@/lib/storage';
import { computeActivityMatchScore, getHRZone } from '@/lib/training-load';
import { daysBetween } from '@/lib/coach-dates';

const DAY_NAMES = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];

function dayLabel(iso: string): string {
  const todayIso = new Date().toISOString().split('T')[0];
  const daysAgo = daysBetween(iso, todayIso);
  if (daysAgo === 0) return 'Vandaag';
  if (daysAgo === 1) return 'Gisteren';
  const name = DAY_NAMES[new Date(`${iso}T00:00:00Z`).getUTCDay()];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

const SPORT_LABEL: Record<string, string> = {
  zwemmen: 'Zwemmen', fietsen: 'Fietsen', hardlopen: 'Hardlopen',
  mountainbike: 'Mountainbike', wandelen: 'Wandelen', voetballen: 'Voetballen',
  multisport: 'Multisport', rust: 'Rust', overig: 'Activiteit',
};

function zonesForSport(sport: string) {
  if (sport === 'hardlopen') return getRunZones();
  if (sport === 'fietsen' || sport === 'mountainbike') return getCyclingZones();
  return HEART_RATE_ZONES;
}

function scoreColor(score: number): string {
  if (score >= 85) return '#22c55e';
  if (score >= 60) return '#eab308';
  return '#ef4444';
}

export default function LatestActivityCard({
  activity,
  plannedSession,
}: {
  activity: GarminActivity;
  plannedSession: TrainingSession | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const zones = zonesForSport(activity.sport);
  const matchScore = plannedSession ? computeActivityMatchScore(activity, plannedSession, zones) : null;
  const actualZone = getHRZone(activity.avgHR, zones);
  const actualZoneInfo = actualZone ? zones.find((z) => z.zone === actualZone) : null;
  const totalZoneMin = activity.hrZones?.reduce((s, z) => s + z.minutes, 0) || 0;

  // Extra stats voor de uitgeklapte weergave (alleen tonen wat data heeft)
  const extraStats: { label: string; value: string }[] = [];
  if (activity.maxHR > 0) extraStats.push({ label: 'Max HR', value: `${activity.maxHR}` });
  if (activity.avgPace) extraStats.push({ label: activity.sport === 'fietsen' || activity.sport === 'mountainbike' ? 'Snelheid' : 'Tempo', value: activity.avgPace });
  if ((activity.avgPower || 0) > 0) extraStats.push({ label: 'Vermogen', value: `${activity.avgPower}W${(activity.normalizedPower || 0) > 0 ? ` (NP ${activity.normalizedPower})` : ''}` });
  if (activity.calories > 0) extraStats.push({ label: 'Calorieën', value: `${activity.calories}` });
  if (activity.elevationGain > 0) extraStats.push({ label: 'Hoogtemeters', value: `${activity.elevationGain} m` });
  if (activity.avgRunCadence > 0) extraStats.push({ label: 'Cadans', value: `${activity.avgRunCadence} spm` });
  if (activity.avgBikeCadence > 0) extraStats.push({ label: 'Cadans', value: `${activity.avgBikeCadence} rpm` });
  if (activity.vo2Max > 0) extraStats.push({ label: 'VO₂max', value: `${activity.vo2Max}` });
  if (activity.trainingEffectAerobic > 0) extraStats.push({ label: 'Aeroob TE', value: activity.trainingEffectAerobic.toFixed(1) });
  if (activity.trainingEffectAnaerobic > 0) extraStats.push({ label: 'Anaeroob TE', value: activity.trainingEffectAnaerobic.toFixed(1) });

  const hasSplits = !!activity.splits && activity.splits.length > 1;
  const hasDetails = extraStats.length > 0 || totalZoneMin > 0 || hasSplits;

  return (
    <div className="bg-[#0d0d0f] rounded-3xl p-4 border border-white/5">
      <div className="flex items-start gap-3">
        <SportIcon sport={activity.sport} size="lg" />
        <div className="flex-1 min-w-0">
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">
            {dayLabel(activity.date)}{activity.startTime ? ` · ${activity.startTime}` : ''}
          </p>
          <p className="text-white font-semibold text-base leading-snug truncate">{activity.activityName}</p>
        </div>
        {matchScore && (
          <div className="text-right flex-shrink-0">
            <span className="text-2xl font-bold tabular-nums" style={{ color: scoreColor(matchScore.score) }}>
              {matchScore.score}%
            </span>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">match</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        <div>
          <p className="text-sm font-bold text-gray-100">{activity.durationMinutes} min</p>
          <p className="text-[10px] text-gray-500">Duur</p>
        </div>
        <div>
          <p className="text-sm font-bold text-gray-100">{activity.distanceKm > 0 ? `${activity.distanceKm} km` : '–'}</p>
          <p className="text-[10px] text-gray-500">Afstand</p>
        </div>
        <div>
          <p className="text-sm font-bold" style={{ color: actualZoneInfo?.color || '#f87171' }}>
            {activity.avgHR || '–'}
          </p>
          <p className="text-[10px] text-gray-500">{actualZone ? `${actualZone} · gem HR` : 'Gem HR'}</p>
        </div>
      </div>

      {totalZoneMin > 0 && (
        <div className="flex gap-0.5 mt-3 h-2 rounded-full overflow-hidden">
          {activity.hrZones!.filter((z) => z.minutes > 0).map((z) => {
            const info = zones.find((zi) => zi.zone === z.zone);
            return (
              <div
                key={z.zone}
                style={{ width: `${(z.minutes / totalZoneMin) * 100}%`, backgroundColor: info?.color || '#6b7280' }}
              />
            );
          })}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-white/5">
        {plannedSession ? (
          <>
            <p className="text-sm text-gray-300">
              Gepland: {plannedSession.durationMinutes ? `${plannedSession.durationMinutes} min` : ''}
              {plannedSession.zone ? ` in ${plannedSession.zone}` : ''} ({SPORT_LABEL[plannedSession.sport] || plannedSession.sport}
              {plannedSession.type ? `, ${plannedSession.type}` : ''})
            </p>
            {matchScore && (
              <p className="text-sm font-medium mt-1" style={{ color: scoreColor(matchScore.score) }}>
                {matchScore.label}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400">Geen geplande training om mee te vergelijken.</p>
        )}
      </div>

      {hasDetails && (
        <>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-3 w-full flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-gray-200 transition-colors"
            aria-expanded={expanded}
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
            {expanded ? 'Verberg details' : 'Toon details'}
          </button>

          {expanded && (
            <div className="mt-3 pt-3 border-t border-white/5 space-y-4">
              {/* Uitgebreide statistieken */}
              {extraStats.length > 0 && (
                <div className="grid grid-cols-3 gap-x-2 gap-y-3 text-center">
                  {extraStats.map((s) => (
                    <div key={s.label}>
                      <p className="text-sm font-bold text-gray-100">{s.value}</p>
                      <p className="text-[10px] text-gray-500">{s.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Zone-verdeling in minuten */}
              {totalZoneMin > 0 && (
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">Tijd per zone</p>
                  <div className="space-y-1.5">
                    {activity.hrZones!.filter((z) => z.minutes > 0).map((z) => {
                      const info = zones.find((zi) => zi.zone === z.zone);
                      return (
                        <div key={z.zone} className="flex items-center gap-2 text-xs">
                          <span className="w-6 font-semibold" style={{ color: info?.color || '#9ca3af' }}>{z.zone}</span>
                          <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${(z.minutes / totalZoneMin) * 100}%`, backgroundColor: info?.color || '#6b7280' }} />
                          </div>
                          <span className="w-12 text-right text-gray-400 tabular-nums">{z.minutes} min</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Ronden / laps */}
              {hasSplits && (
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-2">
                    {activity.isMultisport ? 'Disciplines' : 'Ronden'}
                  </p>
                  <div className="space-y-0.5">
                    {activity.splits!.map((s, i) => {
                      const mins = Math.floor(s.durationSeconds / 60);
                      const secs = s.durationSeconds % 60;
                      return (
                        <div key={i} className="flex items-center gap-2 text-xs text-gray-400">
                          <span className="w-4 text-right text-gray-600">{i + 1}.</span>
                          {s.distance > 0 && <span>{s.distance < 1 ? `${Math.round(s.distance * 1000)}m` : `${s.distance}km`}</span>}
                          <span className="text-gray-300">{mins}:{secs.toString().padStart(2, '0')}</span>
                          {s.avgHR > 0 && <span className="text-red-400">HR {s.avgHR}</span>}
                          {(s.avgPower || 0) > 0 && <span className="text-amber-500">{s.avgPower}W</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
