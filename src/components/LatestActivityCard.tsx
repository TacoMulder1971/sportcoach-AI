'use client';

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
  const zones = zonesForSport(activity.sport);
  const matchScore = plannedSession ? computeActivityMatchScore(activity, plannedSession, zones) : null;
  const actualZone = getHRZone(activity.avgHR, zones);
  const actualZoneInfo = actualZone ? zones.find((z) => z.zone === actualZone) : null;
  const totalZoneMin = activity.hrZones?.reduce((s, z) => s + z.minutes, 0) || 0;

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
    </div>
  );
}
