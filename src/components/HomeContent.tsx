'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Countdown from '@/components/Countdown';
import SportIcon from '@/components/SportIcon';
import { getTodayTraining, getCurrentWeekNumber, getDaysUntilRace, getDaysInCurrentCycle, getTrainingForDayOffset, formatDuration } from '@/lib/schedule';
import { getRecentCheckIns, getGarminData, saveGarminData, getActivePlan, getDailyMessage, saveDailyMessage, clearDailyMessage, markAutoSyncDone, shouldAutoSync, getActiveRaceDate, buildRaceContextText, buildGoalsHistoryText, getPendingResultGoal, dismissGoalResultPrompt, getEquipment, getActivityAssignments, getActivityArchive, mergeActivitiesIntoArchive, mergeHealthIntoArchive, getGarminCredentials } from '@/lib/storage';
import { buildEquipmentAttentionLine, filterStatsActivities } from '@/lib/equipment';
import { calculateTrainingLoad, getTrainingReadiness, estimatePlannedTRIMP, getTrainingAdvice, calcTRIMP } from '@/lib/training-load';
import { TrainingDay, GarminSyncData, TrainingLoadData, TrainingReadiness, TrainingAdvice, Goal } from '@/lib/types';

type IconProps = { className?: string; style?: React.CSSProperties };
function IconChat({ className, style }: IconProps) {
  return (<svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>);
}
function IconTrophy({ className, style }: IconProps) {
  return (<svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>);
}

