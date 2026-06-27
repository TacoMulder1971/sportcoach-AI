'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { getGarminData, saveGarminData, downloadExport, importAllData, markBackupDone, markAutoSyncDone, getEquipment, getActivityAssignments, getSwimVariants, mergeActivitiesIntoArchive, mergeHealthIntoArchive, deleteActivity, getGarminCredentials, getActivityArchive, getHealthArchive, getProfile, saveProfile, getRunZones, getCyclingZones } from '@/lib/storage';
import { calculateTrainingLoad, getTrainingReadiness, getDailyTRIMPHistory } from '@/lib/training-load';
import { GarminSyncData, TrainingReadiness, Equipment, ActivityAssignments, ActivitySwimVariants } from '@/lib/types';
import SportIcon from '@/components/SportIcon';
import TrainingLoadChart from '@/components/TrainingLoadChart';
import BuildupBarChart from '@/components/BuildupBarChart';
import MaterialSection from '@/components/MaterialSection';
import EquipmentAssignChip from '@/components/EquipmentAssignChip';
import EquipmentIcon from '@/components/EquipmentIcon';
import SwimVariantIcon from '@/components/SwimVariantIcon';
import SwimVariantChip from '@/components/SwimVariantChip';
import { filterStatsActivities, equipmentForActivity } from '@/lib/equipment';
import { swimVariantForActivity } from '@/lib/swim';
import GarminSetupCard from '@/components/GarminSetupCard';
import WeeklyVolumeChart, { WeeklyVolumeData } from '@/components/WeeklyVolumeChart';

