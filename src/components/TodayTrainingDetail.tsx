'use client';

import { Fragment, useEffect, useState, useMemo } from 'react';
import SportIcon from '@/components/SportIcon';
import { TrainingDay, SessionBreakdown, SessionSegment, Sport, HeartRateZoneInfo, HEART_RATE_ZONES } from '@/lib/types';
import {
  getRunZones,
  getCyclingZones,
  buildHRZoneText,
  getSessionBreakdowns,
  saveSessionBreakdowns,
  sessionsSignature,
  getStrengthWorkoutForSession,
  getStrengthVariations,
  saveStrengthVariations,
  getRecentStrengthExercises,
  getSwimPaceTargets,
  getProfile,
} from '@/lib/storage';
import { athleteProfilePayload } from '@/lib/athlete';
import { SwimPaceTargets, formatSwimPaceRange } from '@/lib/swim';
import { findBrickPair, formatDuration } from '@/lib/schedule';
import type { StrengthWorkout } from '@/lib/strength';
import StrengthWorkoutDetail from '@/components/StrengthWorkoutDetail';
import SendToGarminButton from '@/components/SendToGarminButton';

function zonesForSport(sport: Sport): HeartRateZoneInfo[] {
  if (sport === 'hardlopen') return getRunZones();
  if (sport === 'fietsen' || sport === 'mountainbike') return getCyclingZones();
  return HEART_RATE_ZONES;
}

// Zwemmen stuurt op tempo per 100m i.p.v. hartslag (bpm is in het water onbruikbaar).
function zoneBadgeContent(sport: Sport, zoneInfo: HeartRateZoneInfo, swimPaces: SwimPaceTargets | null, withLabel: boolean): string {
  if (sport === 'zwemmen') {
    const t = swimPaces?.zones.find((z) => z.zone === zoneInfo.zone);
    const base = withLabel ? `${zoneInfo.zone} · ${zoneInfo.label}` : zoneInfo.zone;
    return t ? `${base} · ${formatSwimPaceRange(t)} /100m` : `${zoneInfo.zone} · ${zoneInfo.label}`;
  }
  return withLabel
    ? `${zoneInfo.zone} · ${zoneInfo.label} · ${zoneInfo.min}–${zoneInfo.max} bpm`
    : `${zoneInfo.zone} · ${zoneInfo.min}–${zoneInfo.max} bpm`;
}

