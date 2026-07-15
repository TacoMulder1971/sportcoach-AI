'use client';

import { useEffect, useState } from 'react';
import SportIcon from '@/components/SportIcon';
import { getGarminData, getEquipment, getActivityAssignments, getActiveRaceDate, buildRaceContextText, getRecentNutritionLogs, getWeeklyReport, saveWeeklyReport, getActivityArchive, getRunZones, getCyclingZones, recordPlannedDays } from '@/lib/storage';
import { filterStatsActivities } from '@/lib/equipment';
import { getWeeklyTRIMPTotals, computeWeekAdherence, calcTRIMP } from '@/lib/training-load';
import { getCurrentPhase, getDaysUntilRace } from '@/lib/periodization';
import { formatDuration } from '@/lib/schedule';
import { Sport, HeartRateZoneInfo, HEART_RATE_ZONES } from '@/lib/types';

function zonesForSport(sport: Sport): HeartRateZoneInfo[] {
  if (sport === 'hardlopen') return getRunZones();
  if (sport === 'fietsen' || sport === 'mountainbike') return getCyclingZones();
  return HEART_RATE_ZONES;
}

const SPORT_LABEL: Record<string, string> = {
  zwemmen: 'Zwemmen', fietsen: 'Fietsen', hardlopen: 'Hardlopen',
  mountainbike: 'Mountainbike', wandelen: 'Wandelen', voetballen: 'Voetballen',
  multisport: 'Multisport', kracht: 'Kracht',
};

interface WeekStats {
  count: number;
  minutes: number;
  km: number;
  trimp: number;
  perSport: { sport: Sport; km: number; minutes: number }[];
}

