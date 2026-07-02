'use client';

import { useState } from 'react';
import { AexRisk, RISK_META } from '@/lib/types';

interface RiskCardProps {
  risk: AexRisk | null;
  loading?: boolean;
  error?: string | null;
}

function fmtPct(p: number): string {
  const sign = p > 0 ? '+' : '';
  return `${sign}${p.toFixed(2).replace('.', ',')}%`;
}

export default function RiskCard({ risk, loading, error }: RiskCardProps) {
  const [open, setOpen] = useState(false);

  if (loading) {
    return (
      <div className="animate-pulse rounded-2xl border border-gray-200 bg-white p-5">
        <div className="mb-3 h-6 w-32 rounded bg-gray-100" />
        <div className="h-16 rounded bg-gray-100" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-center text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (!risk) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5 text-center text-sm text-gray-400">
        Geen risicodata beschikbaar.
      </div>
    );
  }

  const meta = RISK_META[risk.riskLevel];
  const dayColor = risk.changeDayPercent >= 0 ? 'text-green-600' : 'text-red-600';

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="flex items-center gap-4">
        {/* Gauge-cirkel */}
        <div className={`flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-full ${meta.color}`}>
          <div className="text-center text-white">
            <div className="text-2xl font-bold leading-none">{risk.riskScore}</div>
            <div className="text-[10px] opacity-90">/100</div>
          </div>
        </div>
        <div className="flex-1">
          <p className={`text-lg font-bold ${meta.text}`}>{meta.label}</p>
          <p className="text-sm text-gray-500">
            AEX {risk.aexClose.toFixed(2).replace('.', ',')}{' '}
            <span className={dayColor}>{fmtPct(risk.changeDayPercent)}</span> vandaag
          </p>
          <p className="text-xs text-gray-400">
            week {fmtPct(risk.changeWeekPercent)} · {risk.date}
          </p>
        </div>
      </div>

      <button
        onClick={() => setOpen((o) => !o)}
        className="mt-4 w-full rounded-lg bg-gray-50 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
      >
        {open ? 'Verberg signalen' : 'Bekijk signalen'}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {risk.signals.map((s) => {
            const sm = RISK_META[s.level];
            return (
              <div key={s.key} className="rounded-lg border border-gray-100 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">{s.label}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-600">{s.value}</span>
                    <span className={`h-2.5 w-2.5 rounded-full ${sm.color}`} />
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">{s.explanation}</p>
              </div>
            );
          })}
          <p className="pt-1 text-right text-[10px] text-gray-300">bron: {risk.source}</p>
        </div>
      )}
    </div>
  );
}