export default function DataPage() {
  const [garmin, setGarmin] = useState<GarminSyncData | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [pulling, setPulling] = useState(false);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [assignments, setAssignments] = useState<ActivityAssignments>({});
  const [swimVariants, setSwimVariants] = useState<ActivitySwimVariants>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const touchStartY = useRef(0);
  const PULL_THRESHOLD = 65;

  // Zone-editor state: [z1min, z2min, z3min, z4min, z5min, maxHR] per sport
  const [zonesRun, setZonesRun] = useState<string[]>(['', '', '', '', '', '']);
  const [zonesBike, setZonesBike] = useState<string[]>(['', '', '', '', '', '']);
  const [zonesSaved, setZonesSaved] = useState(false);

  const refreshEquipment = useCallback(() => {
    setEquipment(getEquipment());
    setAssignments(getActivityAssignments());
    setSwimVariants(getSwimVariants());
  }, []);

  useEffect(() => {
    setGarmin(getGarminData());
    refreshEquipment();
    const runZ = getRunZones();
    const bikeZ = getCyclingZones();
    setZonesRun([String(runZ[0].min), String(runZ[1].min), String(runZ[2].min), String(runZ[3].min), String(runZ[4].min), String(runZ[4].max)]);
    setZonesBike([String(bikeZ[0].min), String(bikeZ[1].min), String(bikeZ[2].min), String(bikeZ[3].min), String(bikeZ[4].min), String(bikeZ[4].max)]);
  }, [refreshEquipment]);

  function saveZones() {
    const toInt = (v: string) => parseInt(v);
    const rn = zonesRun.map(toInt);
    const bk = zonesBike.map(toInt);
    if (rn.some(isNaN) || bk.some(isNaN)) return;
    const p = getProfile();
    saveProfile({
      ...p,
      maxHR: rn[5],
      maxHRCycling: bk[5],
      hrZonesRun: { z1min: rn[0], z2min: rn[1], z3min: rn[2], z4min: rn[3], z5min: rn[4], maxHR: rn[5] },
      hrZonesCycling: { z1min: bk[0], z2min: bk[1], z3min: bk[2], z4min: bk[3], z5min: bk[4], maxHR: bk[5] },
    });
    setZonesSaved(true);
    setTimeout(() => setZonesSaved(false), 2000);
  }

  async function handleGarminSync() {
    setSyncing(true);
    setSyncError(null);
    try {
      const existingData = getGarminData();
      const existingActivityIds = existingData?.activities?.map(a => a.id) || [];
      const creds = getGarminCredentials();

      const res = await fetch('/api/garmin/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ existingActivityIds, email: creds?.email, password: creds?.password }),
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

      // Eerst alles in het archief, daarna de live-weergave compact houden.
      mergeActivitiesIntoArchive(data.activities);
      mergeHealthIntoArchive(data.health);
      data.activities = data.activities.slice(0, 40);
      saveGarminData(data);
      setGarmin(data);
      markAutoSyncDone();
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : 'Sync mislukt');
    } finally {
      setSyncing(false);
    }
  }

  function handleDeleteActivity(id: number, name: string) {
    if (!confirm(`Activiteit "${name || 'zonder naam'}" verwijderen uit je opgeslagen data?\n\nLet op: bij een volgende Garmin-sync kan deze terugkomen, tenzij je 'm ook op Garmin verwijdert.`)) return;
    deleteActivity(id);
    setGarmin(getGarminData());
  }

  // Activiteiten die meetellen voor statistieken (stadsfiets-rides uitgesloten)
  const statsActivities = useMemo(() => {
    if (!garmin) return [];
    return filterStatsActivities(garmin.activities, equipment, assignments);
  }, [garmin, equipment, assignments]);

  const trainingLoad = useMemo(() => {
    if (!garmin) return null;
    return calculateTrainingLoad(statsActivities, garmin.health);
  }, [garmin, statsActivities]);

  const readiness: TrainingReadiness | null = useMemo(() => {
    if (!garmin) return null;
    return getTrainingReadiness(garmin.health, true, statsActivities);
  }, [garmin, statsActivities]);

  // Weekly totals
  const weekStats = useMemo(() => {
    if (!garmin) return null;
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoff = sevenDaysAgo.toISOString().split('T')[0];
    const recent = statsActivities.filter((a) => a.date >= cutoff);
    return {
      totalMinutes: recent.reduce((s, a) => s + a.durationMinutes, 0),
      totalKm: Math.round(recent.reduce((s, a) => s + a.distanceKm, 0) * 10) / 10,
      totalCalories: recent.reduce((s, a) => s + a.calories, 0),
      count: recent.length,
      avgHR: recent.length > 0 ? Math.round(recent.reduce((s, a) => s + a.avgHR, 0) / recent.length) : 0,
    };
  }, [garmin, statsActivities]);

  const dailyTRIMP = useMemo(() => {
    if (!garmin) return [];
    const restingHR = garmin.health?.restingHR || 55;
    return getDailyTRIMPHistory(statsActivities, restingHR, 42);
  }, [garmin, statsActivities]);

  // Wekelijkse trenddata voor grafieken (8 weken) — stadsfiets-rides uitgesloten
  const weeklyTrends = useMemo(() => {
    if (!garmin || statsActivities.length === 0) return null;
    const now = new Date();

    const hrData: { label: string; value: number }[] = [];
    const runTempoData: { label: string; value: number }[] = [];
    const raceSpeedData: { label: string; value: number }[] = [];
    const mtbSpeedData: { label: string; value: number }[] = [];
    const powerData: { label: string; value: number }[] = [];
    const swimPaceData: { label: string; value: number }[] = [];

    // Bepaal of een fiets-rit op de racefiets of de MTB hoort (op basis van toewijzing,
    // anders op basis van de Garmin-sport).
    const bikeKind = (a: typeof statsActivities[number]): 'race' | 'mtb' | null => {
      const eq = equipmentForActivity(a, equipment, assignments);
      if (eq?.type === 'racefiets') return 'race';
      if (eq?.type === 'mountainbike') return 'mtb';
      if (eq?.type === 'stadsfiets') return null; // veiligheidsnet (zou al gefilterd zijn)
      if (a.sport === 'fietsen') return 'race';
      if (a.sport === 'mountainbike') return 'mtb';
      return null;
    };

    for (let i = 7; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      const day = d.getDay();
      const monday = new Date(d);
      monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
      const weekStart = monday.toISOString().split('T')[0];
      const weekEnd = new Date(monday);
      weekEnd.setDate(monday.getDate() + 6);
      const weekEndStr = weekEnd.toISOString().split('T')[0];
      const label = monday.toLocaleDateString('nl-NL', { day: 'numeric', month: 'numeric' });

      const weekActivities = statsActivities.filter(a => a.date >= weekStart && a.date <= weekEndStr);
      const withHR = weekActivities.filter(a => a.avgHR > 0);
      const runs = weekActivities.filter(a => a.sport === 'hardlopen' && a.avgSpeed > 0);
      const raceBikes = weekActivities.filter(a => a.avgSpeed > 0 && bikeKind(a) === 'race');
      const mtbBikes = weekActivities.filter(a => a.avgSpeed > 0 && bikeKind(a) === 'mtb');
      const withPower = weekActivities.filter(a => (a.avgPower || 0) > 0);
      const swims = weekActivities.filter(a => a.sport === 'zwemmen' && a.distanceKm > 0 && a.durationMinutes > 0);

      hrData.push({ label, value: withHR.length > 0 ? Math.round(withHR.reduce((s, a) => s + a.avgHR, 0) / withHR.length) : 0 });
      // Tempo in sec/km voor hardlopen (lagere = sneller)
      const avgRunPace = runs.length > 0 ? runs.reduce((s, a) => s + (1 / a.avgSpeed) * 60, 0) / runs.length : 0;
      runTempoData.push({ label, value: Math.round(avgRunPace * 10) / 10 });
      raceSpeedData.push({ label, value: raceBikes.length > 0 ? Math.round(raceBikes.reduce((s, a) => s + a.avgSpeed, 0) / raceBikes.length * 10) / 10 : 0 });
      mtbSpeedData.push({ label, value: mtbBikes.length > 0 ? Math.round(mtbBikes.reduce((s, a) => s + a.avgSpeed, 0) / mtbBikes.length * 10) / 10 : 0 });
      powerData.push({ label, value: withPower.length > 0 ? Math.round(withPower.reduce((s, a) => s + (a.avgPower || 0), 0) / withPower.length) : 0 });
      // Zwemtempo in sec/100m (lagere = sneller)
      const avgSwimPace = swims.length > 0
        ? swims.reduce((s, a) => s + (a.durationMinutes * 60) / (a.distanceKm * 10), 0) / swims.length
        : 0;
      swimPaceData.push({ label, value: Math.round(avgSwimPace) });
    }

    return { hrData, runTempoData, raceSpeedData, mtbSpeedData, powerData, swimPaceData };
  }, [garmin, statsActivities]);

  // Wekelijks volume per sport (8 weken) — uit activiteiten-archief
  const volumeData = useMemo((): WeeklyVolumeData[] => {
    const archive = filterStatsActivities(getActivityArchive(), equipment, assignments);
    if (archive.length === 0) return [];
    const now = new Date();
    const result: WeeklyVolumeData[] = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      const day = d.getDay();
      const monday = new Date(d);
      monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
      const weekStart = monday.toISOString().split('T')[0];
      const weekEnd = new Date(monday);
      weekEnd.setDate(monday.getDate() + 6);
      const weekEndStr = weekEnd.toISOString().split('T')[0];
      const label = monday.toLocaleDateString('nl-NL', { day: 'numeric', month: 'numeric' });
      const week = archive.filter(a => a.date >= weekStart && a.date <= weekEndStr);
      result.push({
        label,
        zwemmen: week.filter(a => a.sport === 'zwemmen').reduce((s, a) => s + a.durationMinutes, 0),
        fietsen: week.filter(a => a.sport === 'fietsen' || a.sport === 'mountainbike').reduce((s, a) => s + a.durationMinutes, 0),
        hardlopen: week.filter(a => a.sport === 'hardlopen').reduce((s, a) => s + a.durationMinutes, 0),
      });
    }
    return result;
  }, [garmin, equipment, assignments]); // eslint-disable-line react-hooks/exhaustive-deps

  // Rusthart- en HRV-trend per week (8 weken) — uit health-archief
  const healthTrends = useMemo(() => {
    const archive = getHealthArchive();
    if (archive.length === 0) return null;
    const now = new Date();
    const restingHRData: { label: string; value: number }[] = [];
    const hrvData: { label: string; value: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      const day = d.getDay();
      const monday = new Date(d);
      monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
      const weekStart = monday.toISOString().split('T')[0];
      const weekEnd = new Date(monday);
      weekEnd.setDate(monday.getDate() + 6);
      const weekEndStr = weekEnd.toISOString().split('T')[0];
      const label = monday.toLocaleDateString('nl-NL', { day: 'numeric', month: 'numeric' });
      const week = archive.filter(h => h.date >= weekStart && h.date <= weekEndStr);
      const withHR = week.filter(h => (h.restingHR || 0) > 0);
      const withHRV = week.filter(h => (h.avgOvernightHrv || 0) > 0);
      restingHRData.push({ label, value: withHR.length > 0 ? Math.round(withHR.reduce((s, h) => s + (h.restingHR || 0), 0) / withHR.length) : 0 });
      hrvData.push({ label, value: withHRV.length > 0 ? Math.round(withHRV.reduce((s, h) => s + (h.avgOvernightHrv || 0), 0) / withHRV.length) : 0 });
    }
    const hasHR = restingHRData.some(d => d.value > 0);
    const hasHRV = hrvData.some(d => d.value > 0);
    if (!hasHR && !hasHRV) return null;
    return { restingHRData, hrvData, hasHR, hasHRV };
  }, [garmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      touchStartY.current = e.touches[0].clientY;
      setPulling(true);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling) return;
    const dist = Math.max(0, e.touches[0].clientY - touchStartY.current);
    setPullDistance(Math.min(dist, PULL_THRESHOLD * 1.5));
  }, [pulling]);

  const handleTouchEnd = useCallback(() => {
    if (pullDistance >= PULL_THRESHOLD && !syncing) {
      handleGarminSync();
    }
    setPullDistance(0);
    setPulling(false);
  }, [pullDistance, syncing]); // eslint-disable-line react-hooks/exhaustive-deps

  const lastSync = garmin?.syncedAt
    ? new Date(garmin.syncedAt).toLocaleString('nl-NL', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      })
    : null;

  if (!garmin) {
    return (
      <div
        className="px-4 pt-6 space-y-5"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {(pullDistance > 10 || syncing) && (
          <div className="fixed top-0 left-0 right-0 flex justify-center items-center z-50 pointer-events-none"
            style={{ height: syncing ? 56 : Math.min(pullDistance, 56) }}>
            <div className="bg-white rounded-full shadow-lg px-4 py-2 flex items-center gap-2">
              <svg className={`w-4 h-4 text-blue-500 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"
                style={{ transform: syncing ? undefined : `rotate(${Math.min(pullDistance / PULL_THRESHOLD, 1) * 180}deg)` }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-xs font-medium text-gray-600">
                {syncing ? 'Garmin syncing...' : pullDistance >= PULL_THRESHOLD ? 'Loslaten om te syncen' : 'Trek omlaag om te syncen'}
              </span>
            </div>
          </div>
        )}

        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data</h1>
          <p className="text-gray-500 text-sm">Garmin gegevens</p>
        </div>

        {syncError && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl">
            {syncError}
          </div>
        )}

        <button
          onClick={handleGarminSync}
          disabled={syncing}
          className="w-full py-3 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {syncing ? 'Garmin data ophalen...' : 'Synchroniseer Garmin'}
        </button>

        <div className="bg-white rounded-xl p-8 border border-gray-200 text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
          </div>
          <p className="text-gray-500 text-sm">Trek omlaag of tik de knop om je Garmin data op te halen</p>
        </div>

        {/* Hartslagzones instellen — ook zonder Garmin beschikbaar */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Hartslagzones instellen</h2>
          <div className="bg-white rounded-xl p-4 border border-gray-200 space-y-4">
            <p className="text-xs text-gray-500">Stel de ondergrens van elke zone in (bpm). De bovengrens van Z5 is je max hartslag.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-100">
                    <th className="text-left py-2 pr-3 font-medium">Zone</th>
                    <th className="text-center py-2 px-2 font-medium">Hardlopen</th>
                    <th className="text-center py-2 pl-2 font-medium">Fietsen</th>
                  </tr>
                </thead>
                <tbody>
                  {['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Max HR'].map((label, idx) => (
                    <tr key={label} className="border-b border-gray-50">
                      <td className="py-2 pr-3 font-semibold text-gray-700 whitespace-nowrap">{label}</td>
                      <td className="py-1 px-2">
                        <input type="number" min={60} max={230} value={zonesRun[idx]}
                          onChange={e => setZonesRun(z => z.map((v, i) => i === idx ? e.target.value : v))}
                          className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm text-center" />
                      </td>
                      <td className="py-1 pl-2">
                        <input type="number" min={60} max={230} value={zonesBike[idx]}
                          onChange={e => setZonesBike(z => z.map((v, i) => i === idx ? e.target.value : v))}
                          className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm text-center" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={saveZones} className="w-full py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700">
              {zonesSaved ? '✓ Opgeslagen' : 'Opslaan'}
            </button>
          </div>
        </section>

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
    <div
      className="px-4 pt-6 space-y-5"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {(pullDistance > 10 || syncing) && (
        <div
          className="fixed top-0 left-0 right-0 flex justify-center items-center z-50 pointer-events-none"
          style={{ height: syncing ? 56 : Math.min(pullDistance, 56) }}
        >
          <div className={`bg-white rounded-full shadow-lg px-4 py-2 flex items-center gap-2 ${syncing ? '' : ''}`}>
            <svg
              className={`w-4 h-4 text-blue-500 ${syncing ? 'animate-spin' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
              style={{ transform: syncing ? undefined : `rotate(${Math.min(pullDistance / PULL_THRESHOLD, 1) * 180}deg)` }}
            >
              {syncing
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              }
            </svg>
            <span className="text-xs font-medium text-gray-600">
              {syncing ? 'Garmin syncing...' : pullDistance >= PULL_THRESHOLD ? 'Loslaten om te syncen' : 'Trek omlaag om te syncen'}
            </span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data</h1>
          <p className="text-gray-500 text-sm">Garmin gegevens {lastSync && `· ${lastSync}`}</p>
        </div>
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
                <p className="text-xs text-gray-500">
                  {readiness.score}/{readiness.maxScore} punten
                  {!readiness.dataComplete && <span className="text-amber-600"> · data incompleet</span>}
                </p>
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
                    {f.val === null
                      ? Array.from({ length: f.max }, (_, i) => (
                          <div key={i} className="h-3 flex-1 rounded bg-gray-50 border border-dashed border-gray-300" />
                        ))
                      : Array.from({ length: f.max }, (_, i) => i + 1).map((i) => (
                          <div
                            key={i}
                            className={`h-3 flex-1 rounded ${
                              i <= f.val!
                                ? f.val! >= f.max * 0.6 ? 'bg-green-400' : f.val! >= f.max * 0.3 ? 'bg-yellow-400' : 'bg-red-400'
                                : 'bg-gray-100'
                            }`}
                          />
                        ))}
                  </div>
                  <p className="text-xs text-gray-400 w-36 text-right">
                    {f.val === null ? <span className="italic">geen data</span> : f.detail}
                  </p>
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
                <p>Max HR: {getProfile().maxHR} bpm</p>
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

      {/* Trainingsbelasting grafiek */}
      {dailyTRIMP.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Belasting (6 weken)</h2>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <TrainingLoadChart data={dailyTRIMP} />
            <div className="flex gap-3 mt-3 flex-wrap">
              {[
                { zone: 'laag', color: '#60a5fa', label: 'Laag' },
                { zone: 'optimaal', color: '#22c55e', label: 'Optimaal' },
                { zone: 'hoog', color: '#f97316', label: 'Hoog' },
                { zone: 'overbelast', color: '#ef4444', label: 'Overbelast' },
              ].map(({ color, label }) => (
                <span key={label} className="flex items-center gap-1 text-[10px] text-gray-500">
                  <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
                  {label}
                </span>
              ))}
            </div>
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

            {/* Drempels & ademhaling */}
            {(garmin.health.lactateThresholdHR || garmin.health.lactateThresholdPace || garmin.health.avgRespirationRate) && (
              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs text-gray-400 mb-2">Drempels & ademhaling</p>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xl font-bold text-rose-600">{garmin.health.lactateThresholdHR || '–'}</p>
                    <p className="text-xs text-gray-500">LT HR (bpm)</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-rose-500">{garmin.health.lactateThresholdPace || '–'}</p>
                    <p className="text-xs text-gray-500">LT tempo</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-teal-600">{garmin.health.avgRespirationRate || '–'}</p>
                    <p className="text-xs text-gray-500">Ademh./min</p>
                  </div>
                </div>
              </div>
            )}

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

      {/* Garmin-koppeling instellen */}
      <GarminSetupCard onConnect={handleGarminSync} />

      {/* Garmin sync knop */}
      <button
        onClick={handleGarminSync}
        disabled={syncing}
        className="w-full py-3 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
      >
        <svg className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        {syncing ? 'Garmin data ophalen...' : 'Synchroniseer Garmin'}
      </button>

      {/* Trends grafieken */}
      {(weeklyTrends || volumeData.some(d => d.zwemmen + d.fietsen + d.hardlopen > 0) || healthTrends) && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Trends (8 weken)</h2>
          <div className="bg-gray-100 rounded-xl p-4 space-y-5">
            {/* Volume per sport */}
            <WeeklyVolumeChart data={volumeData} />

            {/* Herstel: rusthart + HRV */}
            {healthTrends?.hasHR && (
              <BuildupBarChart data={healthTrends.restingHRData} color="#8b5cf6" unit="bpm" title="Rusthartslag per week" />
            )}
            {healthTrends?.hasHRV && (
              <BuildupBarChart data={healthTrends.hrvData} color="#06b6d4" unit="ms" title="HRV per week (nacht)" />
            )}

            {/* Prestatiemetrieken */}
            {weeklyTrends && (<>
              <BuildupBarChart data={weeklyTrends.hrData} color="#ef4444" unit="bpm" title="Gemiddelde hartslag per week" />
              <BuildupBarChart data={weeklyTrends.runTempoData} color="#f97316" unit="min/km" title="Hardlooptempo per week" />
              <BuildupBarChart data={weeklyTrends.raceSpeedData} color="#22c55e" unit="km/h" title="Snelheid racefiets per week" />
              <BuildupBarChart data={weeklyTrends.mtbSpeedData} color="#10b981" unit="km/h" title="Snelheid mountainbike per week" />
              {weeklyTrends.powerData.some(d => d.value > 0) && (
                <BuildupBarChart data={weeklyTrends.powerData} color="#f59e0b" unit="W" title="Gemiddeld vermogen fietsen per week" />
              )}
              <BuildupBarChart data={weeklyTrends.swimPaceData} color="#3b82f6" unit="s/100m" title="Zwemtempo per week" />
            </>)}
          </div>
        </section>
      )}

      {/* Materiaal */}
      <MaterialSection />

      {/* Alle activiteiten */}
      {garmin.activities.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Activiteiten</h2>
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {garmin.activities.map((a) => {
              const assignedEq = equipmentForActivity(a, equipment, assignments);
              // Alleen voor fietsen tonen we het materiaal-icoon (race/MTB/stad).
              // Hardlopen houdt de loper, zwemmen de zwem-variant.
              const showBikeIcon = assignedEq && (
                assignedEq.type === 'racefiets' ||
                assignedEq.type === 'mountainbike' ||
                assignedEq.type === 'stadsfiets' ||
                assignedEq.type === 'fiets'
              );
              return (
              <div key={a.id} className="p-3">
                <div className="flex items-center gap-3">
                  {showBikeIcon ? (
                    <EquipmentIcon type={assignedEq!.type} size="md" />
                  ) : a.sport === 'zwemmen' ? (
                    <SwimVariantIcon variant={swimVariantForActivity(a, swimVariants)} size="md" />
                  ) : (
                    <SportIcon sport={a.sport !== 'overig' ? a.sport : 'overig'} size="md" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{a.activityName}</p>
                    <p className="text-xs text-gray-500">
                      {a.durationMinutes}min
                      {a.distanceKm > 0 && ` · ${a.distanceKm}km`}
                      {a.avgHR > 0 && ` · HR ${a.avgHR}/${a.maxHR}`}
                      {(a.avgPower || 0) > 0 && ` · ${a.avgPower}W`}
                      {(a.normalizedPower || 0) > 0 && ` (NP ${a.normalizedPower}W)`}
                      {a.calories > 0 && ` · ${a.calories}kcal`}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{a.date}</span>
                      <button
                        onClick={() => handleDeleteActivity(a.id, a.activityName)}
                        aria-label="Activiteit verwijderen"
                        className="text-gray-300 hover:text-red-500 transition-colors p-0.5"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                    {(a.sport === 'fietsen' || a.sport === 'hardlopen' || a.sport === 'mountainbike') && a.distanceKm > 0 && (
                      <EquipmentAssignChip
                        activity={a}
                        equipment={equipment}
                        assignments={assignments}
                        onChange={refreshEquipment}
                      />
                    )}
                    {a.sport === 'zwemmen' && (
                      <SwimVariantChip
                        activity={a}
                        variants={swimVariants}
                        onChange={refreshEquipment}
                      />
                    )}
                  </div>
                </div>
                {/* Splits: multisport per discipline, anders generieke laps */}
                {a.splits && a.splits.length > 1 && (
                  <div className="mt-2 ml-10 space-y-0.5">
                    {a.isMultisport ? (
                      // Multisport: elk onderdeel is een eigen child-activiteit met sport
                      (() => {
                        const SPORT_EMOJI: Record<string, string> = { zwemmen: '🏊', fietsen: '🚴', hardlopen: '🏃', transitie: '↔️' };
                        const SPORT_COLOR: Record<string, string> = { zwemmen: 'text-blue-500', fietsen: 'text-green-500', hardlopen: 'text-orange-500', transitie: 'text-gray-400' };
                        const SPORT_LABEL: Record<string, string> = { zwemmen: 'Zwemmen', fietsen: 'Fietsen', hardlopen: 'Hardlopen' };
                        let transitionNr = 0;
                        return a.splits!.map((s, i) => {
                          const sp = s.sport || 'onbekend';
                          const mins = Math.floor(s.durationSeconds / 60);
                          const secs = s.durationSeconds % 60;
                          const emoji = SPORT_EMOJI[sp] || '•';
                          const col = SPORT_COLOR[sp] || 'text-gray-500';
                          const label = sp === 'transitie'
                            ? `T${++transitionNr}`
                            : (SPORT_LABEL[sp] || 'Onbekend');
                          return (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <span className="w-5 text-center">{emoji}</span>
                              <span className={`font-medium ${col} w-16`}>{label}</span>
                              {s.distance > 0 && <span className="text-gray-500">{s.distance < 1 ? `${Math.round(s.distance * 1000)}m` : `${s.distance.toFixed(2)}km`}</span>}
                              <span className="text-gray-600">{mins}:{secs.toString().padStart(2, '0')}</span>
                              {s.avgHR > 0 && <span className="text-red-400">HR {s.avgHR}</span>}
                              {(s.avgPower || 0) > 0 && <span className="text-amber-500">{s.avgPower}W</span>}
                            </div>
                          );
                        });
                      })()
                    ) : (
                      // Gewone laps (interval, ronden)
                      a.splits!.map((s, i) => {
                        const mins = Math.floor(s.durationSeconds / 60);
                        const secs = s.durationSeconds % 60;
                        return (
                          <div key={i} className="flex items-center gap-2 text-xs text-gray-500">
                            <span className="w-4 text-gray-400 text-right">{i + 1}.</span>
                            {s.distance > 0 && <span>{s.distance < 1 ? `${Math.round(s.distance * 1000)}m` : `${s.distance}km`}</span>}
                            <span>{mins}:{secs.toString().padStart(2, '0')}</span>
                            {s.avgHR > 0 && <span className="text-red-400">HR {s.avgHR}</span>}
                            {(s.avgPower || 0) > 0 && <span className="text-amber-500">{s.avgPower}W</span>}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Hartslagzones instellen */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Hartslagzones instellen</h2>
        <div className="bg-white rounded-xl p-4 border border-gray-200 space-y-4">
          <p className="text-xs text-gray-500">Stel de ondergrens van elke zone in (bpm). De bovengrens van Z5 is je max hartslag.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100">
                  <th className="text-left py-2 pr-3 font-medium">Zone</th>
                  <th className="text-center py-2 px-2 font-medium">Hardlopen</th>
                  <th className="text-center py-2 pl-2 font-medium">Fietsen</th>
                </tr>
              </thead>
              <tbody>
                {['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Max HR'].map((label, idx) => (
                  <tr key={label} className="border-b border-gray-50">
                    <td className="py-2 pr-3 font-semibold text-gray-700 whitespace-nowrap">{label}</td>
                    <td className="py-1 px-2">
                      <input
                        type="number"
                        min={60}
                        max={230}
                        value={zonesRun[idx]}
                        onChange={e => setZonesRun(z => z.map((v, i) => i === idx ? e.target.value : v))}
                        className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm text-center"
                      />
                    </td>
                    <td className="py-1 pl-2">
                      <input
                        type="number"
                        min={60}
                        max={230}
                        value={zonesBike[idx]}
                        onChange={e => setZonesBike(z => z.map((v, i) => i === idx ? e.target.value : v))}
                        className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm text-center"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={saveZones}
            className="w-full py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700"
          >
            {zonesSaved ? '✓ Opgeslagen' : 'Opslaan'}
          </button>
        </div>
      </section>

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
