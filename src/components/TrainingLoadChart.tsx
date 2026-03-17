'use client';

import { useState } from 'react';

interface DayData {
  date: string;
  trimp: number;
  zone: 'laag' | 'optimaal' | 'hoog' | 'overbelast';
}

interface TrainingLoadChartProps {
  data: DayData[];
}

const ZONE_COLORS: Record<string, string> = {
  laag: '#60a5fa',      // blue-400
  optimaal: '#22c55e',  // green-500
  hoog: '#f97316',      // orange-500
  overbelast: '#ef4444', // red-500
};

const CHART_W = 350;
const CHART_H = 120;
const BAR_W = 6;
const BAR_GAP = 2;
const PADDING_LEFT = 4;
const PADDING_BOTTOM = 18;
const INNER_H = CHART_H - PADDING_BOTTOM;

export default function TrainingLoadChart({ data }: TrainingLoadChartProps) {
  const [tooltip, setTooltip] = useState<{ date: string; trimp: number } | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-sm text-gray-400">
        Geen activiteiten gevonden
      </div>
    );
  }

  const maxTrimp = Math.max(...data.map((d) => d.trimp), 50);

  const totalBars = data.length;
  const totalWidth = totalBars * (BAR_W + BAR_GAP) - BAR_GAP + PADDING_LEFT * 2;
  const chartWidth = Math.max(totalWidth, CHART_W);

  const getBarHeight = (trimp: number) => {
    if (trimp === 0) return 2;
    return Math.max(3, Math.round((trimp / maxTrimp) * INNER_H));
  };

  // Maandag-indices voor labels
  const mondayIndices: number[] = [];
  data.forEach((d, i) => {
    const date = new Date(d.date);
    if (date.getDay() === 1) mondayIndices.push(i);
  });

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${chartWidth} ${CHART_H}`}
        width="100%"
        style={{ minWidth: `${Math.min(chartWidth, 350)}px` }}
      >
        {/* Referentielijn op ~50% (optimaal/hoog grens) */}
        <line
          x1={PADDING_LEFT}
          y1={INNER_H - Math.round((50 / maxTrimp) * INNER_H)}
          x2={chartWidth - PADDING_LEFT}
          y2={INNER_H - Math.round((50 / maxTrimp) * INNER_H)}
          stroke="#e5e7eb"
          strokeWidth="1"
          strokeDasharray="3,3"
        />

        {/* Weekscheiders + balken */}
        {data.map((d, i) => {
          const x = PADDING_LEFT + i * (BAR_W + BAR_GAP);
          const barH = getBarHeight(d.trimp);
          const y = INNER_H - barH;
          const color = ZONE_COLORS[d.zone];
          const isMonday = new Date(d.date).getDay() === 1;

          return (
            <g key={d.date}>
              {/* Weekscheidingslijn op maandag */}
              {isMonday && i > 0 && (
                <line
                  x1={x - BAR_GAP / 2 - 1}
                  y1={0}
                  x2={x - BAR_GAP / 2 - 1}
                  y2={INNER_H}
                  stroke="#f3f4f6"
                  strokeWidth="1"
                />
              )}

              {/* Balk */}
              <rect
                x={x}
                y={y}
                width={BAR_W}
                height={barH}
                fill={color}
                rx={1}
                opacity={d.trimp === 0 ? 0.3 : 0.85}
                onMouseEnter={() => setTooltip({ date: d.date, trimp: d.trimp })}
                onMouseLeave={() => setTooltip(null)}
                style={{ cursor: 'default' }}
              />
            </g>
          );
        })}

        {/* Maandag-datumslabels op x-as */}
        {mondayIndices.map((i) => {
          const d = data[i];
          const x = PADDING_LEFT + i * (BAR_W + BAR_GAP) + BAR_W / 2;
          const date = new Date(d.date);
          const label = date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
          return (
            <text
              key={d.date}
              x={x}
              y={CHART_H - 4}
              fontSize="8"
              fill="#9ca3af"
              textAnchor="middle"
            >
              {label}
            </text>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div className="text-xs text-gray-600 text-center mt-1">
          {new Date(tooltip.date).toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' })}
          {': '}
          <span className="font-medium">{tooltip.trimp} TRIMP</span>
        </div>
      )}
    </div>
  );
}
