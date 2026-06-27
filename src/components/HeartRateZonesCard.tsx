'use client';

import { useEffect, useState } from 'react';
import { getProfile, saveProfile, getRunZones, getCyclingZones } from '@/lib/storage';

export default function HeartRateZonesCard() {
  const [zonesRun, setZonesRun] = useState<string[]>(['', '', '', '', '', '']);
  const [zonesBike, setZonesBike] = useState<string[]>(['', '', '', '', '', '']);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const runZ = getRunZones();
    const bikeZ = getCyclingZones();
    setZonesRun([String(runZ[0].min), String(runZ[1].min), String(runZ[2].min), String(runZ[3].min), String(runZ[4].min), String(runZ[4].max)]);
    setZonesBike([String(bikeZ[0].min), String(bikeZ[1].min), String(bikeZ[2].min), String(bikeZ[3].min), String(bikeZ[4].min), String(bikeZ[4].max)]);
  }, []);

  function save() {
    const toInt = (v: string) => parseInt(v);
    const rn = zonesRun.map(toInt);
    const bk = zonesBike.map(toInt);
    if (rn.some(isNaN) || bk.some(isNaN)) return;
    const p = getProfile();
    saveProfile({
      ...p,
      maxHR: rn[5],
      maxHRCycling: bk[5],
      hrZonesRun: { z1min: rn[0], z2min: rn[1], z3min: rn[2], z4min: rn[3], z5min: rn[4], maxHR: rn[5] },
      hrZonesCycling: { z1min: bk[0], z2min: bk[1], z3min: bk[2], z4min: bk[3], z5min: bk[4], maxHR: bk[5] },
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Hartslagzones instellen</h2>
      <div className="bg-white rounded-xl p-4 border border-gray-200 space-y-4">
        <p className="text-xs text-gray-500">Stel de ondergrens van elke zone in (bpm). De bovengrens van Z5 is je max hartslag.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-100">
                <th className="text-left py-2 pr-3 font-medium">Zone</th>
                <th className="text-center py-2 px-2 font-medium">Hardlopen</th>
                <th className="text-center py-2 pl-2 font-medium">Fietsen</th>
              </tr>
            </thead>
            <tbody>
              {['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Max HR'].map((label, idx) => (
                <tr key={label} className="border-b border-gray-50">
                  <td className="py-2 pr-3 font-semibold text-gray-700 whitespace-nowrap">{label}</td>
                  <td className="py-1 px-2">
                    <input type="number" min={60} max={230} value={zonesRun[idx]}
                      onChange={e => setZonesRun(z => z.map((v, i) => i === idx ? e.target.value : v))}
                      className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm text-center" />
                  </td>
                  <td className="py-1 pl-2">
                    <input type="number" min={60} max={230} value={zonesBike[idx]}
                      onChange={e => setZonesBike(z => z.map((v, i) => i === idx ? e.target.value : v))}
                      className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-sm text-center" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={save} className="w-full py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700">
          {saved ? '✓ Opgeslagen' : 'Opslaan'}
        </button>
      </div>
    </section>
  );
}
