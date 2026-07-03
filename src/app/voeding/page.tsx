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
    <div className="bg-black min-h-screen">
      <div className="fixed top-0 inset-x-0 bg-black z-50" style={{ height: 'env(safe-area-inset-top, 0px)' }} />
      <div className="fixed bottom-0 inset-x-0 bg-black z-40" style={{ height: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }} />
      <div className="space-y-5 px-4 pt-6 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Voeding</h1>
        <p className="text-gray-400 text-sm">MyFitnessPal data</p>
      </div>

      {/* Import: mét data een compacte kaart, zonder data één gecombineerde lege staat */}
      <div className="bg-[#0d0d0f] rounded-3xl p-4 border border-white/5 space-y-3">
        {logs.length === 0 && (
          <div className="text-center pt-3">
            <p className="text-3xl mb-2">🥗</p>
            <p className="text-gray-100 font-medium">Nog geen voedingsdata</p>
          </div>
        )}
        <p className={`text-sm text-gray-400 ${logs.length === 0 ? 'text-center' : ''}`}>
          Exporteer je data uit MyFitnessPal en upload het <strong className="text-gray-300">Voedingsoverzicht</strong> CSV-bestand.
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
            mfpImportStatus.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
          }`}>
            {mfpImportStatus.msg}
          </div>
        )}
      </div>

      {/* 7-day chart */}
      {logs.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">Afgelopen 7 dagen</h2>
          <div className="bg-[#0d0d0f] rounded-3xl p-4 border border-white/5">
            <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} width="100%">
              {chartData.map((d, i) => {
                const barH = yMax > 0 ? Math.round((d.calories / yMax) * barAreaH) : 0;
                const x = i * barSpacing + 2;
                const y = barAreaTop + barAreaH - barH;
                const color = d.calories >= 1800 ? '#22c55e' : d.calories >= 1200 ? '#f97316' : d.calories > 0 ? '#ef4444' : 'rgba(255,255,255,0.08)';
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
                        fill="#9ca3af"
                      >
                        {d.calories}
                      </text>
                    )}
                    <text
                      x={x + barW / 2}
                      y={CHART_H - 2}
                      textAnchor="middle"
                      fontSize={9}
                      fill="#6b7280"
                    >
                      {d.dayAbbr}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-white/5 text-center">
              <div>
                <p className="text-xl font-bold text-gray-100">{avgKcal || '–'}</p>
                <p className="text-xs text-gray-500">Gem. kcal</p>
              </div>
              <div>
                <p className="text-xl font-bold text-blue-400">{avgKH || '–'}g</p>
                <p className="text-xs text-gray-500">Gem. KH</p>
              </div>
              <div>
                <p className="text-xl font-bold text-green-400">{avgEiwit || '–'}g</p>
                <p className="text-xs text-gray-500">Gem. eiwit</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Recent logs */}
      {logs.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">Historie</h2>
          <div className="space-y-2">
            {recentLogs.map(log => (
              <div key={log.date} className="bg-[#0d0d0f] rounded-3xl p-3 border border-white/5 flex items-center gap-3">
                <div className="text-sm text-gray-500 w-20 flex-shrink-0">
                  {formatDate(log.date)}
                </div>
                <div className="flex-1 text-center">
                  <span className="text-xl font-bold text-white">{log.calories}</span>
                  <span className="text-sm text-gray-500 ml-1">kcal</span>
                </div>
                <div className="flex gap-1 flex-wrap justify-end">
                  <span className="text-xs bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full">{log.carbsG}g KH</span>
                  <span className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full">{log.proteinG}g eiwit</span>
                  <span className="text-xs bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded-full">{log.fatG}g vet</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="h-4" />
      </div>
    </div>
  );
}
