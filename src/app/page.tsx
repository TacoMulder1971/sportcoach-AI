'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Countdown from '@/components/Countdown';
import TrainingCard from '@/components/TrainingCard';
import { getTodayTraining } from '@/lib/schedule';
import { getRecentCheckIns, getGarminData, saveGarminData } from '@/lib/storage';
import { TrainingDay, CheckIn, FEELING_EMOJIS, GarminSyncData, SPORT_ICONS } from '@/lib/types';

export default function Dashboard() {
  const [todayTraining, setTodayTraining] = useState<TrainingDay | null>(null);
  const [recentCheckIns, setRecentCheckIns] = useState<CheckIn[]>([]);
  const [garmin, setGarmin] = useState<GarminSyncData | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    setTodayTraining(getTodayTraining());
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

  const lastSync = garmin?.syncedAt
    ? new Date(garmin.syncedAt).toLocaleString('nl-NL', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      })
    : null;

  return (
    <div className="px-4 pt-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">TriCoach AI</h1>
        <p className="text-gray-500 text-sm">Jouw persoonlijke trainingscoach</p>
      </div>

      {/* Countdown */}
      <Countdown />

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

      {/* Garmin Data */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Garmin</h2>
          <button
            onClick={handleGarminSync}
            disabled={syncing}
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            {syncing ? 'Syncing...' : 'Sync'}
          </button>
        </div>

        {syncError && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl mb-3">
            {syncError}
          </div>
        )}

        {garmin ? (
          <div className="space-y-3">
            {/* Health stats */}
            {garmin.health && (
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <p className="text-xs text-gray-400 mb-2">
                  Gezondheid vandaag {lastSync && `· ${lastSync}`}
                </p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-2xl font-bold text-purple-600">
                      {garmin.health.sleepDurationHours}u
                    </p>
                    <p className="text-xs text-gray-500">Slaap</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      {garmin.health.avgOvernightHrv || '–'}
                    </p>
                    <p className="text-xs text-gray-500">HRV</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-500">
                      {garmin.health.restingHR || '–'}
                    </p>
                    <p className="text-xs text-gray-500">Rust HR</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center mt-3">
                  <div>
                    <p className="text-2xl font-bold text-amber-500">
                      {garmin.health.sleepScore || '–'}
                    </p>
                    <p className="text-xs text-gray-500">Slaapscore</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-500">
                      {garmin.health.bodyBatteryChange > 0 ? '+' : ''}
                      {garmin.health.bodyBatteryChange || '–'}
                    </p>
                    <p className="text-xs text-gray-500">Body Battery</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-600">
                      {garmin.health.steps ? (garmin.health.steps / 1000).toFixed(1) + 'k' : '–'}
                    </p>
                    <p className="text-xs text-gray-500">Stappen</p>
                  </div>
                </div>
              </div>
            )}

            {/* Recent activities */}
            {garmin.activities.length > 0 && (
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <p className="text-xs text-gray-400 mb-2">Laatste activiteiten</p>
                <div className="space-y-2">
                  {garmin.activities.slice(0, 5).map((a) => (
                    <div key={a.id} className="flex items-center gap-3">
                      <span className="text-xl">
                        {a.sport !== 'overig' ? SPORT_ICONS[a.sport] : '🏋️'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{a.activityName}</p>
                        <p className="text-xs text-gray-500">
                          {a.durationMinutes}min
                          {a.distanceKm > 0 && ` · ${a.distanceKm}km`}
                          {a.avgHR > 0 && ` · ${a.avgHR}bpm`}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400">{a.date}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl p-6 border border-gray-200 text-center">
            <p className="text-gray-400 text-sm">
              Klik &quot;Sync&quot; om je Garmin data op te halen
            </p>
          </div>
        )}
      </section>

      {/* Snelle acties */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Snel naar</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/checkin"
            className="bg-white rounded-xl p-4 border border-gray-200 hover:border-blue-300 transition-colors"
          >
            <span className="text-2xl">✅</span>
            <p className="text-sm font-medium mt-2">Check-in</p>
            <p className="text-xs text-gray-500">Hoe ging het?</p>
          </Link>
          <Link
            href="/coach"
            className="bg-white rounded-xl p-4 border border-gray-200 hover:border-blue-300 transition-colors"
          >
            <span className="text-2xl">🤖</span>
            <p className="text-sm font-medium mt-2">AI Coach</p>
            <p className="text-xs text-gray-500">Vraag advies</p>
          </Link>
          <Link
            href="/schema"
            className="bg-white rounded-xl p-4 border border-gray-200 hover:border-blue-300 transition-colors"
          >
            <span className="text-2xl">📅</span>
            <p className="text-sm font-medium mt-2">Schema</p>
            <p className="text-xs text-gray-500">Bekijk planning</p>
          </Link>
          <Link
            href="/schema"
            className="bg-white rounded-xl p-4 border border-gray-200 hover:border-blue-300 transition-colors"
          >
            <span className="text-2xl">❤️</span>
            <p className="text-sm font-medium mt-2">Hartslagzones</p>
            <p className="text-xs text-gray-500">Z1-Z4 overzicht</p>
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
                className="bg-white rounded-xl p-3 border border-gray-200 flex items-center gap-3"
              >
                <span className="text-2xl">
                  {FEELING_EMOJIS[ci.feeling]?.emoji}
                </span>
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
            ))}
          </div>
        </section>
      )}

      {/* Bottom spacer for nav */}
      <div className="h-4" />
    </div>
  );
}
