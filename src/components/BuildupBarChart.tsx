'use client';

interface DataPoint {
  label: string;
  value: number;
}

interface BuildupBarChartProps {
  data: DataPoint[];
  color: string;
  unit: string;   // alleen voor de titel; de as toont kale getallen
  title: string;
}

/**
 * Duidelijke staafgrafiek voor de wekelijkse aanloop. Staven lopen visueel op
 * naar de wedstrijd (recentere weken zijn voller gekleurd), met de laatste week
 * gemarkeerd. Een leesbare verticale as (0 / midden / max) links.
 */
export default function BuildupBarChart({ data, color, title }: BuildupBarChartProps) {
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

  // Index van de laatste week met data (= dichtst bij de wedstrijd)
  let lastIdx = 0;
  data.forEach((d, i) => { if (d.value > 0) lastIdx = i; });

  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 mb-1">{title}</p>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%">
        {/* Verticale as: 0 / midden / max */}
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
          // Recentere weken voller gekleurd (opbouw naar de wedstrijd)
          const opacity = isLast ? 1 : 0.3 + 0.55 * (i / Math.max(1, n - 1));
          return (
            <rect
              key={i}
              x={x} y={y} width={Math.max(1, barW)} height={Math.max(0, h)}
              rx={2} fill={color} opacity={opacity}
            />
          );
        })}

        {/* X-as labels: ~4 verspreid + laatste */}
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
    </div>
  );
}
