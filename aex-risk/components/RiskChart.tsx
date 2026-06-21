'use client';

import { PricePoint } from '@/lib/types';

interface RiskChartProps {
  history: PricePoint[];
  sma200: (number | null)[];
}

// Eenvoudige SVG-lijngrafiek: AEX-slotkoers + SMA200.
export default function RiskChart({ history, sma200 }: RiskChartProps) {
  if (history.length < 2) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 text-center text-sm text-gray-400">
        Niet genoeg data voor een grafiek.
      </div>
    );
  }

  const W = 320;
  const H = 120;
  const pad = 4;

  const closes = history.map((p) => p.close);
  const smaVals = sma200.filter((v): v is number => v != null);
  const allVals = [...closes, ...smaVals];
  const min = Math.min(...allVals);
  const max = Math.max(...allVals);
  const range = max - min || 1;

  const x = (i: number) => pad + (i / (history.length - 1)) * (W - 2 * pad);
  const y = (v: number) => pad + (1 - (v - min) / range) * (H - 2 * pad);

  const pricePath = closes
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(' ');

  // SMA200-pad: start bij eerste niet-null waarde.
  let smaPath = '';
  let started = false;
  sma200.forEach((v, i) => {
    if (v == null) return;
    smaPath += `${started ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
    started = true;
  });

  const first = history[0];
  const lastP = history[history.length - 1];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
        <span>AEX · laatste {history.length} handelsdagen</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded bg-blue-500" /> koers
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded bg-gray-400" /> SMA200
          </span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-32 w-full" preserveAspectRatio="none">
        {smaPath && (
          <path d={smaPath.trim()} fill="none" stroke="#9ca3af" strokeWidth={1.2} strokeDasharray="3 2" />
        )}
        <path d={pricePath} fill="none" stroke="#3b82f6" strokeWidth={1.6} />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-gray-400">
        <span>{first.date}</span>
        <span>{lastP.date}</span>
      </div>
    </div>
  );
}