// Whoop-achtige ring: groot, dun, met gloed in de score-kleur
function ScoreRing({ pct, label, sublabel, color, glow, size = 144 }: { pct: number; label: string; sublabel: string; color: string; glow: string; size?: number }) {
  const r = 70;
  const c = 2 * Math.PI * r;
  const compact = size < 130;
  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg viewBox="0 0 160 160" className="-rotate-90" style={{ width: size, height: size }}>
        <circle cx="80" cy="80" r={r} fill="none" stroke="#1c1c1e" strokeWidth="10" />
        <circle
          cx="80" cy="80" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c}
          style={{ filter: glow }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-white font-bold tabular-nums ${compact ? 'text-2xl' : 'text-4xl'}`}>{pct}%</span>
        <span className={`text-gray-300 font-medium mt-1 uppercase tracking-wide ${compact ? 'text-[10px]' : 'text-sm'}`}>{label}</span>
        {!compact && <span className="text-gray-400 text-sm mt-0.5">{sublabel}</span>}
      </div>
    </div>
  );
}

function readinessRingColor(colorClass: string): { color: string; glow: string } {
  if (colorClass.includes('green')) return { color: '#22c55e', glow: 'drop-shadow(0 0 10px #22c55e) drop-shadow(0 0 24px rgba(34,197,94,0.45))' };
  if (colorClass.includes('yellow')) return { color: '#eab308', glow: 'drop-shadow(0 0 10px #eab308) drop-shadow(0 0 24px rgba(234,179,8,0.45))' };
  return { color: '#ef4444', glow: 'drop-shadow(0 0 10px #ef4444) drop-shadow(0 0 24px rgba(239,68,68,0.45))' };
}

function loadAccent(statusColor: string): { glow: string; bar: string; text: string } {
  if (statusColor.includes('blue')) return { glow: 'drop-shadow(0 0 10px rgba(96,165,250,0.5))', bar: 'bg-blue-400', text: 'text-blue-400' };
  if (statusColor.includes('green')) return { glow: 'drop-shadow(0 0 10px rgba(74,222,128,0.5))', bar: 'bg-green-400', text: 'text-green-400' };
  if (statusColor.includes('orange')) return { glow: 'drop-shadow(0 0 10px rgba(251,146,60,0.5))', bar: 'bg-orange-400', text: 'text-orange-400' };
  return { glow: 'drop-shadow(0 0 10px rgba(248,113,113,0.5))', bar: 'bg-red-400', text: 'text-red-400' };
}

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function mondayOf(d: Date): Date {
  const monday = new Date(d);
  const day = monday.getDay();
  monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export default function HomeContent() {
  const [todayTraining, setTodayTraining] = useState<TrainingDay | null>(null);
  const [yesterdayTraining, setYesterdayTraining] = useState<TrainingDay | null>(null);
  const [garmin, setGarmin] = useState<GarminSyncData | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [dailyMessage, setDailyMessage] = useState<string | null>(null);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [pendingResultGoal, setPendingResultGoal] = useState<Goal | null>(null);

  const fetchDailyMessage = useCallback(async (training: TrainingDay | null, garminData: GarminSyncData | null, load: TrainingLoadData | null, ready: TrainingReadiness | null, prevDayTraining: TrainingDay | null = null) => {
    // Check cache first
    const cached = getDailyMessage();
    if (cached) {
      setDailyMessage(cached.message);
      return;
    }

    setLoadingDaily(true);
    try {
      const checkIns = getRecentCheckIns(5);
      // Gisteren = eerste check-out (lijst is al reverse gesorteerd)
      const yesterdayCheckOut = checkIns.length > 0 ? checkIns[0] : null;
      const { cycleStartDate } = getActivePlan();

      const equipment = getEquipment();
      const assignments = getActivityAssignments();
      const equipmentAttention = buildEquipmentAttentionLine(equipment, garminData?.activities || [], assignments);
      // Filter stadsfiets-rides eruit voor de coach context
      const trainingActivities = filterStatsActivities(garminData?.activities || [], equipment, assignments);

      const res = await fetch('/api/daily-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          todayTraining: training,
          yesterdayTraining: prevDayTraining,
          yesterdayCheckOut,
          garminHealth: garminData?.health || null,
          garminActivities: trainingActivities.slice(0, 3) || null,
          trainingLoad: load,
          readiness: ready,
          daysUntilRace: getDaysUntilRace(getActiveRaceDate()),
          weekNumber: getCurrentWeekNumber(cycleStartDate),
          dayInCycle: getDaysInCurrentCycle(cycleStartDate),
          localDateTime: new Date().toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' }),
          raceContext: buildRaceContextText(),
          goalsHistory: buildGoalsHistoryText(),
          equipmentAttention,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setDailyMessage(data.message);
        saveDailyMessage(data.message);
      }
    } catch {
      // Silently fail — fallback to static advice
    } finally {
      setLoadingDaily(false);
    }
  }, []);

  useEffect(() => {
    const { plan, cycleStartDate } = getActivePlan();
    const training = getTodayTraining(plan, cycleStartDate);
    const yt = getTrainingForDayOffset(-1, plan, cycleStartDate);
    setTodayTraining(training);
    setYesterdayTraining(yt);
    setGarmin(getGarminData());
    setPendingResultGoal(getPendingResultGoal());

    // Eerst syncen, dan pas de Coach van de dag genereren (zodat die verse data ziet).
    // Sync als er credentials zijn én er nog geen dagbericht voor vandaag is, of als de
    // dagelijkse auto-sync nog moet. Zonder credentials valt de coach terug op de cache.
    const hasMessageForToday = getDailyMessage() !== null;
    if (getGarminCredentials() && (shouldAutoSync() || !hasMessageForToday)) {
      handleGarminSync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGarminSync() {
    setSyncing(true);
    setSyncError(null);
    try {
      // Stuur bestaande activity IDs mee zodat server alleen details ophaalt voor nieuwe
      const existingData = getGarminData();
      const existingActivityIds = existingData?.activities?.map(a => a.id) || [];
      const creds = getGarminCredentials();

      const res = await fetch('/api/garmin/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ existingActivityIds, email: creds?.email, password: creds?.password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync mislukt');

      // Merge: behoud hrZones van bestaande activiteiten
      if (existingData?.activities) {
        const existingMap = new Map(existingData.activities.map(a => [a.id, a]));
        for (const activity of data.activities) {
          if (!activity.hrZones && existingMap.has(activity.id)) {
            activity.hrZones = existingMap.get(activity.id)?.hrZones;
          }
        }
      }

      // Eerst alles in het archief, daarna de live-weergave compact houden.
      mergeActivitiesIntoArchive(data.activities);
      mergeHealthIntoArchive(data.health);
      data.activities = data.activities.slice(0, 40);
      saveGarminData(data);
      setGarmin(data);
      markAutoSyncDone();
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : 'Sync mislukt');
    } finally {
      setSyncing(false);
    }
  }

  // Coach van de dag handmatig vernieuwen: eerst syncen (als er creds zijn), dan
  // genereren. Na de sync regenereert de reactieve effect-hook het bericht vanzelf
  // (cache is gewist). Zonder creds genereren we direct uit de huidige cache.
  async function refreshDailyMessage() {
    clearDailyMessage();
    setDailyMessage(null);
    if (getGarminCredentials()) {
      await handleGarminSync();
    } else {
      fetchDailyMessage(todayTraining, garmin, trainingLoad, readiness, yesterdayTraining);
    }
  }

  // Stadsfiets-ritten uitsluiten van training-statistieken
  const statsActivities = useMemo(() => {
    if (!garmin) return [];
    return filterStatsActivities(garmin.activities, getEquipment(), getActivityAssignments());
  }, [garmin]);

  const trainingLoad: TrainingLoadData | null = useMemo(() => {
    if (!garmin) return null;
    return calculateTrainingLoad(statsActivities, garmin.health);
  }, [garmin, statsActivities]);

  const readiness: TrainingReadiness | null = useMemo(() => {
    if (!garmin) return null;
    return getTrainingReadiness(garmin.health, !!todayTraining && !todayTraining.isRestDay, statsActivities);
  }, [garmin, todayTraining, statsActivities]);

  // Trainingsadvies: gereedheid vs. geplande training
  const trainingAdvice: TrainingAdvice | null = useMemo(() => {
    if (!readiness || !todayTraining || todayTraining.isRestDay) return null;
    const plannedTRIMP = estimatePlannedTRIMP(todayTraining.sessions);
    return getTrainingAdvice(readiness, plannedTRIMP);
  }, [readiness, todayTraining]);

  // Fetch daily message — laad cache direct, genereer alleen als nodig
  useEffect(() => {
    const cached = getDailyMessage();
    if (cached) {
      setDailyMessage(cached.message);
      return;
    }
    if (syncing || !garmin) return; // wacht op verse Garmin data voor nieuwe generatie
    fetchDailyMessage(todayTraining, garmin, trainingLoad, readiness, yesterdayTraining);
  }, [syncing, todayTraining, garmin, trainingLoad, readiness, yesterdayTraining, fetchDailyMessage]);

  // TRIMP per dag van de afgelopen 7 dagen, voor de mini-sparkline bij Training load
  const dailyTrimp = useMemo(() => {
    const restingHR = garmin?.health?.restingHR || 55;
    const days: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = isoDate(d);
      const sum = statsActivities
        .filter((a) => a.date === dateStr)
        .reduce((s, a) => s + calcTRIMP(a, restingHR), 0);
      days.push(sum);
    }
    return days;
  }, [garmin, statsActivities]);

  // Volume per sport deze week vs. vorige week, uit het archief (langere geschiedenis dan de live 40)
  const volumeComparison = useMemo(() => {
    const archive = filterStatsActivities(getActivityArchive(), getEquipment(), getActivityAssignments());
    const today = new Date();
    const thisMonday = mondayOf(today);
    const thisMondayStr = isoDate(thisMonday);
    const todayStr = isoDate(today);
    const prevMonday = new Date(thisMonday);
    prevMonday.setDate(thisMonday.getDate() - 7);
    const prevMondayStr = isoDate(prevMonday);
    const prevSunday = new Date(thisMonday);
    prevSunday.setDate(thisMonday.getDate() - 1);
    const prevSundayStr = isoDate(prevSunday);

    const sportDefs = [
      { sport: 'zwemmen' as const, label: 'Zwemmen', match: (s: string) => s === 'zwemmen' },
      { sport: 'fietsen' as const, label: 'Fietsen', match: (s: string) => s === 'fietsen' || s === 'mountainbike' },
      { sport: 'hardlopen' as const, label: 'Hardlopen', match: (s: string) => s === 'hardlopen' },
    ];

    return sportDefs.map(({ sport, label, match }) => {
      const currentKm = archive
        .filter((a) => match(a.sport) && a.date >= thisMondayStr && a.date <= todayStr)
        .reduce((s, a) => s + (a.distanceKm || 0), 0);
      const prevKm = archive
        .filter((a) => match(a.sport) && a.date >= prevMondayStr && a.date <= prevSundayStr)
        .reduce((s, a) => s + (a.distanceKm || 0), 0);

      const maxKm = Math.max(currentKm, prevKm, 0.01);
      const pct = Math.round((currentKm / maxKm) * 100);
      const prevPct = Math.round((prevKm / maxKm) * 100);
      const deltaLabel = prevKm < 0.01
        ? (currentKm < 0.01 ? '0%' : 'Nieuw')
        : `${currentKm >= prevKm ? '+' : ''}${Math.round(((currentKm - prevKm) / prevKm) * 100)}%`;

      return { sport, label, value: `${currentKm.toFixed(1)} km`, pct, prevPct, delta: deltaLabel, hasData: currentKm >= 0.01 || prevKm >= 0.01 };
    }).filter((s) => s.hasData);
  }, [garmin]);

  return (
    <div className="bg-black min-h-screen">
      <div className="fixed top-0 inset-x-0 bg-black z-50" style={{ height: 'env(safe-area-inset-top, 0px)' }} />
      {/* Hero */}
      <div className="px-5 pt-6">
        <Countdown gradientClassName="bg-gradient-to-br from-teal-700 via-cyan-800 to-blue-900" />
      </div>

      <div className="px-5 space-y-5 pb-8">
        {/* Post-race resultaat prompt */}
        {pendingResultGoal && (
          <div className="bg-[#0d0d0f] border border-amber-500/20 rounded-3xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center flex-shrink-0">
                <IconTrophy className="w-4 h-4" style={{ color: '#f59e0b', filter: 'drop-shadow(0 0 6px #f59e0b)' }} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-400">Wedstrijd voltooid!</p>
                <p className="text-sm text-gray-300 mt-0.5">
                  Je {pendingResultGoal.name} was voorbij. Vul je resultaat in.
                </p>
                <div className="flex gap-2 mt-2">
                  <Link
                    href={`/schema?tab=longterm&goal=${pendingResultGoal.id}`}
                    className="text-xs bg-amber-500 text-black px-3 py-1.5 rounded-lg font-semibold"
                  >
                    Resultaat invullen
                  </Link>
                  <button
                    onClick={() => {
                      dismissGoalResultPrompt(pendingResultGoal.id);
                      setPendingResultGoal(null);
                    }}
                    className="text-xs text-gray-400 px-2 py-1.5"
                  >
                    Later
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Gereedheid + Training load naast elkaar (Whoop "Recovery" / "Strain") */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#0d0d0f] rounded-3xl p-4 border border-white/5">
            {readiness ? (
              <>
                <ScoreRing
                  pct={Math.round((readiness.score / readiness.maxScore) * 100)}
                  label="Gereedheid"
                  sublabel={readiness.label}
                  size={104}
                  {...readinessRingColor(readiness.color)}
                />
                <div className="grid grid-cols-3 gap-1 mt-4">
                  {[
                    { label: readiness.factors.label1, val: readiness.factors.score1, max: readiness.factors.max1 },
                    { label: readiness.factors.label2, val: readiness.factors.score2, max: readiness.factors.max2 },
                    { label: readiness.factors.label3, val: readiness.factors.score3, max: readiness.factors.max3 },
                  ].map((f, i) => (
                    <div key={i} className={`text-center ${i === 1 ? 'border-x border-white/5' : ''}`}>
                      <p className="text-gray-400 text-[9px] uppercase tracking-wide truncate">{f.label}</p>
                      <div className="flex gap-px justify-center mt-1">
                        {f.val === null
                          ? Array.from({ length: f.max }, (_, j) => (
                              <div key={j} className="w-2 h-2 rounded-sm bg-white/5 border border-dashed border-white/15" />
                            ))
                          : Array.from({ length: f.max }, (_, j) => j + 1).map((j) => (
                              <div
                                key={j}
                                className={`w-2 h-2 rounded-sm ${
                                  j <= f.val!
                                    ? f.val! >= f.max * 0.6 ? 'bg-green-400' : f.val! >= f.max * 0.3 ? 'bg-yellow-400' : 'bg-red-400'
                                    : 'bg-white/10'
                                }`}
                              />
                            ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-gray-400 text-sm text-center py-8">Sync voor gereedheid-data</p>
            )}
          </div>

          <div className="bg-[#0d0d0f] rounded-3xl p-4 border border-white/5 flex flex-col">
            <p className="text-gray-300 text-sm font-semibold uppercase tracking-wide">Training load</p>
            {trainingLoad && (
              <span className={`${loadAccent(trainingLoad.statusColor).text} text-sm font-semibold capitalize`}>
                {trainingLoad.status}
              </span>
            )}
            {trainingLoad ? (
              <>
                <span className="text-white text-3xl font-bold tabular-nums mt-2" style={{ filter: loadAccent(trainingLoad.statusColor).glow }}>
                  {trainingLoad.weekLoad}
                </span>
                <span className="text-gray-400 text-xs">TRIMP · 7 dagen</span>
                <div className="flex gap-1 mt-3 h-8 items-end">
                  {dailyTrimp.map((v, i) => {
                    const maxV = Math.max(...dailyTrimp, 1);
                    const h = Math.max(6, Math.round((v / maxV) * 100));
                    return (
                      <div
                        key={i}
                        className={`flex-1 rounded-sm ${loadAccent(trainingLoad.statusColor).bar}`}
                        style={{ height: `${h}%`, opacity: i === dailyTrimp.length - 1 ? 1 : 0.35 }}
                      />
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-gray-400 text-sm py-2">Sync voor data</p>
            )}
          </div>
        </div>

        {/* Dagelijks coach-bericht */}
        <div className="bg-[#0d0d0f] rounded-3xl p-4 border border-white/5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center flex-shrink-0" style={{ filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.15))' }}>
              <IconChat className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <p className="text-gray-300 text-sm font-semibold uppercase tracking-wide">Coach van de dag</p>
                <button
                  onClick={refreshDailyMessage}
                  disabled={loadingDaily || syncing}
                  className="text-gray-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  aria-label="Bericht vernieuwen"
                  title="Bericht vernieuwen"
                >
                  <svg className={`w-4 h-4 ${loadingDaily ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>
                  </svg>
                </button>
              </div>
              {(syncing || loadingDaily) && !dailyMessage ? (
                <div className="flex items-center gap-2 py-1">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0.1s]" />
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                  </div>
                  <span className="text-sm text-gray-400">{syncing ? 'Syncing...' : 'Coach denkt na...'}</span>
                </div>
              ) : dailyMessage ? (
                <p className="text-base text-gray-100 leading-relaxed">{dailyMessage}</p>
              ) : (
                <p className="text-base text-gray-100">
                  {readiness?.advice || trainingLoad?.advice || 'Even geduld, coach laadt...'}
                </p>
              )}
              {syncError && <p className="text-xs text-red-400 mt-1">{syncError}</p>}
            </div>
          </div>
        </div>

        {/* Training vandaag */}
        <div>
          <p className="text-gray-400 text-sm font-semibold uppercase tracking-wide mb-2 px-1">Training vandaag</p>
          {trainingAdvice && (
            <div className="bg-[#0d0d0f] rounded-3xl p-4 border border-white/5 mb-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center flex-shrink-0">
                  {trainingAdvice.level === 'go' ? (
                    <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  ) : trainingAdvice.level === 'adjust' ? (
                    <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01"/></svg>
                  ) : (
                    <svg className="w-4 h-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                  )}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${trainingAdvice.level === 'go' ? 'text-green-400' : trainingAdvice.level === 'adjust' ? 'text-amber-400' : 'text-red-400'}`}>{trainingAdvice.label}</p>
                  <p className="text-sm text-gray-300 mt-0.5">{trainingAdvice.message}</p>
                </div>
              </div>
            </div>
          )}
          {todayTraining ? (
            todayTraining.isRestDay ? (
              <div className="bg-[#0d0d0f] rounded-3xl p-6 border border-white/5 text-center">
                <p className="text-gray-200 font-medium">Rustdag</p>
                <p className="text-gray-400 text-sm mt-1">Geen training gepland — focus op herstel.</p>
              </div>
            ) : (
              <div className="bg-[#0d0d0f] rounded-3xl border border-white/5 divide-y divide-white/5">
                {todayTraining.sessions.map((session, idx) => (
                  <div key={idx} className="p-4 flex items-center gap-3">
                    <SportIcon sport={session.sport} size="lg" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-lg truncate">{session.description}</p>
                      <p className="text-gray-400 text-sm">
                        {session.durationMinutes ? formatDuration(session.durationMinutes) : ''}
                        {session.zone ? ` · ${session.zone}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="bg-[#0d0d0f] rounded-3xl p-6 border border-white/5 text-center">
              <p className="text-gray-400">Geen training gepland vandaag</p>
            </div>
          )}
        </div>

        {/* Volume per sport — vergeleken met vorige week */}
        <div>
          <p className="text-gray-400 text-sm font-semibold uppercase tracking-wide mb-2 px-1">Volume deze week</p>
          <div className="bg-[#0d0d0f] rounded-3xl p-4 border border-white/5 space-y-3">
            {volumeComparison.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">Nog geen activiteit deze week</p>
            ) : volumeComparison.map((s) => {
              const isUp = s.delta.startsWith('+');
              const isDown = s.delta.startsWith('-');
              return (
                <div key={s.label} className="flex items-center gap-3">
                  <SportIcon sport={s.sport} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-white text-base font-semibold whitespace-nowrap">{s.label}</span>
                      <span className="text-gray-100 text-base font-medium whitespace-nowrap">{s.value}</span>
                    </div>
                    <div className="relative bg-white/5 rounded-full h-1.5 mt-1.5">
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-px h-3 bg-white/30"
                        style={{ left: `${s.prevPct}%` }}
                      />
                      <div className="rounded-full h-1.5 bg-gradient-to-r from-white/40 to-white/80" style={{ width: `${s.pct}%` }} />
                    </div>
                    <p
                      className={`text-xs font-semibold mt-1 text-right whitespace-nowrap ${
                        isUp ? 'text-emerald-400' : isDown ? 'text-rose-400' : 'text-gray-300'
                      }`}
                    >
                      {isUp ? '↑' : isDown ? '↓' : ''} {s.delta} vs vorige week
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
