'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { getGarminData, saveGarminData, getEquipment, getActivityAssignments, getSwimVariants, mergeActivitiesIntoArchive, mergeHealthIntoArchive, deleteActivity, getGarminCredentials, getActivityArchive, getHealthArchive, getProfile, markAutoSyncDone, getActivePlan, getRunZones, getCyclingZones } from '@/lib/storage';
import { calculateTrainingLoad, getTrainingReadiness, getDailyTRIMPHistory, computeWeekAdherence, describeHrv } from '@/lib/training-load';
import { GarminSyncData, TrainingReadiness, Equipment, ActivityAssignments, ActivitySwimVariants, Sport, HeartRateZoneInfo, HEART_RATE_ZONES } from '@/lib/types';
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
import HeartRateZonesCard from '@/components/HeartRateZonesCard';
import StrengthWorkoutsCard from '@/components/StrengthWorkoutsCard';
import DataManagementCard from '@/components/DataManagementCard';
import WeeklyVolumeChart, { WeeklyVolumeData } from '@/components/WeeklyVolumeChart';

type Section = 'overzicht' | 'trends' | 'activiteiten' | 'materiaal' | 'instellingen';

function zonesForSport(sport: Sport): HeartRateZoneInfo[] {
  if (sport === 'hardlopen') return getRunZones();
  if (sport === 'fietsen' || sport === 'mountainbike') return getCyclingZones();
  return HEART_RATE_ZONES;
}

