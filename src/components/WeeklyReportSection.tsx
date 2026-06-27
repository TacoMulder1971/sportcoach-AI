'use client';

import { useEffect, useState } from 'react';
import { getGarminData, getEquipment, getActivityAssignments, getActiveRaceDate, buildRaceContextText, getRecentNutritionLogs, getWeeklyReport, saveWeeklyReport } from '@/lib/storage';
import { filterStatsActivities } from '@/lib/equipment';
import { getWeeklyTRIMPTotals } from '@/lib/training-load';
import { getCurrentPhase, getDaysUntilRace } from '@/lib/periodization';

export default function WeeklyReportSection() {
  const [weeklyReport, setWeeklyReport] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMonday = new Date().getDay() === 1;

  useEffect(() => {
    const cached = getWeeklyReport();
    if (cached) setWeeklyReport(cached.summary);
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
