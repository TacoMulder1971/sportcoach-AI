'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Countdown from '@/components/Countdown';
import TrainingCard from '@/components/TrainingCard';
import RaceProgressMeter from '@/components/RaceProgressMeter';
import { getTodayTraining, getCurrentWeekNumber, getDaysUntilRace, getDaysInCurrentCycle } from '@/lib/schedule';
import { getRecentCheckIns, getGarminData, saveGarminData, getActivePlan, getDailyMessage, saveDailyMessage, markAutoSyncDone } from '@/lib/storage';
import { calculateTrainingLoad, getTrainingReadiness, estimatePlannedTRIMP, getTrainingAdvice } from '@/lib/training-load';
import { TrainingDay, CheckIn, FEELING_SCALE, GarminSyncData, TrainingLoadData, TrainingReadiness, TrainingAdvice } from '@/lib/types';

export default function Dashboard() {
  const [todayTraining, setTodayTraining] = useState<TrainingDay | null>(null);
  const [recentCheckIns, setRecentCheckIns] = useState<CheckIn[]>([]);
  const [garmin, setGarmin] = useState<GarminSyncData | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [dailyMessage, setDailyMessage] = useState<string | null>(null);
  const [loadingDaily, setLoadingDaily] = useState(false);


  const fetchDailyMessage = useCallback(async (training: TrainingDay | null, garminData: GarminSyncData | null, load: TrainingLoadData | null, ready: TrainingReadiness | null) => {
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

      const res = await fetch('/api/daily-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          todayTraining: training,
          yesterdayCheckOut,
          garminHealth: garminData?.health || null,
          garminActivities: garminData?.activities?.slice(0, 3) || null,
          trainingLoad: load,
          readiness: ready,
          daysUntilRace: getDaysUntilRace('2026-06-13'),
          weekNumber: getCurrentWeekNumber(cycleStartDate),
          dayInCycle: getDaysInCurrentCycle(cycleStartDate),
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
    setTodayTraining(training);
    setRecentCheckIns(getRecentCheckIns(1));
    setGarmin(getGarminData());

    // Altijd Garmin synchen bij openen — coach van de dag wacht op verse data
    handleGarminSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGarminSync() {
    setSyncing(true);
    setSyncError(null);
    try {
      // Stuur bestaande activity IDs mee zodat server alleen details ophaalt voor nieuwe
      const existingData = getGarminData();
      const existingActivityIds = existingData?.activities?.map(a => a.id) || [];

      const res = await fetch('/api/garmin/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ existingActivityIds }),
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

      saveGarminData(data);
      setGarmin(data);
      markAutoSyncDone();
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : 'Sync mislukt');
    } finally {
      setSyncing(false);
    }
  }

  const trainingLoad: TrainingLoadData | null = useMemo(() => {
    if (!garmin) return null;
    return calculateTrainingLoad(garmin.activities, garmin.health);
  }, [garmin]);

  const readiness: TrainingReadiness | null = useMemo(() => {
    if (!garmin) return null;
    return getTrainingReadiness(garmin.health, !!todayTraining && !todayTraining.isRestDay, garmin.activities);
  }, [garmin, todayTraining]);

  // Trainingsadvies: gereedheid vs. geplande training
  const trainingAdvice: TrainingAdvice | null = useMemo(() => {
    if (!readiness || !todayTraining || todayTraining.isRestDay) return null;
    const plannedTRIMP = estimatePlannedTRIMP(todayTraining.sessions);
    return getTrainingAdvice(readiness, plannedTRIMP);
  }, [readiness, todayTraining]);

  // Fetch daily message — wacht tot Garmin sync klaar is
  useEffect(() => {
    if (syncing) return; // wacht op verse Garmin data
    if (!garmin) return; // geen data beschikbaar
    const cached = getDailyMessage();
    if (cached) {
      setDailyMessage(cached.message);
      return;
    }
    fetchDailyMessage(todayTraining, garmin, trainingLoad, readiness);
  }, [syncing, todayTraining, garmin, trainingLoad, readiness, fetchDailyMessage]);

  // Load bar percentage (0-100, capped at 600 TRIMP)
  const loadPct = trainingLoad ? Math.min(100, (trainingLoad.weekLoad / 600) * 100) : 0;
  const loadBarColor = trainingLoad
    ? trainingLoad.status === 'laag' ? 'bg-blue-400'
    : trainingLoad.status === 'optimaal' ? 'bg-green-500'
    : trainingLoad.status === 'hoog' ? 'bg-orange-500'
    : 'bg-red-500'
    : 'bg-gray-300';

  return (
    <div className="px-4 pt-6 space-y-5">
      {/* Header + Sync */}
      <div className="text-center">
        <h1 className="text-[24px] font-bold text-gray-900">My Sport Coach AI</h1>
        <p className="text-gray-500 text-[14px]">Jouw persoonlijke trainingscoach</p>
      </div>

      {/* Countdown */}
      <Countdown />

      {/* Voortgangsmeter race */}
      <RaceProgressMeter garmin={garmin} />

      {/* Training Load + Battery Advies */}
      <div className="grid grid-cols-2 gap-3">
        {/* Training Load */}
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-xs text-gray-400 mb-1">Training Load</p>
          {trainingLoad ? (
            <>
              <p className={`text-2xl font-bold ${trainingLoad.statusColor}`}>
                {trainingLoad.weekLoad}
              </p>
              <p className={`text-xs font-semibold ${trainingLoad.statusColor} mb-2`}>
                {trainingLoad.status.charAt(0).toUpperCase() + trainingLoad.status.slice(1)}
              </p>
              <div className="bg-gray-100 rounded-full h-2">
                <div className={`${loadBarColor} rounded-full h-2 transition-all`} style={{ width: `${loadPct}%` }} />
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400 mt-1">Sync voor data</p>
          )}
        </div>

        {/* Trainingsgereedheid */}
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-xs text-gray-400 mb-1">Gereedheid</p>
          {readiness ? (
            <>
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-3 h-3 rounded-full ${readiness.bgColor}`} />
                <p className={`text-lg font-bold ${readiness.color}`}>
                  {readiness.label}
                </p>
              </div>
              <p className={`text-xs ${readiness.color} font-semibold mb-2`}>{readiness.score}/9</p>
              <div className="flex gap-1">
                {[
                  { label: readiness.factors.label1, val: readiness.factors.score1, max: readiness.factors.max1 },
                  { label: readiness.factors.label2, val: readiness.factors.score2, max: readiness.factors.max2 },
                  { label: readiness.factors.label3, val: readiness.factors.score3, max: readiness.factors.max3 },
                ].map((f) => (
                  <div key={f.label} className="flex-1 text-center">
                    <div className="flex gap-px justify-center mb-0.5">
                      {Array.from({ length: f.max }, (_, i) => i + 1).map((i) => (
                        <div
                          key={i}
                          className={`w-2 h-2 rounded-sm ${
                            i <= f.val
                              ? f.val >= f.max * 0.6 ? 'bg-green-400' : f.val >= f.max * 0.3 ? 'bg-yellow-400' : 'bg-red-400'
                              : 'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-[9px] text-gray-400">{f.label}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-400 mt-1">Sync voor data</p>
          )}
        </div>
      </div>

      {/* Dagelijks coach-bericht */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-blue-600 mb-1">Coach van de dag</p>
            {(syncing || loadingDaily) && !dailyMessage ? (
              <div className="flex items-center gap-2 py-1">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-blue-300 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-blue-300 rounded-full animate-bounce [animation-delay:0.1s]" />
                  <span className="w-2 h-2 bg-blue-300 rounded-full animate-bounce [animation-delay:0.2s]" />
                </div>
                <span className="text-xs text-blue-400">{syncing ? 'Syncing...' : 'Coach denkt na...'}</span>
              </div>
            ) : dailyMessage ? (
              <p className="text-sm text-gray-700 leading-relaxed">{dailyMessage}</p>
            ) : (
              <p className="text-sm text-gray-700">
                {readiness?.advice || trainingLoad?.advice || 'Even geduld, coach laadt...'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Training van vandaag */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Training vandaag
        </h2>
        {trainingAdvice && (
          <div className={`${trainingAdvice.bgColor} border ${trainingAdvice.borderColor} rounded-xl p-4 mb-3`}>
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-lg ${trainingAdvice.level === 'go' ? 'bg-green-100' : trainingAdvice.level === 'adjust' ? 'bg-amber-100' : 'bg-red-100'} flex items-center justify-center flex-shrink-0`}>
                {trainingAdvice.level === 'go' ? (
                  <svg className={`w-4 h-4 ${trainingAdvice.iconColor}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                ) : trainingAdvice.level === 'adjust' ? (
                  <svg className={`w-4 h-4 ${trainingAdvice.iconColor}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01"/></svg>
                ) : (
                  <svg className={`w-4 h-4 ${trainingAdvice.iconColor}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                )}
              </div>
              <div>
                <p className={`text-sm font-semibold ${trainingAdvice.color}`}>{trainingAdvice.label}</p>
                <p className="text-xs text-gray-600 mt-0.5">{trainingAdvice.message}</p>
              </div>
            </div>
          </div>
        )}
        {todayTraining ? (
          <TrainingCard training={todayTraining} isToday />
        ) : (
          <div className="bg-white rounded-xl p-6 border border-gray-200 text-center">
            <p className="text-gray-500">Geen training gepland vandaag</p>
          </div>
        )}
      </section>

      {/* Snelle acties */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Snel naar</h2>
        <div className="grid grid-cols-4 gap-2">
          <Link href="/checkin" className="bg-white rounded-xl p-3 border border-gray-200 hover:border-blue-300 transition-colors flex flex-col items-center text-center">
            <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center mb-1">
              <svg className="w-4 h-4 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M9 14l2 2 4-4"/><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
            </div>
            <p className="text-xs font-medium">Check-out</p>
          </Link>
          <Link href="/coach" className="bg-white rounded-xl p-3 border border-gray-200 hover:border-blue-300 transition-colors flex flex-col items-center text-center">
            <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center mb-1">
              <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <p className="text-xs font-medium">Coach</p>
          </Link>
          <Link href="/schema" className="bg-white rounded-xl p-3 border border-gray-200 hover:border-blue-300 transition-colors flex flex-col items-center text-center">
            <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center mb-1">
              <svg className="w-4 h-4 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <p className="text-xs font-medium">Schema</p>
          </Link>
          <Link href="/data" className="bg-white rounded-xl p-3 border border-gray-200 hover:border-blue-300 transition-colors flex flex-col items-center text-center">
            <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center mb-1">
              <svg className="w-4 h-4 text-orange-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            </div>
            <p className="text-xs font-medium">Data</p>
          </Link>
        </div>
      </section>

      {/* Recente check-outs */}
      {recentCheckIns.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Laatste check-out
          </h2>
          <div className="space-y-2">
            {recentCheckIns.map((ci) => (
              <div
                key={ci.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                <div className="p-3 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full ${FEELING_SCALE[ci.feeling]?.color} ${FEELING_SCALE[ci.feeling]?.textColor} flex items-center justify-center font-bold text-base flex-shrink-0`}>
                    {ci.feeling}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-medium truncate">
                      {ci.trainingDay}
                    </p>
                    {ci.note && (
                      <p className="text-sm text-gray-500 truncate">{ci.note}</p>
                    )}
                  </div>
                  <span className="text-sm text-gray-400">{ci.date}</span>
                </div>
                {(() => {
                  // Toon laatste assistant-bericht uit gesprek, of fallback naar feedback
                  const lastMsg = ci.messages?.filter(m => m.role === 'assistant').slice(-1)[0];
                  const displayText = lastMsg?.content || ci.feedback;
                  if (!displayText) return null;
                  return (
                    <div className="px-3 pb-3 pt-0">
                      <div className="bg-blue-50 rounded-lg p-2.5 flex items-start gap-2">
                        <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        <p className="text-sm text-gray-600 leading-relaxed">{displayText}</p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Bottom spacer for nav */}
      <div className="h-4" />
    </div>
  );
}