export default function DataPage() {
  const [garmin, setGarmin] = useState<GarminSyncData | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [pulling, setPulling] = useState(false);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [assignments, setAssignments] = useState<ActivityAssignments>({});
  const [swimVariants, setSwimVariants] = useState<ActivitySwimVariants>({});
  const [section, setSection] = useState<Section>('overzicht');
  const [expandedSplits, setExpandedSplits] = useState<Set<number>>(new Set());
  const touchStartY = useRef(0);
  const PULL_THRESHOLD = 65;

  const refreshEquipment = useCallback(() => {
    setEquipment(getEquipment());
    setAssignments(getActivityAssignments());
    setSwimVariants(getSwimVariants());
  }, []);

  useEffect(() => {
    setGarmin(getGarminData());
    refreshEquipment();
    // Deep-link: /data?section=instellingen opent direct de juiste subtab
    const q = new URLSearchParams(window.location.search).get('section');
    const valid: Section[] = ['overzicht', 'trends', 'activiteiten', 'materiaal', 'instellingen'];
    if (q && (valid as string[]).includes(q)) setSection(q as Section);
  }, [refreshEquipment]);

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

  function toggleSplits(id: number) {
    setExpandedSplits(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
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

  // Plan-adherentie: gepland vs. gedaan over de afgelopen 7 dagen (uit het archief)
  const adherence = useMemo(() => {
    if (!garmin) return null;
    const { plan, cycleStartDate } = getActivePlan();
    const archive = filterStatsActivities(getActivityArchive(), equipment, assignments);
    return computeWeekAdherence(plan, cycleStartDate, archive, zonesForSport);
  }, [garmin, equipment, assignments]);

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

  // HRV per dag over de afgelopen 7 dagen (uit health-archief) — voor het mini-grafiekje
  // in het gereedheid-blok. 0 = geen meting die nacht.
  const hrv7Days = useMemo(() => {
    const archive = getHealthArchive();
    if (archive.length === 0) return [];
    const byDate = new Map(archive.map(h => [h.date, h.avgOvernightHrv || 0]));
    const days: { label: string; value: number }[] = [];
    const now = new Date();
    const wd = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().split('T')[0];
      days.push({ label: wd[d.getDay()], value: byDate.get(iso) || 0 });
    }
    return days;
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

  const pullIndicator = (
    <>
      {(pullDistance > 10 || syncing) && (
        <div
          className="fixed top-0 left-0 right-0 flex justify-center items-center z-50 pointer-events-none"
          style={{ height: syncing ? 56 : Math.min(pullDistance, 56) }}
        >
          <div className="bg-[#1c1c1e] border border-white/10 rounded-full shadow-lg px-4 py-2 flex items-center gap-2">
            <svg
              className={`w-4 h-4 text-blue-400 ${syncing ? 'animate-spin' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
              style={{ transform: syncing ? undefined : `rotate(${Math.min(pullDistance / PULL_THRESHOLD, 1) * 180}deg)` }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-xs font-medium text-gray-300">
              {syncing ? 'Garmin syncing...' : pullDistance >= PULL_THRESHOLD ? 'Loslaten om te syncen' : 'Trek omlaag om te syncen'}
            </span>
          </div>
        </div>
      )}
    </>
  );

  const syncButton = (
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
  );

  // De sub-navigatie is er altijd — óók zonder Garmin-data, zodat Instellingen
  // (Garmin-koppeling, zones, kracht) op dezelfde plek zitten als mét data.
  const SECTIONS: { id: Section; label: string }[] = [
    { id: 'overzicht', label: 'Overzicht' },
    { id: 'trends', label: 'Trends' },
    { id: 'activiteiten', label: 'Activiteiten' },
    { id: 'materiaal', label: 'Materiaal' },
    { id: 'instellingen', label: 'Instellingen' },
  ];

  const noDataCard = (
    <div className="bg-[#0d0d0f] rounded-3xl p-8 border border-white/5 text-center">
      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
        <svg className="w-6 h-6 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
      </div>
      <p className="text-gray-400 text-sm">Nog geen Garmin-data. Koppel je account en synchroniseer om hier je gegevens te zien.</p>
    </div>
  );

  return (
    <div className="bg-black min-h-screen">
      <div className="fixed top-0 inset-x-0 bg-black z-50" style={{ height: 'env(safe-area-inset-top, 0px)' }} />
      <div className="fixed bottom-0 inset-x-0 bg-black z-40" style={{ height: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }} />
      <div
      className="px-4 pt-6 pb-8 space-y-5"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {pullIndicator}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Data</h1>
          <p className="text-gray-400 text-sm">Garmin gegevens {lastSync && `· ${lastSync}`}</p>
        </div>
      </div>

      {syncError && (
        <div className="bg-red-500/10 text-red-400 text-sm p-3 rounded-xl">
          {syncError}
        </div>
      )}

      {/* Sub-navigatie */}
      <div className="flex bg-white/5 border border-white/10 rounded-xl p-1">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`flex-1 py-2 px-0.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              section === s.id ? 'bg-blue-600 text-white shadow-[0_2px_12px_rgba(37,99,235,0.4)]' : 'text-gray-400'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {(section === 'overzicht' || section === 'instellingen') && syncButton}

      {/* Zonder Garmin-data: koppel-kaart prominent op Overzicht */}
      {section === 'overzicht' && !garmin && (
        <>
          <GarminSetupCard onConnect={handleGarminSync} />
          {noDataCard}
        </>
      )}
      {section === 'trends' && !garmin && noDataCard}
      {section === 'activiteiten' && !garmin && noDataCard}

      {section === 'overzicht' && (
        <>
          {/* Trainingsgereedheid detail */}
          {readiness && (
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">Trainingsgereedheid</h2>
              <div className="bg-[#0d0d0f] rounded-3xl p-4 border border-white/5">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-12 h-12 rounded-full ${readiness.bgColor} flex items-center justify-center`}>
                    <span className="text-white font-bold text-lg">{readiness.score}</span>
                  </div>
                  <div>
                    <p className={`text-xl font-bold ${readiness.color}`}>{readiness.label}</p>
                    <p className="text-xs text-gray-500">
                      {readiness.score}/{readiness.maxScore} punten
                      {!readiness.dataComplete && <span className="text-amber-400"> · data incompleet</span>}
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { label: readiness.factors.label1, val: readiness.factors.score1, max: readiness.factors.max1, detail: readiness.mode === 'full' ? (describeHrv(garmin?.health ?? null) ? `${describeHrv(garmin!.health)!.value}ms · ${describeHrv(garmin!.health)!.statusLabel}` : `${garmin?.health?.avgOvernightHrv || 0}ms`) : `${garmin?.health?.restingHR || ''} bpm` },
                    { label: readiness.factors.label2, val: readiness.factors.score2, max: readiness.factors.max2, detail: readiness.mode === 'full' ? `Score ${garmin?.health?.sleepScore || 0} · ${garmin?.health?.sleepDurationHours || 0}u` : 'TRIMP laatste 48u' },
                    { label: readiness.factors.label3, val: readiness.factors.score3, max: readiness.factors.max3, detail: readiness.mode === 'full' ? 'TRIMP laatste 48u' : garmin?.health ? `Battery ${garmin.health.bodyBatteryChange > 0 ? '+' : ''}${garmin.health.bodyBatteryChange} · Rust HR ${garmin.health.restingHR}` : '' },
                  ].map((f) => (
                    <div key={f.label} className="flex items-center gap-3">
                      <p className="text-xs text-gray-500 w-14">{f.label}</p>
                      <div className="flex gap-1 flex-1">
                        {f.val === null
                          ? Array.from({ length: f.max }, (_, i) => (
                              <div key={i} className="h-3 flex-1 rounded bg-white/5 border border-dashed border-white/15" />
                            ))
                          : Array.from({ length: f.max }, (_, i) => i + 1).map((i) => (
                              <div
                                key={i}
                                className={`h-3 flex-1 rounded ${
                                  i <= f.val!
                                    ? f.val! >= f.max * 0.6 ? 'bg-green-400' : f.val! >= f.max * 0.3 ? 'bg-yellow-400' : 'bg-red-400'
                                    : 'bg-white/10'
                                }`}
                              />
                            ))}
                      </div>
                      <p className="text-xs text-gray-500 w-36 text-right">
                        {f.val === null ? <span className="italic">geen data</span> : f.detail}
                      </p>
                    </div>
                  ))}
                </div>
                {(() => {
                  const hrv = describeHrv(garmin?.health ?? null);
                  if (!hrv) return null;
                  const trendColor = hrv.trend === 'boven' ? 'text-green-400' : hrv.trend === 'onder' ? 'text-red-400' : 'text-gray-300';
                  const trendArrow = hrv.trend === 'boven' ? '▲' : hrv.trend === 'onder' ? '▼' : '≈';
                  const hasBand = hrv.baselineLow !== undefined && hrv.baselineHigh !== undefined;
                  return (
                    <div className="mt-3 pt-3 border-t border-white/5">
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-sm font-semibold text-cyan-400">HRV</span>
                        <span className="text-sm text-white font-medium">{hrv.value} ms</span>
                        <span className="text-xs text-gray-500">·</span>
                        <span className="text-sm text-gray-200">{hrv.statusLabel}</span>
                      </div>
                      {hasBand ? (
                        <p className="text-xs text-gray-400 mb-1">
                          Balansbereik: {hrv.baselineLow}–{hrv.baselineHigh} ms{' '}
                          <span className={trendColor}>{trendArrow} {hrv.trend} bandbreedte</span>
                        </p>
                      ) : hrv.baseline ? (
                        <p className="text-xs text-gray-400 mb-1">
                          Basislijn (7-daags): {hrv.baseline} ms{' '}
                          <span className={trendColor}>
                            {trendArrow} {hrv.diff !== undefined ? `${hrv.diff >= 0 ? '+' : ''}${hrv.diff} ms · ${hrv.trend} bandbreedte` : hrv.trend}
                          </span>
                        </p>
                      ) : null}
                      <p className="text-xs text-gray-400 leading-relaxed">{hrv.interpretation}</p>
                      {hrv7Days.filter(d => d.value > 0).length >= 2 && (
                        <div className="mt-3">
                          <BuildupBarChart
                            data={hrv7Days}
                            color="#06b6d4"
                            unit="ms"
                            title="HRV — afgelopen 7 dagen"
                            baseline={hrv.baseline}
                            baselineLabel="basislijn"
                            bandLow={hrv.baselineLow}
                            bandHigh={hrv.baselineHigh}
                            bandLabel="balans"
                          />
                        </div>
                      )}
                    </div>
                  );
                })()}
                <p className="text-sm text-gray-300 mt-3 pt-3 border-t border-white/5">{readiness.advice}</p>
              </div>
            </section>
          )}

          {/* Week overzicht */}
          {weekStats && (
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">Deze week</h2>
              <div className="bg-[#0d0d0f] rounded-3xl p-4 border border-white/5">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-2xl font-bold text-blue-400">
                      {Math.floor(weekStats.totalMinutes / 60)}u{weekStats.totalMinutes % 60}m
                    </p>
                    <p className="text-xs text-gray-500">Trainingsduur</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-400">{weekStats.totalKm}</p>
                    <p className="text-xs text-gray-500">Kilometer</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-orange-400">{weekStats.count}</p>
                    <p className="text-xs text-gray-500">Sessies</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-center mt-3">
                  <div>
                    <p className="text-2xl font-bold text-red-400">{weekStats.avgHR || '–'}</p>
                    <p className="text-xs text-gray-500">Gem. HR</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-400">{weekStats.totalCalories}</p>
                    <p className="text-xs text-gray-500">Calorieen</p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Plan-adherentie: gepland vs. gedaan */}
          {adherence && (
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">Volgens plan</h2>
              <div className="bg-[#0d0d0f] rounded-3xl p-4 border border-white/5">
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className={`text-3xl font-bold ${adherence.adherencePct >= 85 ? 'text-green-400' : adherence.adherencePct >= 60 ? 'text-amber-400' : 'text-red-400'}`}>
                      {adherence.adherencePct}%
                    </p>
                    <p className="text-sm font-semibold text-gray-200">{adherence.label}</p>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <p>{adherence.completedCount} van {adherence.plannedCount} sessies gedaan</p>
                    <p>afgelopen 7 dagen</p>
                    {adherence.avgMatchScore !== null && (
                      <p className="mt-0.5 text-gray-400 font-medium">gem. uitvoering {adherence.avgMatchScore}%</p>
                    )}
                  </div>
                </div>

                <div className="bg-white/10 rounded-full h-2 mt-3">
                  <div
                    className={`h-2 rounded-full ${adherence.adherencePct >= 85 ? 'bg-green-500' : adherence.adherencePct >= 60 ? 'bg-amber-400' : 'bg-red-400'}`}
                    style={{ width: `${adherence.adherencePct}%` }}
                  />
                </div>

                {/* Per dag: stip per geplande sessie (groen gedaan / rood gemist), — = rustdag */}
                <div className="grid grid-cols-7 gap-1 mt-4">
                  {adherence.days.map((d) => (
                    <div key={d.date} className="text-center">
                      <p className="text-[10px] text-gray-500 mb-1">{d.dayLabel.split(' ')[0]}</p>
                      {d.restDay ? (
                        <span className="text-xs text-green-500/70" title="rustdag · volgens plan">—</span>
                      ) : d.planned.length === 0 ? (
                        <span className="text-xs text-gray-600">—</span>
                      ) : (
                        <div className="flex justify-center gap-0.5">
                          {d.planned.map((p, i) => (
                            <span
                              key={i}
                              title={`${p.session.sport} ${p.session.type}${p.done ? ` · uitvoering ${p.matchScore}%` : ' · gemist'}`}
                              className={`w-2.5 h-2.5 rounded-full ${p.done ? 'bg-green-500' : 'bg-red-400/70'}`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-500 mt-2">
                  Stip per geplande sessie: groen = gedaan, rood = gemist. Krachttraining telt niet mee.
                </p>
              </div>
            </section>
          )}

          {/* Training Load detail */}
          {trainingLoad && (
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">Training Load</h2>
              <div className="bg-[#0d0d0f] rounded-3xl p-4 border border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className={`text-3xl font-bold ${trainingLoad.statusColor}`}>{trainingLoad.weekLoad}</p>
                    <p className={`text-sm font-semibold ${trainingLoad.statusColor}`}>
                      {trainingLoad.status.charAt(0).toUpperCase() + trainingLoad.status.slice(1)}
                    </p>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <p>TRIMP (7 dagen)</p>
                    <p>Max HR: {getProfile().maxHR} bpm</p>
                  </div>
                </div>
                {/* Load zones */}
                <div className="relative bg-white/10 rounded-full h-3 mb-2">
                  <div className="absolute left-0 top-0 h-3 bg-blue-400 rounded-l-full" style={{ width: '25%' }} />
                  <div className="absolute left-[25%] top-0 h-3 bg-green-500" style={{ width: '33%' }} />
                  <div className="absolute left-[58%] top-0 h-3 bg-orange-500" style={{ width: '25%' }} />
                  <div className="absolute left-[83%] top-0 h-3 bg-red-500 rounded-r-full" style={{ width: '17%' }} />
                  {/* Indicator */}
                  <div
                    className="absolute top-[-4px] w-3 h-5 bg-white rounded-sm border-2 border-black"
                    style={{ left: `${Math.min(97, (trainingLoad.weekLoad / 600) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>Laag</span>
                  <span>Optimaal</span>
                  <span>Hoog</span>
                  <span>Over</span>
                </div>
                <p className="text-sm text-gray-300 mt-3">{trainingLoad.advice}</p>
              </div>
            </section>
          )}

          {/* Gezondheid */}
          {garmin?.health && (
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">Gezondheid</h2>
              <div className="bg-[#0d0d0f] rounded-3xl p-4 border border-white/5 space-y-4">
                {/* Slaap */}
                <div>
                  <p className="text-xs text-gray-500 mb-2">Slaap</p>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-xl font-bold text-purple-400">{garmin.health.sleepDurationHours}u</p>
                      <p className="text-xs text-gray-500">Duur</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-amber-400">{garmin.health.sleepScore || '–'}</p>
                      <p className="text-xs text-gray-500">Score</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-indigo-400">{garmin.health.deepSleepMinutes}m</p>
                      <p className="text-xs text-gray-500">Diep</p>
                    </div>
                  </div>
                  {garmin.health.remSleepMinutes > 0 && (
                    <div className="flex gap-1 mt-2">
                      <div className="h-2 rounded-full bg-indigo-500" style={{ flex: garmin.health.deepSleepMinutes }} />
                      <div className="h-2 rounded-full bg-blue-400" style={{ flex: garmin.health.remSleepMinutes }} />
                      <div className="h-2 rounded-full bg-white/10" style={{ flex: Math.max(0, (garmin.health.sleepDurationHours * 60) - garmin.health.deepSleepMinutes - garmin.health.remSleepMinutes) }} />
                    </div>
                  )}
                  <div className="flex gap-4 mt-1 text-[10px] text-gray-500">
                    <span>Diep: {garmin.health.deepSleepMinutes}m</span>
                    <span>REM: {garmin.health.remSleepMinutes}m</span>
                  </div>
                </div>

                {/* Hartslag & HRV */}
                <div className="border-t border-white/5 pt-3">
                  <p className="text-xs text-gray-500 mb-2">Hart & Herstel</p>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-xl font-bold text-red-400">{garmin.health.restingHR || '–'}</p>
                      <p className="text-xs text-gray-500">Rust HR</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-green-400">{garmin.health.avgOvernightHrv || '–'}</p>
                      <p className="text-xs text-gray-500">HRV</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-blue-400">
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
                  <div className="border-t border-white/5 pt-3">
                    <p className="text-xs text-gray-500 mb-2">Drempels & ademhaling</p>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-xl font-bold text-rose-400">{garmin.health.lactateThresholdHR || '–'}</p>
                        <p className="text-xs text-gray-500">LT HR (bpm)</p>
                      </div>
                      <div>
                        <p className="text-xl font-bold text-rose-400">{garmin.health.lactateThresholdPace || '–'}</p>
                        <p className="text-xs text-gray-500">LT tempo</p>
                      </div>
                      <div>
                        <p className="text-xl font-bold text-teal-400">{garmin.health.avgRespirationRate || '–'}</p>
                        <p className="text-xs text-gray-500">Ademh./min</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Stappen */}
                <div className="border-t border-white/5 pt-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">Stappen</p>
                    <p className="text-lg font-bold text-gray-200">{garmin.health.steps?.toLocaleString('nl-NL') || '–'}</p>
                  </div>
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {section === 'trends' && (
        <>
          {/* Trainingsbelasting grafiek */}
          {dailyTRIMP.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">Belasting (6 weken)</h2>
              <div className="bg-[#0d0d0f] rounded-3xl p-4 border border-white/5">
                <TrainingLoadChart data={dailyTRIMP} />
                <div className="flex gap-3 mt-3 flex-wrap">
                  {[
                    { zone: 'laag', color: '#60a5fa', label: 'Laag' },
                    { zone: 'optimaal', color: '#22c55e', label: 'Optimaal' },
                    { zone: 'hoog', color: '#f97316', label: 'Hoog' },
                    { zone: 'overbelast', color: '#ef4444', label: 'Overbelast' },
                  ].map(({ color, label }) => (
                    <span key={label} className="flex items-center gap-1 text-[10px] text-gray-400">
                      <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Trends grafieken */}
          {(weeklyTrends || volumeData.some(d => d.zwemmen + d.fietsen + d.hardlopen > 0) || healthTrends) && (
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">Trends (8 weken)</h2>
              <div className="bg-[#0d0d0f] rounded-3xl p-4 border border-white/5 space-y-5">
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
        </>
      )}

      {section === 'materiaal' && (
        <MaterialSection />
      )}

      {section === 'activiteiten' && garmin && (
        <>
          {/* Alle activiteiten */}
          {garmin.activities.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-white mb-3">Activiteiten</h2>
              <div className="bg-[#0d0d0f] rounded-3xl border border-white/5 divide-y divide-white/5">
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
                        <p className="text-sm font-medium text-gray-100 truncate">{a.activityName}</p>
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
                          <span className="text-xs text-gray-500">{a.date}</span>
                          <button
                            onClick={() => handleDeleteActivity(a.id, a.activityName)}
                            aria-label="Activiteit verwijderen"
                            className="text-gray-600 hover:text-red-400 transition-colors p-0.5"
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
                    {/* Splits: multisport per discipline, anders generieke laps — inklapbaar */}
                    {a.splits && a.splits.length > 1 && (
                      <div className="mt-2 ml-10">
                        <button
                          onClick={() => toggleSplits(a.id)}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                          aria-expanded={expandedSplits.has(a.id)}
                        >
                          <svg
                            className={`w-3 h-3 transition-transform ${expandedSplits.has(a.id) ? 'rotate-90' : ''}`}
                            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                          >
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                          {expandedSplits.has(a.id)
                            ? 'Verberg onderdelen'
                            : `${a.isMultisport ? 'Toon disciplines' : 'Toon ronden'} (${a.splits.length})`}
                        </button>
                      </div>
                    )}
                    {a.splits && a.splits.length > 1 && expandedSplits.has(a.id) && (
                      <div className="mt-1 ml-10 space-y-0.5">
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
                                  <span className="text-gray-300">{mins}:{secs.toString().padStart(2, '0')}</span>
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
        </>
      )}

      {section === 'instellingen' && (
        <>
          {/* Garmin-koppeling instellen */}
          <GarminSetupCard onConnect={handleGarminSync} />

          <HeartRateZonesCard />
          <StrengthWorkoutsCard />
          <DataManagementCard />
        </>
      )}

      {/* Bottom spacer for nav */}
      <div className="h-4" />
      </div>
    </div>
  );
}
