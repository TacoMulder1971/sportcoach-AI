'use client';

import { useState } from 'react';

interface DataPoint {
  label: string;
  value: number;
}

interface TrendLineChartProps {
  data: DataPoint[];
  color: string;
  unit: string;
  title: string;
  invertY?: boolean;
}

interface Tooltip {
  x: number;
  y: number;
  label: string;
  value: number;
}

export default function TrendLineChart({ data, color, unit, title, invertY = false }: TrendLineChartProps) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  const validData = data.filter(d => d.value > 0);
  if (validData.length < 2) return null;

  const W = 300;
  const H = 80;
  const padLeft = 36;
  const padRight = 8;
  const padTop = 8;
  const padBottom = 20;
  const chartW = W - padLeft - padRight;
  const chartH = H - padTop - padBottom;

  const values = validData.map(d => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  function xOf(i: number) {
    return padLeft + (i / (validData.length - 1)) * chartW;
  }

  function yOf(v: number) {
    const norm = (v - minVal) / range;
    return padTop + (invertY ? norm : 1 - norm) * chartH;
  }

  const points = validData.map((d, i) => `${xOf(i)},${yOf(d.value)}`).join(' ');
  const lastVal = validData[validData.length - 1].value;

  // Vind dichtstbijzijnde datapunt op basis van muispositie
  function getNearestPoint(divX: number, divWidth: number): DataPoint | null {
    if (validData.length < 2) return null;
    const svgX = (divX / divWidth) * W;
    // Bereken x-positie van elk punt en vind de dichtstbijzijnde
    let best: DataPoint | null = null;
    let bestDist = Infinity;
    validData.forEach((d, i) => {
      const px = xOf(i);
      const dist = Math.abs(svgX - px);
      if (dist < bestDist) {
        bestDist = dist;
        best = d;
      }
    });
    return best;
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pt = getNearestPoint(x, rect.width);
    if (pt) setTooltip({ x, y, label: pt.label, value: pt.value });
    else setTooltip(null);
  }

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 mb-1">{title}</p>
      <div
        className="relative"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
        onTouchStart={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const touch = e.touches[0];
          const x = touch.clientX - rect.left;
          const y = touch.clientY - rect.top;
          const pt = getNearestPoint(x, rect.width);
          if (pt) setTooltip({ x, y, label: pt.label, value: pt.value });
          setTimeout(() => setTooltip(null), 1800);
        }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="overflow-visible">
          {/* Y-as referentielijnen */}
          {[0, 0.5, 1].map((frac) => {
            const y = padTop + frac * chartH;
            const val = invertY ? minVal + (1 - frac) * range : minVal + frac * range;
            return (
              <g key={frac}>
                <line x1={padLeft} y1={y} x2={W - padRight} y2={y} stroke="#e5e7eb" strokeWidth={0.5} />
                <text x={padLeft - 3} y={y + 3.5} textAnchor="end" fontSize={7} fill="#9ca3af">
                  {Math.round(val)}
                </text>
              </g>
            );
          })}

          {/* Lijn */}
          <polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Punten — gehovered punt groter */}
          {validData.map((d, i) => {
            const isHovered = tooltip?.label === d.label;
            return (
              <circle
                key={i}
                cx={xOf(i)} cy={yOf(d.value)}
                r={isHovered ? 4 : 2.5}
                fill={color}
                style={{ transition: 'r 0.1s' }}
              />
            );
          })}

          {/* X-as labels */}
          {validData.map((d, i) => {
            if (validData.length > 5 && i % 2 !== 0) return null;
            return (
              <text key={i} x={xOf(i)} y={H - 4} textAnchor="middle" fontSize={7} fill="#9ca3af">
                {d.label}
              </text>
            );
          })}

          {/* Huidige waarde rechtsboven */}
          <text x={W - padRight} y={padTop - 1} textAnchor="end" fontSize={8} fontWeight="bold" fill={color}>
            {lastVal % 1 === 0 ? lastVal : lastVal.toFixed(1)} {unit}
          </text>
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute z-10 pointer-events-none"
            style={{ left: tooltip.x, top: tooltip.y - 8, transform: 'translate(-50%, -100%)' }}
          >
            <div className="bg-gray-800 text-white text-xs rounded-lg px-2.5 py-1.5 shadow-lg whitespace-nowrap">
              <span className="font-semibold">{tooltip.value % 1 === 0 ? tooltip.value : tooltip.value.toFixed(1)} {unit}</span>
              <span className="text-gray-400 ml-1.5">· {tooltip.label}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
