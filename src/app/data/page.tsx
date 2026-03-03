'use client';

import { useEffect, useState, useMemo } from 'react';
import { getGarminData } from '@/lib/storage';
import { calculateTrainingLoad, getTrainingReadiness } from '@/lib/training-load';
import { GarminSyncData, SPORT_ICONS, SPORT_COLORS, HEART_RATE_ZONES, TrainingReadiness } from '@/lib/types';

export default function DataPage() {
  const [garmin, setGarmin] = useState<GarminSyncData | null>(null);

  useEffect(() => {
    setGarmin(getGarminData());
  }, []);

  const trainingLoad = useMemo(() => {
    if (!garmin) return null;
    return calculateTrainingLoad(garmin.activities, garmin.health);
  }, [garmin]);

  const readiness: TrainingReadiness | null = useMemo(() => {
    if (!garmin) return null;
    return getTrainingReadiness(garmin.health, true);
  }, [garmin]);

  // Weekly totals
  const weekStats = useMemo(() => {
    if (!garmin) return null;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoff = sevenDaysAgo.toISOString().split('T')[0];
    const recent = garmin.activities.filter((a) => a.date >= cutoff);
    return {
      totalMinutes: recent.reduce((s, a) => s + a.durationMinutes, 0),
      totalKm: Math.round(recent.reduce((s, a) => s + a.distanceKm, 0) * 10) / 10,
      totalCalories: recent.reduce((s, a) => s + a.calories, 0),
      count: recent.length,
      avgHR: recent.length > 0 ? Math.round(recent.reduce((s, a) => s + a.avgHR, 0) / recent.length) : 0,
    };
  }, [garmin]);

  const lastSync = garmin?.syncedAt
    ? new Date(garmin.syncedAt).toLocaleString('nl-NL', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      })
    : null;

  if (!garmin) {
    return (
      <div className="px-4 pt-6">
        <h1 className="text-2xl font-bold text-gray-900">Data</h1>
        <p className="text-gray-500 text-sm mb-6">Garmin gegevens</p>
        <div className="bg-white rounded-xl p-8 border border-gray-200 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          </div>
          <p className="text-gray-500 text-sm">Sync eerst je Garmin op het dashboard</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Data</h1>
        <p className="text-gray-500 text-sm">Garmin gegevens {lastSync && `· ${lastSync}`}</p>
      </div>

      {/* Trainingsgereedheid detail */}
      {readiness && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Trainingsgereedheid</h2>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-12 h-12 rounded-full ${readiness.bgColor} flex items-center justify-center`}>
                <span className="text-white font-bold text-lg">{readiness.score}</span>
              </div>
              <div>
                <p className={`text-xl font-bold ${readiness.color}`}>{readiness.label}</p>
                <p className="text-xs text-gray-500">{readiness.score}/9 punten</p>
              </div>
            </div>
            <div className="space-y-3">
              {[
                { label: 'HRV', val: readiness.factors.hrv, detail: garmin?.health ? `${garmin.health.avgOvernightHrv}ms · ${garmin.health.hrvStatus}` : '' },
                { label: 'Slaap', val: readiness.factors.sleep, detail: garmin?.health ? `Score ${garmin.health.sleepScore} · ${garmin.health.sleepDurationHours}u` : '' },
                { label: 'Lichaam', val: readiness.factors.body, detail: garmin?.health ? `Battery ${garmin.health.bodyBatteryChange > 0 ? '+' : ''}${garmin.health.bodyBatteryChange} · Rust HR ${garmin.health.restingHR}` : '' },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-3">
                  <p className="text-xs text-gray-500 w-14">{f.label}</p>
                  <div className="flex gap-1 flex-1">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-3 flex-1 rounded ${
                          i <= f.val
                            ? f.val >= 3 ? 'bg-green-400' : f.val >= 2 ? 'bg-yellow-400' : 'bg-red-400'
                            : 'bg-gray-100'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 w-36 text-right">{f.detail}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-600 mt-3 pt-3 border-t border-gray-100">{readiness.advice}</p>
          </div>
        </section>
      )}

      {/* Week overzicht */}
      {weekStats && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Deze week</h2>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-2xl font-bold text-blue-600">
                  {Math.floor(weekStats.totalMinutes / 60)}u{weekStats.totalMinutes % 60}m
                </p>
                <p className="text-xs text-gray-500">Trainingsduur</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{weekStats.totalKm}</p>
                <p className="text-xs text-gray-500">Kilometer</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-500">{weekStats.count}</p>
                <p className="text-xs text-gray-500">Sessies</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center mt-3">
              <div>
                <p className="text-2xl font-bold text-red-500">{weekStats.avgHR || '–'}</p>
                <p className="text-xs text-gray-500">Gem. HR</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-500">{weekStats.totalCalories}</p>
                <p className="text-xs text-gray-500">Calorieen</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Training Load detail */}
      {trainingLoad && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Training Load</h2>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className={`text-3xl font-bold ${trainingLoad.statusColor}`}>{trainingLoad.weekLoad}</p>
                <p className={`text-sm font-semibold ${trainingLoad.statusColor}`}>
                  {trainingLoad.status.charAt(0).toUpperCase() + trainingLoad.status.slice(1)}
                </p>
              </div>
              <div className="text-right text-xs text-gray-400">
                <p>TRIMP (7 dagen)</p>
                <p>Max HR: 172 bpm</p>
              </div>
            </div>
            {/* Load zones */}
            <div className="relative bg-gray-100 rounded-full h-3 mb-2">
              <div className="absolute left-0 top-0 h-3 bg-blue-400 rounded-l-full" style={{ width: '25%' }} />
              <div className="absolute left-[25%] top-0 h-3 bg-green-500" style={{ width: '33%' }} />
              <div className="absolute left-[58%] top-0 h-3 bg-orange-500" style={{ width: '25%' }} />
              <div className="absolute left-[83%] top-0 h-3 bg-red-500 rounded-r-full" style={{ width: '17%' }} />
              {/* Indicator */}
              <div
                className="absolute top-[-4px] w-3 h-5 bg-gray-800 rounded-sm border-2 border-white"
                style={{ left: `${Math.min(97, (trainingLoad.weekLoad / 600) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>Laag</span>
              <span>Optimaal</span>
              <span>Hoog</span>
              <span>Over</span>
            </div>
            <p className="text-sm text-gray-600 mt-3">{trainingLoad.advice}</p>
          </div>
        </section>
      )}

      {/* Gezondheid */}
      {garmin.health && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Gezondheid</h2>
          <div className="bg-white rounded-xl p-4 border border-gray-200 space-y-4">
            {/* Slaap */}
            <div>
              <p className="text-xs text-gray-400 mb-2">Slaap</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xl font-bold text-purple-600">{garmin.health.sleepDurationHours}u</p>
                  <p className="text-xs text-gray-500">Duur</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-amber-500">{garmin.health.sleepScore || '–'}</p>
                  <p className="text-xs text-gray-500">Score</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-indigo-500">{garmin.health.deepSleepMinutes}m</p>
                  <p className="text-xs text-gray-500">Diep</p>
                </div>
              </div>
              {garmin.health.remSleepMinutes > 0 && (
                <div className="flex gap-1 mt-2">
                  <div className="h-2 rounded-full bg-indigo-500" style={{ flex: garmin.health.deepSleepMinutes }} />
                  <div className="h-2 rounded-full bg-blue-400" style={{ flex: garmin.health.remSleepMinutes }} />
                  <div className="h-2 rounded-full bg-gray-200" style={{ flex: Math.max(0, (garmin.health.sleepDurationHours * 60) - garmin.health.deepSleepMinutes - garmin.health.remSleepMinutes) }} />
                </div>
              )}
              <div className="flex gap-4 mt-1 text-[10px] text-gray-400">
                <span>Diep: {garmin.health.deepSleepMinutes}m</span>
                <span>REM: {garmin.health.remSleepMinutes}m</span>
              </div>
            </div>

            {/* Hartslag & HRV */}
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs text-gray-400 mb-2">Hart & Herstel</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xl font-bold text-red-500">{garmin.health.restingHR || '–'}</p>
                  <p className="text-xs text-gray-500">Rust HR</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-green-600">{garmin.health.avgOvernightHrv || '–'}</p>
                  <p className="text-xs text-gray-500">HRV</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-blue-500">
                    {garmin.health.bodyBatteryChange > 0 ? '+' : ''}{garmin.health.bodyBatteryChange || '–'}
                  </p>
                  <p className="text-xs text-gray-500">Battery</p>
                </div>
              </div>
              {garmin.health.hrvStatus && garmin.health.hrvStatus !== 'onbekend' && (
                <p className="text-xs text-gray-500 text-center mt-2">HRV status: {garmin.health.hrvStatus}</p>
              )}
            </div>

            {/* Stappen */}
            <div className="border-t border-gray-100 pt-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">Stappen</p>
                <p className="text-lg font-bold text-gray-700">{garmin.health.steps?.toLocaleString('nl-NL') || '–'}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Hartslagzones referentie */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Hartslagzones</h2>
        <div className="bg-white rounded-xl p-4 border border-gray-200 space-y-2">
          {HEART_RATE_ZONES.map((z) => (
            <div key={z.zone} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: z.color }}>
                {z.zone}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{z.label}</p>
              </div>
              <p className="text-sm text-gray-500">{z.min}–{z.max} bpm</p>
            </div>
          ))}
        </div>
      </section>

      {/* Alle activiteiten */}
      {garmin.activities.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Activiteiten</h2>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {garmin.activities.map((a) => (
              <div key={a.id} className="p-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${a.sport !== 'overig' ? SPORT_COLORS[a.sport] : 'bg-gray-500'}`}>
                  {a.sport !== 'overig' ? SPORT_ICONS[a.sport] : '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.activityName}</p>
                  <p className="text-xs text-gray-500">
                    {a.durationMinutes}min
                    {a.distanceKm > 0 && ` · ${a.distanceKm}km`}
                    {a.avgHR > 0 && ` · HR ${a.avgHR}/${a.maxHR}`}
                    {a.calories > 0 && ` · ${a.calories}kcal`}
                  </p>
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0">{a.date}</span>
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
