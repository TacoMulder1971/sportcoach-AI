'use client';

import { useState } from 'react';

export interface WeeklyVolumeData {
  label: string;   // weeknummer/datum-label
  zwemmen: number;
  fietsen: number;
  hardlopen: number;
}

interface Tooltip {
  x: number;
  y: number;
  label: string;
  zwemmen: number;
  fietsen: number;
  hardlopen: number;
  total: number;
}

/**
 * Gestapeld staafdiagram: wekelijks trainingsvolume per sport (in minuten).
 * Zwemmen = blauw, Fietsen = groen, Hardlopen = oranje.
 * Hover/touch toont tooltip met detail per sport.
 */
export default function WeeklyVolumeChart({ data }: { data: WeeklyVolumeData[] }) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  const validData = data.filter(d => d.zwemmen + d.fietsen + d.hardlopen > 0);
  if (validData.length < 2) return null;

  const W = 320;
  const H = 160;
  const padL = 32;
  const padR = 6;
  const padT = 14;
  const padB = 22;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const n = validData.length;
  const gap = n > 14 ? 2 : 3;
  const barW = chartW / n - gap;

  const maxTotal = Math.max(...validData.map(d => d.zwemmen + d.fietsen + d.hardlopen), 1);

  const COLORS = {
    zwemmen: '#3b82f6',
    fietsen: '#22c55e',
    hardlopen: '#f97316',
  };

  function fmt(min: number) {
    if (min < 60) return `${min}m`;
    return `${Math.floor(min / 60)}u${min % 60 > 0 ? `${min % 60}m` : ''}`;
  }

  function getBarAtX(divX: number, divWidth: number): WeeklyVolumeData | null {
    const svgX = (divX / divWidth) * W;
    const relX = svgX - padL;
    const idx = Math.floor(relX / (barW + gap));
    if (idx >= 0 && idx < n) return validData[idx];
    return null;
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const bar = getBarAtX(x, rect.width);
    if (bar) {
      setTooltip({ x, y, label: bar.label, zwemmen: bar.zwemmen, fietsen: bar.fietsen, hardlopen: bar.hardlopen, total: bar.zwemmen + bar.fietsen + bar.hardlopen });
    } else {
      setTooltip(null);
    }
  }

  function handleTouch(e: React.TouchEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const bar = getBarAtX(x, rect.width);
    if (bar) {
      setTooltip({ x, y, label: bar.label, zwemmen: bar.zwemmen, fietsen: bar.fietsen, hardlopen: bar.hardlopen, total: bar.zwemmen + bar.fietsen + bar.hardlopen });
    }
    setTimeout(() => setTooltip(null), 2000);
  }

  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 mb-1">Wekelijks volume per sport (minuten)</p>
      <div
        className="relative"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
        onTouchStart={handleTouch}
      >
        <svg viewBox={`0 0 ${W} ${H}`} width="100%">
          {/* Referentielijnen */}
          {[0, 0.5, 1].map((frac) => {
            const y = padT + (1 - frac) * chartH;
            const val = Math.round(maxTotal * frac);
            return (
              <g key={frac}>
                <line x1={padL} y1={y} x2={W - padR} y2={y} stroke={frac === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)'} strokeWidth={1} />
                <text x={padL - 4} y={y + 3.5} textAnchor="end" fontSize={9} fill="#9ca3af">{val}</text>
              </g>
            );
          })}

          {/* Gestapelde staven */}
          {validData.map((d, i) => {
            const total = d.zwemmen + d.fietsen + d.hardlopen;
            const x = padL + i * (barW + gap);
            const isHovered = tooltip?.label === d.label;
            const baseOpacity = 0.4 + 0.6 * (i / Math.max(1, n - 1));
            const opacity = isHovered ? 1 : baseOpacity;

            let yOffset = padT + chartH; // start onderin

            const segments: { sport: keyof typeof COLORS; min: number }[] = [
              { sport: 'zwemmen', min: d.zwemmen },
              { sport: 'fietsen', min: d.fietsen },
              { sport: 'hardlopen', min: d.hardlopen },
            ];

            return (
              <g key={i} opacity={opacity} style={{ transition: 'opacity 0.1s' }}>
                {segments.map(({ sport, min }) => {
                  if (min <= 0) return null;
                  const h = (min / maxTotal) * chartH;
                  yOffset -= h;
                  return (
                    <rect
                      key={sport}
                      x={x} y={yOffset}
                      width={Math.max(1, barW)} height={h}
                      rx={i === 0 ? 0 : 0}
                      fill={COLORS[sport]}
                    />
                  );
                })}
                {/* Afgeronde bovenste hoek */}
                {total > 0 && (
                  <rect
                    x={x}
                    y={padT + chartH - (total / maxTotal) * chartH}
                    width={Math.max(1, barW)}
                    height={Math.min(4, (total / maxTotal) * chartH)}
                    rx={2}
                    fill={d.hardlopen > 0 ? COLORS.hardlopen : d.fietsen > 0 ? COLORS.fietsen : COLORS.zwemmen}
                  />
                )}
              </g>
            );
          })}

          {/* X-as labels */}
          {validData.map((d, i) => {
            const every = Math.max(1, Math.round(n / 4));
            if (i % every !== 0 && i !== n - 1) return null;
            const x = padL + i * (barW + gap) + barW / 2;
            return (
              <text key={i} x={x} y={H - 5} textAnchor="middle" fontSize={8} fill="#94a3b8">
                {d.label}
              </text>
            );
          })}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute z-10 pointer-events-none"
            style={{ left: tooltip.x, top: tooltip.y - 8, transform: 'translate(-50%, -100%)' }}
          >
            <div className="bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg whitespace-nowrap">
              <p className="font-semibold text-gray-200 mb-1">{tooltip.label} · {fmt(tooltip.total)}</p>
              {tooltip.zwemmen > 0 && <p><span className="inline-block w-2 h-2 rounded-sm bg-blue-400 mr-1.5" />{fmt(tooltip.zwemmen)} zwemmen</p>}
              {tooltip.fietsen > 0 && <p><span className="inline-block w-2 h-2 rounded-sm bg-green-400 mr-1.5" />{fmt(tooltip.fietsen)} fietsen</p>}
              {tooltip.hardlopen > 0 && <p><span className="inline-block w-2 h-2 rounded-sm bg-orange-400 mr-1.5" />{fmt(tooltip.hardlopen)} hardlopen</p>}
            </div>
          </div>
        )}
      </div>

      {/* Legende */}
      <div className="flex gap-4 mt-1">
        {([['zwemmen', '#3b82f6'], ['fietsen', '#22c55e'], ['hardlopen', '#f97316']] as const).map(([sport, color]) => (
          <div key={sport} className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
            <span className="text-xs text-gray-400 capitalize">{sport}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
