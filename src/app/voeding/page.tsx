'use client';

import { useEffect, useState, useRef } from 'react';
import { getNutritionLogs, saveNutritionLogs, parseMFPCsv } from '@/lib/storage';
import { NutritionLog } from '@/lib/types';

const DAY_ABBR = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];

function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function VoedingPage() {
  const [logs, setLogs] = useState<NutritionLog[]>([]);
  const [mfpImportStatus, setMfpImportStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const mfpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLogs(getNutritionLogs().sort((a, b) => b.date.localeCompare(a.date)));
  }, []);

  const last7Days = getLast7Days();
  const logsByDate = new Map(logs.map(l => [l.date, l]));

  const chartData = last7Days.map(date => ({
    date,
    dayAbbr: DAY_ABBR[new Date(date + 'T00:00:00').getDay()],
    calories: logsByDate.get(date)?.calories ?? 0,
  }));

  const maxCalories = Math.max(...chartData.map(d => d.calories), 500);
  const yMax = Math.ceil(maxCalories / 500) * 500;

  const logsWithData = chartData.filter(d => d.calories > 0);
  const avgKcal = logsWithData.length > 0
    ? Math.round(logsWithData.reduce((s, d) => s + d.calories, 0) / logsWithData.length)
    : 0;

  const last7Logs = last7Days.map(d => logsByDate.get(d)).filter(Boolean) as NutritionLog[];
  const avgKH = last7Logs.length > 0
    ? Math.round(last7Logs.reduce((s, l) => s + l.carbsG, 0) / last7Logs.length)
    : 0;
  const avgEiwit = last7Logs.length > 0
    ? Math.round(last7Logs.reduce((s, l) => s + l.proteinG, 0) / last7Logs.length)
    : 0;

  const recentLogs = logs.slice(0, 14);

  const CHART_W = 350;
  const CHART_H = 140;
  const barAreaH = 100;
  const barAreaTop = 10;
  const barCount = 7;
  const totalBarW = CHART_W;
  const barW = Math.floor(totalBarW / barCount) - 4;
  const barSpacing = Math.floor(totalBarW / barCount);

  return (
    <div className="space-y-5 px-4 pt-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Voeding</h1>
        <p className="text-gray-500 text-sm">MyFitnessPal data</p>
      </div>

      {/* Import card */}
      <div className="bg-white rounded-xl p-4 border border-gray-200 space-y-3">
        <p className="text-sm text-gray-500">
          Exporteer je data uit MyFitnessPal en upload het <strong>Voedingsoverzicht</strong> CSV-bestand.
        </p>
        <button
          onClick={() => mfpInputRef.current?.click()}
          className="w-full py-3 rounded-xl font-semibold text-white bg-green-600 hover:bg-green-700 transition-all text-sm"
        >
          Importeer MyFitnessPal CSV
        </button>
        <input
          ref={mfpInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              try {
                const parsed = parseMFPCsv(reader.result as string);
                if (parsed.length === 0) {
                  setMfpImportStatus({ type: 'error', msg: 'Geen geldige voedingsdata gevonden' });
                } else {
                  const existing = getNutritionLogs().filter(
                    n => !parsed.find(p => p.date === n.date)
                  );
                  saveNutritionLogs([...existing, ...parsed]);
                  setLogs(getNutritionLogs().sort((a, b) => b.date.localeCompare(a.date)));
                  setMfpImportStatus({ type: 'success', msg: `${parsed.length} dag(en) geïmporteerd!` });
                }
              } catch {
                setMfpImportStatus({ type: 'error', msg: 'Fout bij verwerken van het CSV-bestand.' });
              }
              setTimeout(() => setMfpImportStatus(null), 4000);
            };
            reader.readAsText(file);
            e.target.value = '';
          }}
        />
        {mfpImportStatus && (
          <div className={`text-sm p-3 rounded-xl ${
            mfpImportStatus.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
          }`}>
            {mfpImportStatus.msg}
          </div>
        )}
      </div>

      {/* 7-day chart */}
      {logs.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Afgelopen 7 dagen</h2>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} width="100%">
              {chartData.map((d, i) => {
                const barH = yMax > 0 ? Math.round((d.calories / yMax) * barAreaH) : 0;
                const x = i * barSpacing + 2;
                const y = barAreaTop + barAreaH - barH;
                const color = d.calories >= 1800 ? '#16a34a' : d.calories >= 1200 ? '#f97316' : d.calories > 0 ? '#ef4444' : '#e5e7eb';
                return (
                  <g key={d.date}>
                    <rect
                      x={x}
                      y={barH > 0 ? y : barAreaTop + barAreaH - 2}
                      width={barW}
                      height={barH > 0 ? barH : 2}
                      fill={color}
                      rx={3}
                    />
                    {d.calories > 0 && (
                      <text
                        x={x + barW / 2}
                        y={y - 2}
                        textAnchor="middle"
                        fontSize={8}
                        fill="#6b7280"
                      >
                        {d.calories}
                      </text>
                    )}
                    <text
                      x={x + barW / 2}
                      y={CHART_H - 2}
                      textAnchor="middle"
                      fontSize={9}
                      fill="#9ca3af"
                    >
                      {d.dayAbbr}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100 text-center">
              <div>
                <p className="text-xl font-bold text-gray-800">{avgKcal || '–'}</p>
                <p className="text-xs text-gray-500">Gem. kcal</p>
              </div>
              <div>
                <p className="text-xl font-bold text-blue-600">{avgKH || '–'}g</p>
                <p className="text-xs text-gray-500">Gem. KH</p>
              </div>
              <div>
                <p className="text-xl font-bold text-green-600">{avgEiwit || '–'}g</p>
                <p className="text-xs text-gray-500">Gem. eiwit</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Recent logs */}
      {logs.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Historie</h2>
          <div className="space-y-2">
            {recentLogs.map(log => (
              <div key={log.date} className="bg-white rounded-xl p-3 border border-gray-200 flex items-center gap-3">
                <div className="text-sm text-gray-500 w-20 flex-shrink-0">
                  {formatDate(log.date)}
                </div>
                <div className="flex-1 text-center">
                  <span className="text-xl font-bold text-gray-900">{log.calories}</span>
                  <span className="text-sm text-gray-500 ml-1">kcal</span>
                </div>
                <div className="flex gap-1 flex-wrap justify-end">
                  <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{log.carbsG}g KH</span>
                  <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded-full">{log.proteinG}g eiwit</span>
                  <span className="text-xs bg-yellow-50 text-yellow-600 px-2 py-0.5 rounded-full">{log.fatG}g vet</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {logs.length === 0 && (
        <div className="bg-white rounded-xl p-8 border border-gray-200 text-center">
          <p className="text-gray-700 font-medium mb-1">Nog geen voedingsdata</p>
          <p className="text-gray-400 text-sm">Importeer je MyFitnessPal CSV om te beginnen</p>
        </div>
      )}

      <div className="h-4" />
    </div>
  );
}
