'use client';

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

/**
 * Duidelijke staafgrafiek voor de wekelijkse aanloop. Staven lopen visueel op
 * naar de wedstrijd (recentere weken zijn voller gekleurd), met de laatste week
 * gemarkeerd. Veel leesbaarder dan een dunne lijngrafiek voor veel weken.
 */
export default function BuildupBarChart({ data, color, unit, title }: BuildupBarChartProps) {
  if (data.filter(d => d.value > 0).length < 2) return null;

  const W = 320;
  const H = 150;
  const padL = 2;
  const padR = 2;
  const padT = 16;
  const padB = 24;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const max = Math.max(...data.map(d => d.value), 1);
  const n = data.length;
  const gap = n > 14 ? 2 : 3;
  const barW = chartW / n - gap;

  // Index van de laatste week met data (= dichtst bij de wedstrijd)
  let lastIdx = 0;
  data.forEach((d, i) => { if (d.value > 0) lastIdx = i; });
  const lastVal = data[lastIdx].value;

  const fmt = (v: number) => (v % 1 === 0 ? `${v}` : v.toFixed(1));

  // X-as labels: ongeveer 4 verspreid
  const labelEvery = Math.max(1, Math.round(n / 4));

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <p className="text-sm font-semibold text-gray-700">{title}</p>
        <p className="text-sm font-bold" style={{ color }}>
          {fmt(lastVal)}{unit && ` ${unit}`}
        </p>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%">
        {/* Horizontale referentielijn (max) */}
        <line x1={padL} y1={padT} x2={W - padR} y2={padT} stroke="#f1f5f9" strokeWidth={1} />
        <text x={padL} y={padT - 4} fontSize={8} fill="#cbd5e1">{fmt(max)}{unit && ` ${unit}`}</text>
        {/* Baseline */}
        <line x1={padL} y1={padT + chartH} x2={W - padR} y2={padT + chartH} stroke="#e5e7eb" strokeWidth={1} />

        {data.map((d, i) => {
          const h = (d.value / max) * chartH;
          const x = padL + i * (barW + gap);
          const y = padT + chartH - h;
          const isLast = i === lastIdx;
          // Recentere weken voller gekleurd (opbouw naar de wedstrijd)
          const opacity = isLast ? 1 : 0.3 + 0.55 * (i / Math.max(1, n - 1));
          return (
            <g key={i}>
              <rect
                x={x} y={y} width={Math.max(1, barW)} height={Math.max(0, h)}
                rx={2} fill={color} opacity={opacity}
              />
              {isLast && h > 0 && (
                <circle cx={x + barW / 2} cy={y - 3} r={1.6} fill={color} />
              )}
            </g>
          );
        })}

        {/* X-as labels */}
        {data.map((d, i) => {
          if (i % labelEvery !== 0 && i !== n - 1) return null;
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
