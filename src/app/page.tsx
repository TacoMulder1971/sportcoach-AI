'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Countdown from '@/components/Countdown';
import TrainingCard from '@/components/TrainingCard';
import { getTodayTraining } from '@/lib/schedule';
import { getRecentCheckIns } from '@/lib/storage';
import { TrainingDay, CheckIn, FEELING_EMOJIS } from '@/lib/types';

export default function Dashboard() {
  const [todayTraining, setTodayTraining] = useState<TrainingDay | null>(null);
  const [recentCheckIns, setRecentCheckIns] = useState<CheckIn[]>([]);

  useEffect(() => {
    setTodayTraining(getTodayTraining());
    setRecentCheckIns(getRecentCheckIns(3));
  }, []);

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