export default function WeeklyReportSection() {
  const [weeklyReport, setWeeklyReport] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weekStats, setWeekStats] = useState<WeekStats | null>(null);

  const isMonday = new Date().getDay() === 1;

  useEffect(() => {
    const cached = getWeeklyReport();
    if (cached) setWeeklyReport(cached.summary);

    // Statistieken van de afgelopen 7 dagen (zelfde bron als de Data-tab)
    const garmin = getGarminData();
    if (!garmin) return;
    const acts = filterStatsActivities(garmin.activities, getEquipment(), getActivityAssignments());
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoff = sevenDaysAgo.toISOString().split('T')[0];
    const recent = acts.filter((a) => a.date >= cutoff);
    if (recent.length === 0) return;

    const restingHR = garmin.health?.restingHR || 55;
    const bySport = new Map<Sport, { km: number; minutes: number }>();
    for (const a of recent) {
      const cur = bySport.get(a.sport as Sport) || { km: 0, minutes: 0 };
      cur.km += a.distanceKm || 0;
      cur.minutes += a.durationMinutes || 0;
      bySport.set(a.sport as Sport, cur);
    }
    setWeekStats({
      count: recent.length,
      minutes: recent.reduce((s, a) => s + a.durationMinutes, 0),
      km: recent.reduce((s, a) => s + (a.distanceKm || 0), 0),
      trimp: recent.reduce((s, a) => s + calcTRIMP(a, restingHR), 0),
      perSport: [...bySport.entries()]
        .map(([sport, v]) => ({ sport, ...v }))
        .sort((a, b) => b.minutes - a.minutes),
    });
  }, []);

  async function handleGenerateReport() {
    setReportLoading(true);
    setError(null);
    try {
      const garmin = getGarminData();
      const equipment = getEquipment();
      const assignments = getActivityAssignments();
      const statsActivities = garmin ? filterStatsActivities(garmin.activities, equipment, assignments) : [];

      const restingHR = garmin?.health?.restingHR || 55;
      const weeklyTRIMP = getWeeklyTRIMPTotals(statsActivities, restingHR, 6);

      const raceDate = getActiveRaceDate();
      const currentPhase = getCurrentPhase(raceDate);
      const daysUntilRace = getDaysUntilRace(raceDate);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const cutoff = sevenDaysAgo.toISOString().split('T')[0];
      const recentCheckIns = JSON.parse(localStorage.getItem('tricoach_checkins') || '[]')
        .filter((c: { date: string }) => c.date >= cutoff);
      const recent = statsActivities.filter((a) => a.date >= cutoff);
      const totalVolumeMinutes = recent.reduce((s, a) => s + a.durationMinutes, 0);
      const totalVolumeKm = recent.reduce((s, a) => s + a.distanceKm, 0);

      // Plan-adherentie over de afgelopen 7 dagen (archief = volledige historie;
      // gepland-per-dag bevroren zodat een schemawissel de historie niet herschrijft)
      const archiveStats = filterStatsActivities(getActivityArchive(), equipment, assignments);
      const adherence = computeWeekAdherence(recordPlannedDays(), archiveStats, zonesForSport);

      const res = await fetch('/api/weekly-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weeklyTRIMP,
          checkIns: recentCheckIns,
          currentPhase: currentPhase.label,
          daysUntilRace,
          totalVolumeMinutes,
          totalVolumeKm,
          weeklyNutrition: getRecentNutritionLogs(7),
          adherence: adherence
            ? {
                plannedCount: adherence.plannedCount,
                completedCount: adherence.completedCount,
                completionPct: adherence.completionPct,
                avgMatchScore: adherence.avgMatchScore,
                missed: adherence.days.flatMap(d =>
                  d.planned.filter(p => !p.done).map(p => `${d.dayLabel}: ${p.session.sport} ${p.session.type}`)
                ),
              }
            : null,
          raceContext: buildRaceContextText(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setWeeklyReport(data.report);
      saveWeeklyReport({ generatedAt: new Date().toISOString(), summary: data.report });
    } catch (e) {
      console.error('Weekrapport fout:', e);
      setError('Kon weekrapport niet genereren. Probeer het opnieuw.');
    } finally {
      setReportLoading(false);
    }
  }

  return (
    <div className="px-5 pt-2 pb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-white">Weekrapport</h2>
        {isMonday && !weeklyReport && (
          <span className="text-xs bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded-full font-medium">Nieuw</span>
        )}
      </div>

      {/* Data van de afgelopen 7 dagen */}
      {weekStats && (
        <div className="bg-[#0d0d0f] rounded-3xl border border-white/5 p-4 mb-3">
          <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">Afgelopen 7 dagen</p>
          <div className="grid grid-cols-4 gap-px rounded-xl overflow-hidden bg-white/5">
            {[
              { label: 'Trainingen', value: `${weekStats.count}` },
              { label: 'Tijd', value: formatDuration(weekStats.minutes) },
              { label: 'Afstand', value: `${Math.round(weekStats.km * 10) / 10} km` },
              { label: 'TRIMP', value: `${weekStats.trimp}` },
            ].map((stat) => (
              <div key={stat.label} className="bg-[#0d0d0f] p-2.5 text-center">
                <p className="text-gray-500 text-[10px] uppercase tracking-wide">{stat.label}</p>
                <p className="text-gray-100 text-sm font-semibold mt-0.5 tabular-nums">{stat.value}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-2">
            {weekStats.perSport.map((s) => (
              <div key={s.sport} className="flex items-center gap-3">
                <SportIcon sport={s.sport} size="sm" />
                <p className="flex-1 text-sm text-gray-300 font-medium">{SPORT_LABEL[s.sport] || s.sport}</p>
                <p className="text-sm text-gray-400 tabular-nums">
                  {s.km > 0 ? `${Math.round(s.km * 10) / 10} km · ` : ''}{formatDuration(s.minutes)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-[#0d0d0f] rounded-3xl border border-white/5 p-4">
        {weeklyReport ? (
          <p className="text-sm text-gray-300 leading-relaxed">{weeklyReport}</p>
        ) : (
          <p className="text-sm text-gray-500">Nog geen rapport gegenereerd voor deze week.</p>
        )}
        {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
        <button
          onClick={handleGenerateReport}
          disabled={reportLoading}
          className="mt-3 w-full py-3 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-all"
        >
          {reportLoading ? 'Rapport genereren...' : weeklyReport ? 'Rapport vernieuwen' : 'Genereer rapport'}
        </button>
      </div>
    </div>
  );
}