function capitalize(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

const SPORT_LABEL: Record<string, string> = {
  zwemmen: 'Zwemmen', fietsen: 'Fietsen', hardlopen: 'Hardlopen',
  mountainbike: 'Mountainbike', wandelen: 'Wandelen', voetballen: 'Voetballen',
  multisport: 'Multisport', kracht: 'Kracht', rust: 'Rust',
};

function SegmentRow({ segment, sport, swimPaces }: { segment: SessionSegment; sport: Sport; swimPaces: SwimPaceTargets | null }) {
  // Warming-up en cooldown sturen alleen op tijd — geen hartslagzone als doel.
  const isWarmupCooldown = segment.kind === 'warmup' || segment.kind === 'cooldown';
  const zoneInfo = segment.zone && !isWarmupCooldown ? zonesForSport(sport).find((z) => z.zone === segment.zone) : null;
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
            {zoneBadgeContent(sport, zoneInfo, swimPaces, false)}
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
  // Wisselende oefenlijst per krachtsessie (null = nog niet binnen → vaste workout).
  const [strengthVariations, setStrengthVariations] = useState<(StrengthWorkout | null)[] | null>(null);
  const [strengthLoading, setStrengthLoading] = useState(false);
  // Ophogen = opnieuw laten samenstellen ("Andere oefeningen").
  const [strengthNonce, setStrengthNonce] = useState(0);

  const sessions = training && !training.isRestDay ? training.sessions : [];
  const hasSwim = sessions.some((s) => s.sport === 'zwemmen');
  const swimPaces = useMemo(() => (hasSwim ? getSwimPaceTargets() : null), [hasSwim]);
  // Krachtsessies krijgen een vaste oefenlijst (geen AI-breakdown met zones).
  const breakdownSessions = sessions.filter((s) => s.sport !== 'kracht');
  const signature = breakdownSessions.length > 0 ? sessionsSignature(breakdownSessions) : '';
  const strengthSessions = sessions.filter((s) => s.sport === 'kracht');
  const strengthSignature = strengthSessions.length > 0 ? sessionsSignature(strengthSessions) : '';

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
          body: JSON.stringify({ sessions: breakdownSessions, hrZoneText: buildHRZoneText(), athleteProfile: athleteProfilePayload(getProfile()) }),
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

  // Krachtsessies: de vaste workout uit strength.ts is de basis (materiaal +
  // opzet); /api/strength-workout maakt daar een variatie op zodat je niet elke
  // week dezelfde oefeningen doet. Mislukt dat, dan blijft de vaste lijst staan.
  useEffect(() => {
    if (!strengthSignature) {
      setStrengthVariations(null);
      return;
    }
    if (strengthNonce === 0) {
      const cached = getStrengthVariations(strengthSignature);
      if (cached) {
        setStrengthVariations(cached);
        return;
      }
    }
    let cancelled = false;
    setStrengthLoading(true);
    (async () => {
      try {
        const res = await fetch('/api/strength-workout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessions: strengthSessions.map((s) => ({
              type: s.type,
              durationMinutes: s.durationMinutes,
              description: s.description,
              base: getStrengthWorkoutForSession(s),
            })),
            athleteProfile: athleteProfilePayload(getProfile()),
            avoid: getRecentStrengthExercises(),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Mislukt');
        if (cancelled) return;
        setStrengthVariations(data.workouts);
        saveStrengthVariations(strengthSignature, data.workouts);
      } catch {
        // Stil: de vaste workout is een prima terugval, geen foutmelding nodig.
        if (!cancelled) setStrengthVariations(null);
      } finally {
        if (!cancelled) setStrengthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strengthSignature, strengthNonce]);

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

  // breakdowns is uitgelijnd op breakdownSessions (zonder kracht) — map terug op sessievolgorde.
  let breakdownCursor = 0;
  const breakdownForIdx = training.sessions.map((s) =>
    s.sport === 'kracht' ? undefined : breakdowns?.[breakdownCursor++]
  );

  // strengthVariations is uitgelijnd op de krachtsessies — map terug op sessievolgorde.
  let strengthCursor = 0;
  const variationForIdx = training.sessions.map((s) =>
    s.sport === 'kracht' ? strengthVariations?.[strengthCursor++] ?? null : null
  );

  // Brick-dag: loop direct na het fietsen — wissel-connector tussen de kaarten,
  // en de brick-run krijgt geen eigen warming-up (je komt warm van de fiets).
  const brick = findBrickPair(training.sessions);

  return (
    <div className="space-y-3">
      {training.sessions.map((session, idx) => {
        const zoneInfo = session.zone ? zonesForSport(session.sport).find((z) => z.zone === session.zone) : null;
        const isStrength = session.sport === 'kracht';
        const isBrickRun = brick?.runIndex === idx;
        let breakdown = breakdownForIdx[idx];
        if (breakdown && isBrickRun) {
          breakdown = { ...breakdown, segments: breakdown.segments.filter((seg) => seg.kind !== 'warmup') };
        }
        const workout = isStrength ? variationForIdx[idx] ?? getStrengthWorkoutForSession(session) : null;
        const card = (
          <div className="bg-[#0d0d0f] rounded-3xl border border-white/5 p-4">
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
                      {zoneBadgeContent(session.sport, zoneInfo, swimPaces, true)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Gedetailleerde uitvoering */}
            <div className="mt-4 pt-4 border-t border-white/5">
              {isStrength && workout ? (
                <StrengthWorkoutDetail
                  workout={workout}
                  varied={variationForIdx[idx] !== null}
                  refreshing={strengthLoading}
                  onRefresh={() => setStrengthNonce((n) => n + 1)}
                />
              ) : breakdown ? (
                <div className="space-y-3">
                  {isBrickRun && (
                    <p className="text-xs text-gray-500">
                      Geen aparte warming-up — je komt warm van de fiets, start direct in je doelzone.
                    </p>
                  )}
                  {breakdown.segments.map((seg, si) => (
                    <SegmentRow key={si} segment={seg} sport={session.sport} swimPaces={swimPaces} />
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

              {/* Rechtstreeks als gestructureerde workout naar het horloge:
                  hardlopen/fietsen op hartslagzones, kracht op sets/herhalingen. */}
              <SendToGarminButton
                session={session}
                segments={breakdown?.segments ?? null}
                skipWarmup={isBrickRun}
                strengthWorkout={workout}
              />
            </div>
          </div>
        );

        return (
          <Fragment key={idx}>
            {isBrickRun && (
              <div className="flex items-center justify-center -my-1 relative z-10">
                <span className="text-[11px] font-bold uppercase tracking-wide text-amber-400 bg-amber-500/10 border border-amber-500/25 px-3 py-1 rounded-full">
                  Snelle wissel — direct door
                </span>
              </div>
            )}
            {card}
          </Fragment>
        );
      })}
    </div>
  );
}
