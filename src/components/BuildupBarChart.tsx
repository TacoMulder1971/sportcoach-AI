'use client';

import { useState } from 'react';

interface DataPoint {
  label: string;
  value: number;
}

interface BuildupBarChartProps {
  data: DataPoint[];
  color: string;
  unit: string;
  title: string;
}

interface Tooltip {
  x: number;   // px relatief aan wrapper
  y: number;   // px relatief aan wrapper
  label: string;
  value: number;
}

/**
 * Duidelijke staafgrafiek voor de wekelijkse aanloop. Staven lopen visueel op
 * naar de wedstrijd (recentere weken zijn voller gekleurd), met de laatste week
 * gemarkeerd. Een leesbare verticale as (0 / midden / max) links.
 * Hover/touch toont een tooltip met de exacte waarde.
 */
export default function BuildupBarChart({ data, color, title, unit }: BuildupBarChartProps) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  if (data.filter(d => d.value > 0).length < 2) return null;

  const W = 320;
  const H = 150;
  const padL = 30;
  const padR = 6;
  const padT = 12;
  const padB = 22;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const max = Math.max(...data.map(d => d.value), 1);
  const n = data.length;
  const gap = n > 14 ? 2 : 3;
  const barW = chartW / n - gap;

  let lastIdx = 0;
  data.forEach((d, i) => { if (d.value > 0) lastIdx = i; });

  // Bereken welke staaf de muis raakt op basis van x-positie in de div
  function getBarAtX(divX: number, divWidth: number): DataPoint | null {
    const svgX = (divX / divWidth) * W;
    const relX = svgX - padL;
    const idx = Math.floor(relX / (barW + gap));
    if (idx >= 0 && idx < n && data[idx].value > 0) return data[idx];
    return null;
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const bar = getBarAtX(x, rect.width);
    if (bar) setTooltip({ x, y, label: bar.label, value: bar.value });
    else setTooltip(null);
  }

  function handleTouch(e: React.TouchEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const bar = getBarAtX(x, rect.width);
    if (bar) setTooltip({ x, y, label: bar.label, value: bar.value });
    setTimeout(() => setTooltip(null), 1800);
  }

  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 mb-1">{title}</p>
      <div
        className="relative"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
        onTouchStart={handleTouch}
      >
        <svg viewBox={`0 0 ${W} ${H}`} width="100%">
          {/* Verticale as */}
          {[0, 0.5, 1].map((frac) => {
            const y = padT + (1 - frac) * chartH;
            const val = Math.round(max * frac);
            return (
              <g key={frac}>
                <line x1={padL} y1={y} x2={W - padR} y2={y} stroke={frac === 0 ? '#e5e7eb' : '#f1f5f9'} strokeWidth={1} />
                <text x={padL - 6} y={y + 3.5} textAnchor="end" fontSize={10} fill="#64748b">{val}</text>
              </g>
            );
          })}

          {data.map((d, i) => {
            const h = (d.value / max) * chartH;
            const x = padL + i * (barW + gap);
            const y = padT + chartH - h;
            const isLast = i === lastIdx;
            const opacity = isLast ? 1 : 0.3 + 0.55 * (i / Math.max(1, n - 1));
            const isHovered = tooltip?.label === d.label;
            return (
              <rect
                key={i}
                x={x} y={y} width={Math.max(1, barW)} height={Math.max(0, h)}
                rx={2} fill={color}
                opacity={isHovered ? 1 : opacity}
                style={{ transition: 'opacity 0.1s' }}
              />
            );
          })}

          {/* X-as labels */}
          {data.map((d, i) => {
            const every = Math.max(1, Math.round(n / 4));
            if (i % every !== 0 && i !== n - 1) return null;
            const x = padL + i * (barW + gap) + barW / 2;
            return (
              <text key={i} x={x} y={H - 6} textAnchor="middle" fontSize={8} fill="#94a3b8">
                {d.label}
              </text>
            );
          })}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute z-10 pointer-events-none"
            style={{
              left: tooltip.x,
              top: tooltip.y - 8,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="bg-gray-800 text-white text-xs rounded-lg px-2.5 py-1.5 shadow-lg whitespace-nowrap">
              <span className="font-semibold">{tooltip.value} {unit}</span>
              <span className="text-gray-400 ml-1.5">· {tooltip.label}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
