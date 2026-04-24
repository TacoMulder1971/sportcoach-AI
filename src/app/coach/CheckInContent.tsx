'use client';

import { useEffect, useState } from 'react';
import CheckInForm from '@/components/CheckInForm';
import { getTodayTraining } from '@/lib/schedule';
import { getGarminData, getActivePlan, getCheckInsForDate, getRecentCheckIns, getNutritionForDate, saveNutritionFeedback, getActiveRaceDate, buildRaceContextText } from '@/lib/storage';
import { TrainingDay, GarminActivity, CheckIn, HEART_RATE_ZONES, FEELING_SCALE, NutritionLog } from '@/lib/types';
import SportIcon from '@/components/SportIcon';

function getHRZoneLabel(avgHR: number): string {
  for (const z of [...HEART_RATE_ZONES].reverse()) {
    if (avgHR >= z.min) return `${z.zone} (${z.label})`;
  }
  return 'Onder Z1';
}

export default function CheckInContent({ onComplete }: { onComplete: () => void }) {
  const [todayTraining, setTodayTraining] = useState<TrainingDay | null>(null);
  const [todayActivities, setTodayActivities] = useState<GarminActivity[]>([]);
  const [alreadyCheckedOut, setAlreadyCheckedOut] = useState(false);
  const [recentCheckIns, setRecentCheckIns] = useState<CheckIn[]>([]);
  const [nutritionLog, setNutritionLog] = useState<NutritionLog | null>(null);
  const [nutritionFeedback, setNutritionFeedback] = useState<string | null>(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  useEffect(() => {
    const { plan, cycleStartDate } = getActivePlan();
    setTodayTraining(getTodayTraining(plan, cycleStartDate));

    // Check of er al een check-out is voor vandaag
    const today = new Date().toISOString().split('T')[0];
    const todayCheckIns = getCheckInsForDate(today);
    setAlreadyCheckedOut(todayCheckIns.length > 0);

    // Laatste 3 check-outs voor historie
    setRecentCheckIns(getRecentCheckIns(3));

    // Match Garmin activities from today
    const garmin = getGarminData();
    if (garmin) {
      const matched = garmin.activities.filter((a) => a.date === today);
      setTodayActivities(matched);
    }

    // Voedingsdata van vandaag
    const nutrition = getNutritionForDate(today);
    if (nutrition) {
      setNutritionLog(nutrition);
      if (nutrition.aiFeedback) setNutritionFeedback(nutrition.aiFeedback);
    }
  }, []);

  return (
    <div className="px-4 pt-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Check-out</h1>
        <p className="text-gray-500 text-sm">Hoe ging je training?</p>
      </div>

      {alreadyCheckedOut ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
          </div>
          <p className="text-green-700 font-semibold">Al ingecheckt vandaag!</p>
          <p className="text-gray-500 text-sm mt-1">Je hebt je check-out voor vandaag al gedaan.</p>
        </div>
      ) : todayTraining && !todayTraining.isRestDay ? (
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
                  <SportIcon sport={s.sport} size="sm" />
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
                        <SportIcon sport={a.sport !== 'overig' ? a.sport : 'overig'} size="sm" />
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
            onComplete={onComplete}
          />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="flex justify-center mb-4">
            <SportIcon sport="rust" size="lg" />
          </div>
          <p className="text-gray-900 font-medium">Rustdag vandaag</p>
          <p className="text-gray-500 text-sm mt-1">
            Geniet van je herstel! Morgen weer aan de slag.
          </p>
        </div>
      )}

      {/* Recente check-outs */}
      {recentCheckIns.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Recente check-outs
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

      {/* Voeding van vandaag (MyFitnessPal) */}
      {nutritionLog && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Voeding vandaag</h2>
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-orange-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-orange-600">{nutritionLog.calories}</p>
                <p className="text-xs text-gray-500">kcal</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-blue-600">{nutritionLog.carbsG}g</p>
                <p className="text-xs text-gray-500">koolhydraten</p>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-600">{nutritionLog.proteinG}g</p>
                <p className="text-xs text-gray-500">eiwit</p>
              </div>
              <div className="bg-yellow-50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-yellow-600">{nutritionLog.fatG}g</p>
                <p className="text-xs text-gray-500">vet</p>
              </div>
            </div>

            {nutritionFeedback ? (
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-sm text-gray-700 leading-relaxed">{nutritionFeedback}</p>
              </div>
            ) : (
              <button
                onClick={async () => {
                  setLoadingFeedback(true);
                  try {
                    const garmin = getGarminData();
                    const res = await fetch('/api/nutrition-feedback', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        nutritionLog,
                        todayTraining,
                        garminHealth: garmin?.health || null,
                        daysUntilRace: Math.ceil((new Date(getActiveRaceDate()).getTime() - new Date().getTime()) / 86400000),
                        raceContext: buildRaceContextText(),
                      }),
                    });
                    const data = await res.json();
                    if (data.feedback) {
                      setNutritionFeedback(data.feedback);
                      saveNutritionFeedback(nutritionLog.date, data.feedback);
                    }
                  } catch { /* silently fail */ }
                  finally { setLoadingFeedback(false); }
                }}
                disabled={loadingFeedback}
                className="w-full py-3 rounded-xl font-semibold text-white bg-green-600 hover:bg-green-700 transition-all text-sm disabled:opacity-50"
              >
                {loadingFeedback ? 'Feedback ophalen...' : 'Coach-feedback op mijn voeding'}
              </button>
            )}
          </div>
        </section>
      )}

      <div className="h-4" />
    </div>
  );
}
