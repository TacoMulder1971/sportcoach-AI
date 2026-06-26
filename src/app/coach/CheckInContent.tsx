'use client';

import { useEffect, useState } from 'react';
import CheckInForm from '@/components/CheckInForm';
import { getTodayTraining } from '@/lib/schedule';
import { getGarminData, syncGarminData, getActivePlan, getCheckInsForDate, getRecentCheckIns, getNutritionForDate, saveNutritionFeedback, getActiveRaceDate, buildRaceContextText } from '@/lib/storage';
import { TrainingDay, GarminActivity, CheckIn, HEART_RATE_ZONES, FEELING_SCALE, NutritionLog } from '@/lib/types';
import SportIcon from '@/components/SportIcon';

function getHRZoneLabel(avgHR: number): string {
  for (const z of [...HEART_RATE_ZONES].reverse()) {
    if (avgHR >= z.min) return `${z.zone} (${z.label})`;
  }
  return 'Onder Z1';
}

/** Garmin-activiteiten van vandaag als compacte kaartjes (Duur/Afstand/HR). */
function TodayActivities({ activities }: { activities: GarminActivity[] }) {
  if (activities.length === 0) return null;
  return (
    <div className="space-y-2">
      {activities.map((a) => (
        <div key={a.id} className="bg-white/[0.03] border border-white/5 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <SportIcon sport={a.sport !== 'overig' ? a.sport : 'overig'} size="sm" />
            <p className="text-sm font-medium text-gray-100">{a.activityName}</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-sm font-bold text-gray-100">{a.durationMinutes}m</p>
              <p className="text-[10px] text-gray-500">Duur</p>
            </div>
            <div>
              <p className="text-sm font-bold text-gray-100">{a.distanceKm > 0 ? `${a.distanceKm}km` : '–'}</p>
              <p className="text-[10px] text-gray-500">Afstand</p>
            </div>
            <div>
              <p className="text-sm font-bold text-red-400">{a.avgHR || '–'}</p>
              <p className="text-[10px] text-gray-500">{a.avgHR > 0 ? getHRZoneLabel(a.avgHR) : 'Gem HR'}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CheckInContent({ onComplete }: { onComplete: () => void }) {
  const [todayTraining, setTodayTraining] = useState<TrainingDay | null>(null);
  const [todayActivities, setTodayActivities] = useState<GarminActivity[]>([]);
  const [existingCheckIn, setExistingCheckIn] = useState<CheckIn | null>(null);
  const [recentCheckIns, setRecentCheckIns] = useState<CheckIn[]>([]);
  const [nutritionLog, setNutritionLog] = useState<NutritionLog | null>(null);
  const [nutritionFeedback, setNutritionFeedback] = useState<string | null>(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [syncing, setSyncing] = useState(true);

  const alreadyCheckedOut = existingCheckIn !== null;

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const { plan, cycleStartDate } = getActivePlan();
    setTodayTraining(getTodayTraining(plan, cycleStartDate));

    // Bestaande check-out van vandaag (voor resume-gesprek)
    const todayCheckIns = getCheckInsForDate(today);
    setExistingCheckIn(todayCheckIns[0] || null);

    // Laatste 3 check-outs voor historie
    setRecentCheckIns(getRecentCheckIns(3));

    // Voedingsdata van vandaag
    const nutrition = getNutritionForDate(today);
    if (nutrition) {
      setNutritionLog(nutrition);
      if (nutrition.aiFeedback) setNutritionFeedback(nutrition.aiFeedback);
    }

    // Eerst de gecachte activiteiten tonen, daarna verversen via Garmin-sync
    // zodat de coach (en de "Gedaan"-kolom) de trainingen van vandaag ziet.
    const cached = getGarminData();
    if (cached) setTodayActivities(cached.activities.filter((a) => a.date === today));

    let cancelled = false;
    (async () => {
      try {
        const fresh = await syncGarminData();
        if (!cancelled && fresh) {
          setTodayActivities(fresh.activities.filter((a) => a.date === today));
        }
      } catch {
        // Sync mag falen (offline / Garmin down) — we tonen de cache
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="px-5 pt-2 pb-8 space-y-6">
      {syncing && (
        <div className="flex items-center gap-2 text-sm text-gray-400 bg-white/[0.03] border border-white/5 rounded-xl px-3 py-2">
          <span className="flex gap-1">
            <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" />
            <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.1s]" />
            <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.2s]" />
          </span>
          Garmin synchroniseren — activiteiten van vandaag ophalen…
        </div>
      )}

      {alreadyCheckedOut && existingCheckIn ? (
        <div className="bg-[#0d0d0f] rounded-3xl border border-white/5 p-4">
          {/* Garmin activiteiten van vandaag (vers na sync) */}
          {todayActivities.length > 0 && (
            <div className="mb-4 pb-4 border-b border-white/5">
              <p className="text-xs text-gray-500 mb-2">Garmin activiteiten vandaag</p>
              <TodayActivities activities={todayActivities} />
            </div>
          )}

          <CheckInForm
            sessions={existingCheckIn.sessions || []}
            dayLabel={existingCheckIn.trainingDay}
            garminActivities={todayActivities}
            onComplete={onComplete}
            resumeCheckIn={existingCheckIn}
          />
        </div>
      ) : todayTraining && !todayTraining.isRestDay ? (
        <div className="bg-[#0d0d0f] rounded-3xl border border-white/5 p-4">
          {/* Gepland vs Gedaan */}
          <div className="mb-4 pb-4 border-b border-white/5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-300">Gepland</p>
              {todayActivities.length > 0 && (
                <p className="text-sm font-medium text-gray-300">Gedaan</p>
              )}
            </div>

            {/* Geplande sessies */}
            <div className="space-y-2">
              {todayTraining.sessions.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <SportIcon sport={s.sport} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 truncate">{s.type} · {s.durationMinutes}min · {s.zone}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Garmin activiteiten van vandaag */}
            {todayActivities.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/5">
                <p className="text-xs text-gray-500 mb-2">Garmin activiteiten vandaag</p>
                <TodayActivities activities={todayActivities} />
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
      ) : todayActivities.length > 0 ? (
        // Rustdag, maar er is toch getraind — bied alsnog een check-out + gesprek aan
        <div className="bg-[#0d0d0f] rounded-3xl border border-white/5 p-4">
          <div className="mb-4 pb-4 border-b border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <SportIcon sport="rust" size="sm" />
              <p className="text-sm font-medium text-gray-300">Rustdag — maar je hebt toch getraind</p>
            </div>
            <TodayActivities activities={todayActivities} />
          </div>

          <CheckInForm
            sessions={[]}
            dayLabel={todayTraining?.day || 'Rustdag'}
            garminActivities={todayActivities}
            onComplete={onComplete}
          />
        </div>
      ) : (
        <div className="bg-[#0d0d0f] rounded-3xl border border-white/5 p-8 text-center">
          <div className="flex justify-center mb-4">
            <SportIcon sport="rust" size="lg" />
          </div>
          <p className="text-gray-100 font-medium">Rustdag vandaag</p>
          <p className="text-gray-400 text-sm mt-1">
            Geniet van je herstel! Morgen weer aan de slag.
          </p>
        </div>
      )}

      {/* Recente check-outs */}
      {recentCheckIns.length > 0 && (
        <section>
          <p className="text-gray-400 text-sm font-semibold uppercase tracking-wide mb-2 px-1">
            Recente check-outs
          </p>
          <div className="space-y-2">
            {recentCheckIns.map((ci) => (
              <div
                key={ci.id}
                className="bg-[#0d0d0f] rounded-2xl border border-white/5 overflow-hidden"
              >
                <div className="p-3 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full ${FEELING_SCALE[ci.feeling]?.color} ${FEELING_SCALE[ci.feeling]?.textColor} flex items-center justify-center font-bold text-base flex-shrink-0`}>
                    {ci.feeling}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-medium text-gray-100 truncate">
                      {ci.trainingDay}
                    </p>
                    {ci.note && (
                      <p className="text-sm text-gray-400 truncate">{ci.note}</p>
                    )}
                  </div>
                  <span className="text-sm text-gray-500">{ci.date}</span>
                </div>
                {(() => {
                  const lastMsg = ci.messages?.filter(m => m.role === 'assistant').slice(-1)[0];
                  const displayText = lastMsg?.content || ci.feedback;
                  if (!displayText) return null;
                  return (
                    <div className="px-3 pb-3 pt-0">
                      <div className="bg-blue-500/10 rounded-lg p-2.5 flex items-start gap-2">
                        <svg className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        <p className="text-sm text-gray-300 leading-relaxed">{displayText}</p>
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
          <p className="text-gray-400 text-sm font-semibold uppercase tracking-wide mb-2 px-1">Voeding vandaag</p>
          <div className="bg-[#0d0d0f] rounded-3xl border border-white/5 p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-orange-500/10 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-orange-400">{nutritionLog.calories}</p>
                <p className="text-xs text-gray-400">kcal</p>
              </div>
              <div className="bg-blue-500/10 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-blue-400">{nutritionLog.carbsG}g</p>
                <p className="text-xs text-gray-400">koolhydraten</p>
              </div>
              <div className="bg-green-500/10 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-green-400">{nutritionLog.proteinG}g</p>
                <p className="text-xs text-gray-400">eiwit</p>
              </div>
              <div className="bg-yellow-500/10 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-yellow-400">{nutritionLog.fatG}g</p>
                <p className="text-xs text-gray-400">vet</p>
              </div>
            </div>

            {nutritionFeedback ? (
              <div className="bg-blue-500/10 rounded-xl p-3">
                <p className="text-sm text-gray-300 leading-relaxed">{nutritionFeedback}</p>
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
