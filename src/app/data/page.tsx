'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { getGarminData, saveGarminData, downloadExport, importAllData, markBackupDone, markAutoSyncDone } from '@/lib/storage';
import { calculateTrainingLoad, getTrainingReadiness } from '@/lib/training-load';
import { GarminSyncData, HEART_RATE_ZONES, TrainingReadiness } from '@/lib/types';
import SportIcon from '@/components/SportIcon';

export default function DataPage() {
  const [garmin, setGarmin] = useState<GarminSyncData | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setGarmin(getGarminData());
  }, []);

  async function handleGarminSync() {
    setSyncing(true);
    setSyncError(null);
    try {
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

  const trainingLoad = useMemo(() => {
    if (!garmin) return null;
    return calculateTrainingLoad(garmin.activities, garmin.health);
  }, [garmin]);

  const readiness: TrainingReadiness | null = useMemo(() => {
    if (!garmin) return null;
    return getTrainingReadiness(garmin.health, true, garmin.activities);
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
      <div className="px-4 pt-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Data</h1>
            <p className="text-gray-500 text-sm">Garmin gegevens</p>
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

        <div className="bg-white rounded-xl p-8 border border-gray-200 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          </div>
          <p className="text-gray-500 text-sm">Klik op Sync om je Garmin data op te halen</p>
        </div>

        {/* Data beheer — ook zonder Garmin beschikbaar */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Data beheer</h2>
          <div className="bg-white rounded-xl p-4 border border-gray-200 space-y-3">
            <p className="text-sm text-gray-500">
              Exporteer je data als backup of importeer een eerder gemaakte backup.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  downloadExport();
                  markBackupDone();
                  setImportStatus({ type: 'success', msg: 'Backup gedownload!' });
                  setTimeout(() => setImportStatus(null), 3000);
                }}
                className="flex-1 py-3 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-all text-sm"
              >
                Exporteer data
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-3 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all text-sm"
              >
                Importeer data
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (!confirm('Dit overschrijft alle huidige data. Doorgaan?')) {
                  e.target.value = '';
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => {
                  const result = importAllData(reader.result as string);
                  if (result.success) {
                    setImportStatus({ type: 'success', msg: 'Data succesvol geimporteerd! Pagina herlaadt...' });
                    setTimeout(() => window.location.reload(), 1500);
                  } else {
                    setImportStatus({ type: 'error', msg: result.error || 'Import mislukt' });
                  }
                };
                reader.readAsText(file);
                e.target.value = '';
              }}
            />
            {importStatus && (
              <div className={`text-sm p-3 rounded-xl ${
                importStatus.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
              }`}>
                {importStatus.msg}
              </div>
            )}
          </div>
        </section>

        <div className="h-4" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data</h1>
          <p className="text-gray-500 text-sm">Garmin gegevens {lastSync && `· ${lastSync}`}</p>
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
                { label: readiness.factors.label1, val: readiness.factors.score1, max: readiness.factors.max1, detail: readiness.mode === 'full' ? `${garmin?.health?.avgOvernightHrv || 0}ms · ${garmin?.health?.hrvStatus || ''}` : `${garmin?.health?.restingHR || ''} bpm` },
                { label: readiness.factors.label2, val: readiness.factors.score2, max: readiness.factors.max2, detail: readiness.mode === 'full' ? `Score ${garmin?.health?.sleepScore || 0} · ${garmin?.health?.sleepDurationHours || 0}u` : 'TRIMP laatste 48u' },
                { label: readiness.factors.label3, val: readiness.factors.score3, max: readiness.factors.max3, detail: readiness.mode === 'full' ? 'TRIMP laatste 48u' : garmin?.health ? `Battery ${garmin.health.bodyBatteryChange > 0 ? '+' : ''}${garmin.health.bodyBatteryChange} · Rust HR ${garmin.health.restingHR}` : '' },
              ].map((f) => (
                <div key={f.label} className="flex items-center gap-3">
                  <p className="text-xs text-gray-500 w-14">{f.label}</p>
                  <div className="flex gap-1 flex-1">
                    {Array.from({ length: f.max }, (_, i) => i + 1).map((i) => (
                      <div
                        key={i}
                        className={`h-3 flex-1 rounded ${
                          i <= f.val
                            ? f.val >= f.max * 0.6 ? 'bg-green-400' : f.val >= f.max * 0.3 ? 'bg-yellow-400' : 'bg-red-400'
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
                <SportIcon sport={a.sport !== 'overig' ? a.sport : 'overig'} size="md" />
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

      {/* Data beheer */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Data beheer</h2>
        <div className="bg-white rounded-xl p-4 border border-gray-200 space-y-3">
          <p className="text-sm text-gray-500">
            Exporteer je data als backup of importeer een eerder gemaakte backup.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                downloadExport();
                markBackupDone();
                setImportStatus({ type: 'success', msg: 'Backup gedownload!' });
                setTimeout(() => setImportStatus(null), 3000);
              }}
              className="flex-1 py-3 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-all text-sm"
            >
              Exporteer data
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-3 rounded-xl font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-all text-sm"
            >
              Importeer data
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (!confirm('Dit overschrijft alle huidige data. Doorgaan?')) {
                e.target.value = '';
                return;
              }
              const reader = new FileReader();
              reader.onload = () => {
                const result = importAllData(reader.result as string);
                if (result.success) {
                  setImportStatus({ type: 'success', msg: 'Data succesvol geimporteerd! Pagina herlaadt...' });
                  setTimeout(() => window.location.reload(), 1500);
                } else {
                  setImportStatus({ type: 'error', msg: result.error || 'Import mislukt' });
                }
              };
              reader.readAsText(file);
              e.target.value = '';
            }}
          />
          {importStatus && (
            <div className={`text-sm p-3 rounded-xl ${
              importStatus.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
            }`}>
              {importStatus.msg}
            </div>
          )}
        </div>
      </section>

      {/* Bottom spacer for nav */}
      <div className="h-4" />
    </div>
  );
}
