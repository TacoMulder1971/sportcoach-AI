'use client';

import { useEffect, useState } from 'react';
import SportIcon from '@/components/SportIcon';
import { TrainingDay, SessionBreakdown, SessionSegment, Sport, HeartRateZoneInfo, HEART_RATE_ZONES } from '@/lib/types';
import {
  getRunZones,
  getCyclingZones,
  buildHRZoneText,
  getSessionBreakdowns,
  saveSessionBreakdowns,
  sessionsSignature,
} from '@/lib/storage';
import { formatDuration } from '@/lib/schedule';

function zonesForSport(sport: Sport): HeartRateZoneInfo[] {
  if (sport === 'hardlopen') return getRunZones();
  if (sport === 'fietsen' || sport === 'mountainbike') return getCyclingZones();
  return HEART_RATE_ZONES;
}

function capitalize(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

const SPORT_LABEL: Record<string, string> = {
  zwemmen: 'Zwemmen', fietsen: 'Fietsen', hardlopen: 'Hardlopen',
  mountainbike: 'Mountainbike', wandelen: 'Wandelen', voetballen: 'Voetballen',
  multisport: 'Multisport', rust: 'Rust',
};

function SegmentRow({ segment, sport }: { segment: SessionSegment; sport: Sport }) {
  const zoneInfo = segment.zone ? zonesForSport(sport).find((z) => z.zone === segment.zone) : null;
  const accent =
    segment.kind === 'warmup' ? '#22c55e' : segment.kind === 'cooldown' ? '#9ca3af' : zoneInfo?.color || '#3b82f6';

  return (
    <div className="relative pl-4">
      <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full" style={{ backgroundColor: accent }} />
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-gray-100">{segment.label}</span>
        <span className="text-xs text-gray-400 tabular-nums">{segment.minutes} min</span>
        {zoneInfo && (
          <span
            className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: `${zoneInfo.color}26`, color: zoneInfo.color }}
          >
            {zoneInfo.zone} · {zoneInfo.min}–{zoneInfo.max} bpm
          </span>
        )}
      </div>
      <p className="text-sm text-gray-300 mt-0.5 leading-relaxed">{segment.detail}</p>
      {segment.technique && (
        <p className="text-xs text-gray-400 mt-1">
          <span className="text-gray-500">Techniek:</span> {segment.technique}
        </p>
      )}
    </div>
  );
}

export default function TodayTrainingDetail({ training }: { training: TrainingDay | null }) {
  const [breakdowns, setBreakdowns] = useState<SessionBreakdown[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sessions = training && !training.isRestDay ? training.sessions : [];
  const signature = sessions.length > 0 ? sessionsSignature(sessions) : '';

  useEffect(() => {
    if (!signature) {
      setBreakdowns(null);
      return;
    }
    const cached = getSessionBreakdowns(signature);
    if (cached) {
      setBreakdowns(cached);
      return;
    }
    let cancelled = false;
    setBreakdowns(null);
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch('/api/session-breakdown', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessions, hrZoneText: buildHRZoneText() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Mislukt');
        if (cancelled) return;
        setBreakdowns(data.breakdowns);
        saveSessionBreakdowns(signature, data.breakdowns);
      } catch {
        if (!cancelled) setError('Kon trainingsdetails niet laden. Probeer het later opnieuw.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  if (!training) {
    return (
      <div className="bg-[#0d0d0f] rounded-3xl p-6 border border-white/5 text-center">
        <p className="text-gray-400">Geen training gepland vandaag</p>
      </div>
    );
  }

  if (training.isRestDay) {
    return (
      <div className="bg-[#0d0d0f] rounded-3xl p-6 border border-white/5 text-center">
        <p className="text-gray-200 font-medium">Rustdag</p>
        <p className="text-gray-400 text-sm mt-1">Geen training gepland — focus op herstel.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {training.sessions.map((session, idx) => {
        const zoneInfo = session.zone ? zonesForSport(session.sport).find((z) => z.zone === session.zone) : null;
        const breakdown = breakdowns?.[idx];
        return (
          <div key={idx} className="bg-[#0d0d0f] rounded-3xl border border-white/5 p-4">
            {/* Kop: sport + samenvatting */}
            <div className="flex items-start gap-3">
              <SportIcon sport={session.sport} size="lg" />
              <div className="flex-1 min-w-0">
                {training.sessions.length > 1 && (
                  <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide mb-0.5">
                    Onderdeel {idx + 1} van {training.sessions.length}
                  </p>
                )}
                <p className="text-white font-semibold text-lg leading-snug">{session.description}</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-xs font-medium text-gray-300 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                    {SPORT_LABEL[session.sport] || session.sport}
                  </span>
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

            {/* Gedetailleerde uitvoering */}
            <div className="mt-4 pt-4 border-t border-white/5">
              {breakdown ? (
                <div className="space-y-3">
                  {breakdown.segments.map((seg, si) => (
                    <SegmentRow key={si} segment={seg} sport={session.sport} />
                  ))}
                </div>
              ) : loading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.1s]" />
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                  </span>
                  Gedetailleerd plan laden...
                </div>
              ) : error ? (
                <p className="text-sm text-gray-500">{error}</p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
