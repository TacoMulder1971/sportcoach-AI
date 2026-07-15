'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getGarminData, getEquipment, getActivityAssignments, getActivityArchive,
  getNutritionLogs, getNutritionReport, saveNutritionReport, getProfile,
  buildRaceContextText,
} from '@/lib/storage';
import { filterStatsActivities } from '@/lib/equipment';
import { athleteProfilePayload } from '@/lib/athlete';
import { buildNutritionWeekSummary, NutritionWeekSummary } from '@/lib/nutrition';

function fmtBalance(kcal: number): string {
  return `${kcal > 0 ? '+' : ''}${kcal}`;
}

export default function NutritionReportSection() {
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [week, setWeek] = useState<NutritionWeekSummary | null>(null);

  useEffect(() => {
    const cached = getNutritionReport();
    if (cached) setReport(cached.summary);

    const garmin = getGarminData();
    const archive = getActivityArchive();
    const activities = filterStatsActivities(
      archive.length > 0 ? archive : garmin?.activities ?? [],
      getEquipment(),
      getActivityAssignments()
    );
    setWeek(buildNutritionWeekSummary(getNutritionLogs(), activities, getProfile()));
  }, []);

  async function handleGenerate() {
    if (!week || week.daysLogged === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/nutrition-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week,
          raceContext: buildRaceContextText(),
          athleteProfile: athleteProfilePayload(getProfile()),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReport(data.report);
      saveNutritionReport({ generatedAt: new Date().toISOString(), summary: data.report });
    } catch (e) {
      console.error('Voedingsrapport fout:', e);
      setError('Kon voedingsrapport niet genereren. Probeer het opnieuw.');
    } finally {
      setLoading(false);
    }
  }

  if (!week) return null;
  const hasNeed = week.avgNeedKcal !== null;
  const maxKcal = Math.max(
    ...week.days.map(d => Math.max(d.intake?.calories ?? 0, d.estimatedNeedKcal ?? 0)),
    1
  );

  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-3">Weekrapport voeding</h2>

      {/* Inname vs. behoefte per dag (laatste 7 volle dagen) */}
      <div className="bg-[#0d0d0f] rounded-3xl border border-white/5 p-4 mb-3">
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-3">
          Inname vs. behoefte · vorige 7 dagen
        </p>

        <div className="flex items-end justify-between gap-1.5 h-28 mb-1">
          {week.days.map(d => {
            const intakeH = d.intake ? Math.max((d.intake.calories / maxKcal) * 100, 3) : 0;
            const needH = d.estimatedNeedKcal ? Math.max((d.estimatedNeedKcal / maxKcal) * 100, 3) : 0;
            const shortfall = d.balanceKcal !== null && d.balanceKcal < -400;
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full gap-0" title={
                d.intake
                  ? `${d.intake.calories} kcal gegeten${d.estimatedNeedKcal ? ` · behoefte ~${d.estimatedNeedKcal}` : ''}${d.trainingMinutes > 0 ? ` · ${d.trainingMinutes} min training` : ''}`
                  : 'niet gelogd'
              }>
                <div className="w-full flex items-end justify-center gap-0.5 flex-1">
                  {/* Inname-staaf */}
                  <div
                    className={`w-2.5 rounded-t ${d.intake ? (shortfall ? 'bg-red-500' : 'bg-green-500') : 'bg-white/10'}`}
                    style={{ height: d.intake ? `${intakeH}%` : '3%' }}
                  />
                  {/* Behoefte-staaf (referentie) */}
                  {hasNeed && (
                    <div className="w-2.5 rounded-t bg-white/15" style={{ height: `${needH}%` }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between gap-1.5">
          {week.days.map(d => (
            <div key={d.date} className="flex-1 text-center">
              <p className="text-[10px] text-gray-500">{d.dayLabel}</p>
              {d.trainingMinutes > 0 && <p className="text-[9px] text-blue-400 leading-tight">●</p>}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500 inline-block" /> gegeten</span>
          {hasNeed && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-white/15 inline-block" /> behoefte</span>}
          <span className="flex items-center gap-1"><span className="text-blue-400">●</span> trainingsdag</span>
        </div>

        {/* Weekcijfers */}
        <div className="grid grid-cols-4 gap-px rounded-xl overflow-hidden bg-white/5 mt-3">
          {[
            { label: 'Gem. inname', value: week.avgIntakeKcal !== null ? `${week.avgIntakeKcal}` : '–', unit: 'kcal' },
            { label: 'Behoefte', value: week.avgNeedKcal !== null ? `~${week.avgNeedKcal}` : '–', unit: 'kcal' },
            {
              label: 'Balans',
              value: week.avgBalanceKcal !== null ? fmtBalance(week.avgBalanceKcal) : '–',
              unit: 'kcal',
              color: week.avgBalanceKcal !== null
                ? (week.avgBalanceKcal < -400 ? 'text-red-400' : week.avgBalanceKcal < -150 ? 'text-amber-400' : 'text-green-400')
                : undefined,
            },
            { label: 'Eiwit', value: week.proteinPerKg !== null ? `${week.proteinPerKg}` : week.avgProteinG !== null ? `${week.avgProteinG}g` : '–', unit: week.proteinPerKg !== null ? 'g/kg' : 'gem.' },
          ].map(stat => (
            <div key={stat.label} className="bg-[#0d0d0f] p-2.5 text-center">
              <p className="text-gray-500 text-[10px] uppercase tracking-wide">{stat.label}</p>
              <p className={`text-sm font-semibold mt-0.5 tabular-nums ${stat.color || 'text-gray-100'}`}>
                {stat.value} <span className="text-[10px] text-gray-500 font-normal">{stat.unit}</span>
              </p>
            </div>
          ))}
        </div>

        {!hasNeed && (
          <Link href="/data?section=instellingen" className="block mt-3 text-xs text-blue-400">
            Vul je gewicht, lengte en geboortejaar in bij Instellingen voor een persoonlijke energiebehoefte →
          </Link>
        )}
      </div>

      {/* AI-rapport */}
      <div className="bg-[#0d0d0f] rounded-3xl border border-white/5 p-4">
        {report ? (
          <p className="text-sm text-gray-300 leading-relaxed">{report}</p>
        ) : (
          <p className="text-sm text-gray-500">
            {week.daysLogged === 0
              ? 'Nog geen gelogde voeding in de afgelopen 7 dagen — synchroniseer eerst met Yazio.'
              : 'Nog geen voedingsrapport voor deze week. De coach beoordeelt of je genoeg eet voor je trainingsbelasting.'}
          </p>
        )}
        {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
        {week.daysLogged > 0 && (
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="mt-3 w-full py-3 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-all"
          >
            {loading ? 'Rapport genereren...' : report ? 'Rapport vernieuwen' : 'Genereer voedingsrapport'}
          </button>
        )}
      </div>
    </section>
  );
}
