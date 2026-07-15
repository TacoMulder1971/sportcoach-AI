'use client';

import { WeekAdherence } from '@/lib/training-load';

// Kleurenschaal voor de dag-blokjes: 0% = rood, ~50% = amber, 100% = groen.
function dayScaleColor(score: number): string {
  const hue = Math.round((score / 100) * 120);
  return `hsl(${hue} 70% 40%)`;
}

/**
 * De "Volgens plan"-kaart: weekpercentage + per dag (ma–zo) een blokje op een
 * rood→groen kleurenschaal met de dag-score. Gedeeld door Home en Data →
 * Overzicht zodat beide weergaven identiek blijven.
 */
export default function AdherenceCard({ adherence }: { adherence: WeekAdherence }) {
  return (
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

      {/* Per dag: blokje op kleurenschaal (rood 0% → groen 100%) */}
      <div className="grid grid-cols-7 gap-1 mt-4">
        {adherence.days.map((d) => (
          <div key={d.date} className="text-center">
            <p className="text-[10px] text-gray-500 mb-1">{d.dayLabel.split(' ')[0]}</p>
            {d.dayScore === null ? (
              <div
                className="h-6 rounded-lg bg-white/5 flex items-center justify-center text-xs text-gray-600"
                title={d.hasPlan ? 'geen meetbare sessie gepland' : 'geen schema actief'}
              >
                —
              </div>
            ) : (
              <div
                className="h-6 rounded-lg flex items-center justify-center text-[10px] font-bold text-white"
                style={{ backgroundColor: dayScaleColor(d.dayScore) }}
                title={d.restDay
                  ? 'rustdag · volgens plan'
                  : d.planned
                      .map((p) => `${p.session.sport} ${p.session.type}${p.done ? ` · uitvoering ${p.matchScore}%` : ' · gemist'}`)
                      .join('\n')}
              >
                {d.restDay ? 'rust' : `${d.dayScore}%`}
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="text-[10px] text-gray-500 mt-2">
        Kleur per dag: groen = volgens plan, rood = gemist. Rustdag telt als volgens plan; krachttraining telt niet mee.
      </p>
    </div>
  );
}
