'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CheckInForm from '@/components/CheckInForm';
import { getTodayTraining } from '@/lib/schedule';
import { getGarminData } from '@/lib/storage';
import { TrainingDay, GarminActivity, SPORT_ICONS, SPORT_COLORS, HEART_RATE_ZONES } from '@/lib/types';

function getHRZoneLabel(avgHR: number): string {
  for (const z of [...HEART_RATE_ZONES].reverse()) {
    if (avgHR >= z.min) return `${z.zone} (${z.label})`;
  }
  return 'Onder Z1';
}

export default function CheckInPage() {
  const router = useRouter();
  const [todayTraining, setTodayTraining] = useState<TrainingDay | null>(null);
  const [todayActivities, setTodayActivities] = useState<GarminActivity[]>([]);

  useEffect(() => {
    setTodayTraining(getTodayTraining());

    // Match Garmin activities from today
    const garmin = getGarminData();
    if (garmin) {
      const today = new Date().toISOString().split('T')[0];
      const matched = garmin.activities.filter((a) => a.date === today);
      setTodayActivities(matched);
    }
  }, []);

  return (
    <div className="px-4 pt-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Check-in</h1>
        <p className="text-gray-500 text-sm">Hoe ging je training?</p>
      </div>

      {todayTraining && !todayTraining.isRestDay ? (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          {/* Gepland vs Gedaan */}
          <div className="mb-4 pb-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">Gepland</p>
              {todayActivities.length > 0 && (
                <p className="text-sm font-medium text-gray-700">Gedaan</p>
              )}
            </div>

            {/* Geplande sessies */}
            <div className="space-y-2">
              {todayTraining.sessions.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded flex items-center justify-center text-xs font-bold text-white ${SPORT_COLORS[s.sport]}`}>
                    {SPORT_ICONS[s.sport]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-600 truncate">{s.type} · {s.durationMinutes}min · {s.zone}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Garmin activiteiten van vandaag */}
            {todayActivities.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-50">
                <p className="text-xs text-gray-400 mb-2">Garmin activiteiten vandaag</p>
                <div className="space-y-2">
                  {todayActivities.map((a) => (
                    <div key={a.id} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold text-white ${a.sport !== 'overig' ? SPORT_COLORS[a.sport] : 'bg-gray-500'}`}>
                          {a.sport !== 'overig' ? SPORT_ICONS[a.sport] : '?'}
                        </div>
                        <p className="text-sm font-medium">{a.activityName}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div>
                          <p className="text-sm font-bold text-gray-800">{a.durationMinutes}m</p>
                          <p className="text-[10px] text-gray-400">Duur</p>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-800">
                            {a.distanceKm > 0 ? `${a.distanceKm}km` : '–'}
                          </p>
                          <p className="text-[10px] text-gray-400">Afstand</p>
                        </div>
                        <div>
                          <p className="text-sm font-bold text-red-500">{a.avgHR || '–'}</p>
                          <p className="text-[10px] text-gray-400">
                            {a.avgHR > 0 ? getHRZoneLabel(a.avgHR) : 'Gem HR'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <CheckInForm
            sessions={todayTraining.sessions}
            dayLabel={todayTraining.day}
            garminActivities={todayActivities}
            onComplete={() => router.push('/')}
          />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-sm font-bold text-gray-400">R</span>
          </div>
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
