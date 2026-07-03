'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  getGarminData,
  getGarminCredentials,
  shouldAutoSync,
  syncGarminData,
  getDailyMessage,
  saveDailyMessage,
  clearDailyMessage,
  getActivePlan,
  getRecentCheckIns,
  getEquipment,
  getActivityAssignments,
  getActiveRaceDate,
  buildRaceContextText,
  buildGoalsHistoryText,
} from '@/lib/storage';
import { getTodayTraining, getTrainingForDayOffset, getDaysUntilRace, getCurrentWeekNumber, getDaysInCurrentCycle } from '@/lib/schedule';
import { filterStatsActivities, buildEquipmentAttentionLine } from '@/lib/equipment';
import { calculateTrainingLoad, getTrainingReadiness } from '@/lib/training-load';
import { GarminSyncData } from '@/lib/types';

// "Coach van de dag" op de Coach-tab: synct Garmin bij het openen (als dat nodig is)
// en toont daarna het dagbericht. Zelfde cache als de Home-tab (1x per dag).
export default function DailyCoachSection() {
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const generate = useCallback(async (garminData: GarminSyncData | null) => {
    setLoading(true);
    try {
      const { plan, cycleStartDate } = getActivePlan();
      const todayTraining = getTodayTraining(plan, cycleStartDate);
      const yesterdayTraining = getTrainingForDayOffset(-1, plan, cycleStartDate);
      const checkIns = getRecentCheckIns(5);
      const yesterdayCheckOut = checkIns.length > 0 ? checkIns[0] : null;

      const equipment = getEquipment();
      const assignments = getActivityAssignments();
      const equipmentAttention = buildEquipmentAttentionLine(equipment, garminData?.activities || [], assignments);
      const statsActivities = filterStatsActivities(garminData?.activities || [], equipment, assignments);
      const trainingLoad = garminData ? calculateTrainingLoad(statsActivities, garminData.health) : null;
      const readiness = garminData
        ? getTrainingReadiness(garminData.health, !!todayTraining && !todayTraining.isRestDay, statsActivities)
        : null;

      const res = await fetch('/api/daily-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          todayTraining,
          yesterdayTraining,
          yesterdayCheckOut,
          garminHealth: garminData?.health || null,
          garminActivities: statsActivities.slice(0, 3) || null,
          trainingLoad,
          readiness,
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
        setMessage(data.message);
        saveDailyMessage(data.message);
      }
    } catch {
      // Stil falen — de gebruiker kan handmatig vernieuwen
    } finally {
      setLoading(false);
    }
  }, []);

  const init = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      clearDailyMessage();
      setMessage(null);
    }
    setSyncError(null);
    const cached = getDailyMessage();
    if (cached) setMessage(cached.message);

    let garminData = getGarminData();
    // Sync als er credentials zijn én de dagelijkse sync nog moet, of er nog geen
    // dagbericht voor vandaag is (zelfde gedrag als de Home-tab).
    const needSync = !!getGarminCredentials() && (shouldAutoSync() || !cached || forceRefresh);
    if (needSync) {
      setSyncing(true);
      try {
        const fresh = await syncGarminData();
        if (fresh) garminData = fresh;
      } catch (e) {
        setSyncError(e instanceof Error ? e.message : 'Garmin-sync mislukt');
      } finally {
        setSyncing(false);
      }
    }

    if (!getDailyMessage()) await generate(garminData);
  }, [generate]);

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="px-5 pt-4 pb-8">
      <div className="bg-[#0d0d0f] rounded-3xl p-4 border border-white/5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <p className="text-gray-400 text-sm font-semibold uppercase tracking-wide">Coach van de dag</p>
          </div>
          <button
            onClick={() => init(true)}
            disabled={syncing || loading}
            className="p-1.5 text-gray-500 hover:text-gray-300 disabled:opacity-40 transition-colors"
            title="Vernieuwen"
          >
            <svg className={`w-4 h-4 ${syncing || loading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
          </button>
        </div>

        {syncing && (
          <p className="text-xs text-blue-400 mb-2">Garmin-data syncen...</p>
        )}

        {message ? (
          <p className="text-base text-gray-100 leading-relaxed">{message}</p>
        ) : loading || syncing ? (
          <div className="flex gap-1 py-2">
            <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
            <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0.1s]" />
            <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0.2s]" />
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Geen dagbericht beschikbaar. Tik op vernieuwen om het opnieuw te proberen.</p>
        )}

        {syncError && <p className="text-xs text-red-400 mt-2">{syncError}</p>}
      </div>
    </div>
  );
}
