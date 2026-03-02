'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CheckInForm from '@/components/CheckInForm';
import { getTodayTraining } from '@/lib/schedule';
import { TrainingDay, SPORT_ICONS } from '@/lib/types';

export default function CheckInPage() {
  const router = useRouter();
  const [todayTraining, setTodayTraining] = useState<TrainingDay | null>(null);

  useEffect(() => {
    setTodayTraining(getTodayTraining());
  }, []);

  return (
    <div className="px-4 pt-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Check-in</h1>
        <p className="text-gray-500 text-sm">Hoe ging je training?</p>
      </div>

      {todayTraining && !todayTraining.isRestDay ? (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          {/* Training summary */}
          <div className="mb-4 pb-4 border-b border-gray-100">
            <p className="text-sm text-gray-500 mb-2">Training van vandaag</p>
            <div className="flex flex-wrap gap-2">
              {todayTraining.sessions.map((s, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 text-sm bg-gray-50 px-3 py-1 rounded-full"
                >
                  {SPORT_ICONS[s.sport]} {s.type}
                </span>
              ))}
            </div>
          </div>

          <CheckInForm
            sessions={todayTraining.sessions}
            dayLabel={todayTraining.day}
            onComplete={() => router.push('/')}
          />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="text-4xl mb-4">😴</div>
          <p className="text-gray-900 font-medium">Rustdag vandaag</p>
          <p className="text-gray-500 text-sm mt-1">
            Geniet van je herstel! Morgen weer aan de slag.
          </p>
        </div>
      )}

      <div className="h-4" />
    </div>
  );
}
