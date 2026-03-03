'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Countdown from '@/components/Countdown';
import TrainingCard from '@/components/TrainingCard';
import { getTodayTraining } from '@/lib/schedule';
import { getRecentCheckIns, getGarminData, saveGarminData } from '@/lib/storage';
import { calculateTrainingLoad, getTrainingReadiness } from '@/lib/training-load';
import { TrainingDay, CheckIn, FEELING_SCALE, GarminSyncData, TrainingLoadData, TrainingReadiness } from '@/lib/types';

export default function Dashboard() {
  const [todayTraining, setTodayTraining] = useState<TrainingDay | null>(null);
  const [recentCheckIns, setRecentCheckIns] = useState<CheckIn[]>([]);
  const [garmin, setGarmin] = useState<GarminSyncData | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    const training = getTodayTraining();
    setTodayTraining(training);
    setRecentCheckIns(getRecentCheckIns(3));
    setGarmin(getGarminData());
  }, []);

  async function handleGarminSync() {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch('/api/garmin/sync', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync mislukt');
      saveGarminData(data);
      setGarmin(data);
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
    return getTrainingReadiness(garmin.health, !!todayTraining && !todayTraining.isRestDay);
  }, [garmin, todayTraining]);

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">TriCoach AI</h1>
          <p className="text-gray-500 text-sm">Jouw persoonlijke trainingscoach</p>
        </div>
        <button
          onClick={handleGarminSync}
          disabled={syncing}
          className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
        >
          {syncing ? 'Syncing...' : 'Sync'}
        </button>
      </div>

      {syncError && (
        <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl">
          {syncError}
        </div>
      )}

      {/* Countdown */}
      <Countdown />

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
                  { label: 'HRV', val: readiness.factors.hrv },
                  { label: 'Slaap', val: readiness.factors.sleep },
                  { label: 'Lichaam', val: readiness.factors.body },
                ].map((f) => (
                  <div key={f.label} className="flex-1 text-center">
                    <div className="flex gap-px justify-center mb-0.5">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={`w-2 h-2 rounded-sm ${
                            i <= f.val
                              ? f.val >= 3 ? 'bg-green-400' : f.val >= 2 ? 'bg-yellow-400' : 'bg-red-400'
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

      {/* Coach advies strip */}
      {(trainingLoad || readiness) && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-600 mb-1">Coach advies</p>
              <p className="text-sm text-gray-700">
                {readiness?.advice || trainingLoad?.advice || ''}
              </p>
              {trainingLoad && readiness && trainingLoad.advice !== readiness.advice && (
                <p className="text-sm text-gray-600 mt-1">{trainingLoad.advice}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Training van vandaag */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Training vandaag
        </h2>
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
            <p className="text-xs font-medium">Check-in</p>
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

      {/* Recente check-ins */}
      {recentCheckIns.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Recente check-ins
          </h2>
          <div className="space-y-2">
            {recentCheckIns.map((ci) => (
              <div
                key={ci.id}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                <div className="p-3 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full ${FEELING_SCALE[ci.feeling]?.color} ${FEELING_SCALE[ci.feeling]?.textColor} flex items-center justify-center font-bold text-sm flex-shrink-0`}>
                    {ci.feeling}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {ci.trainingDay}
                    </p>
                    {ci.note && (
                      <p className="text-xs text-gray-500 truncate">{ci.note}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{ci.date}</span>
                </div>
                {ci.feedback && (
                  <div className="px-3 pb-3 pt-0">
                    <div className="bg-blue-50 rounded-lg p-2.5 flex items-start gap-2">
                      <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                      <p className="text-xs text-gray-600 leading-relaxed">{ci.feedback}</p>
                    </div>
                  </div>
                )}
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
