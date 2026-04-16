'use client';

interface DataPoint {
  label: string;
  value: number;
}

interface TrendLineChartProps {
  data: DataPoint[];
  color: string;
  unit: string;
  title: string;
  invertY?: boolean; // voor tempo: lagere waarde = sneller = beter (toon omgekeerd)
}

export default function TrendLineChart({ data, color, unit, title, invertY = false }: TrendLineChartProps) {
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
    // invertY: lagere waarde (sneller tempo) tekenen we hoger op
    return padTop + (invertY ? norm : 1 - norm) * chartH;
  }

  const points = validData.map((d, i) => `${xOf(i)},${yOf(d.value)}`).join(' ');
  const lastVal = validData[validData.length - 1].value;

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 mb-1">{title}</p>
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

        {/* Punten */}
        {validData.map((d, i) => (
          <circle key={i} cx={xOf(i)} cy={yOf(d.value)} r={2.5} fill={color} />
        ))}

        {/* X-as labels — toon alleen elke 2e als veel data */}
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
    </div>
  );
}
