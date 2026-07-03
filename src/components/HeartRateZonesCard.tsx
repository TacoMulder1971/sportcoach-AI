'use client';

import { useEffect, useState } from 'react';
import { getProfile, saveProfile, getRunZones, getCyclingZones, getActivityArchive } from '@/lib/storage';
import { estimateSwimPaceTargets, parseSwimPace, formatSwimPace, SwimPaceTargets } from '@/lib/swim';
import { SwimPaceZone } from '@/lib/types';

const SWIM_ZONE_LABELS = ['Herstel', 'Basis', 'Aeroob', 'Drempel', 'VO2max'];

type SwimZoneInput = { min: string; max: string };
const emptySwimZones = (): SwimZoneInput[] => Array.from({ length: 5 }, () => ({ min: '', max: '' }));

export default function HeartRateZonesCard() {
  const [zonesRun, setZonesRun] = useState<string[]>(['', '', '', '', '', '']);
  const [zonesBike, setZonesBike] = useState<string[]>(['', '', '', '', '', '']);
  const [swimZones, setSwimZones] = useState<SwimZoneInput[]>(emptySwimZones());
  const [swimManual, setSwimManual] = useState(false);
  const [swimAuto, setSwimAuto] = useState<SwimPaceTargets | null>(null);
  const [swimError, setSwimError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const runZ = getRunZones();
    const bikeZ = getCyclingZones();
    setZonesRun([String(runZ[0].min), String(runZ[1].min), String(runZ[2].min), String(runZ[3].min), String(runZ[4].min), String(runZ[4].max)]);
    setZonesBike([String(bikeZ[0].min), String(bikeZ[1].min), String(bikeZ[2].min), String(bikeZ[3].min), String(bikeZ[4].min), String(bikeZ[4].max)]);
    const p = getProfile();
    const auto = estimateSwimPaceTargets(getActivityArchive());
    setSwimAuto(auto);
    const isManual = !!(p.swimPaceZones && p.swimPaceZones.length === 5);
    setSwimManual(isManual);
    if (isManual) {
      setSwimZones(p.swimPaceZones!.map(z => ({ min: formatSwimPace(z.minSecPer100), max: formatSwimPace(z.maxSecPer100) })));
    } else if (auto) {
      setSwimZones(auto.zones.map(z => ({ min: formatSwimPace(z.minSecPer100), max: formatSwimPace(z.maxSecPer100) })));
    }
  }, []);

  function setSwimZone(idx: number, field: 'min' | 'max', value: string) {
    setSwimZones(zs => zs.map((z, i) => (i === idx ? { ...z, [field]: value } : z)));
    setSwimError('');
  }

  function resetSwimToAuto() {
    const p = getProfile();
    delete p.swimPaceZones;
    saveProfile(p);
    setSwimManual(false);
    setSwimError('');
    setSwimZones(swimAuto ? swimAuto.zones.map(z => ({ min: formatSwimPace(z.minSecPer100), max: formatSwimPace(z.maxSecPer100) })) : emptySwimZones());
  }

  function save() {
    const toInt = (v: string) => parseInt(v);
    const rn = zonesRun.map(toInt);
    const bk = zonesBike.map(toInt);
    if (rn.some(isNaN) || bk.some(isNaN)) return;

    // Zwemtempo's: alles leeg = automatisch; anders moeten alle 10 velden geldig zijn
    let swimOverride: SwimPaceZone[] | undefined;
    const allEmpty = swimZones.every(z => !z.min.trim() && !z.max.trim());
    if (!allEmpty) {
      const parsed = swimZones.map(z => ({ min: parseSwimPace(z.min), max: parseSwimPace(z.max) }));
      if (parsed.some(z => z.min === null || z.max === null)) {
        setSwimError('Vul alle zwemtempo’s in als min:sec (bijv. 2:05), tussen 1:00 en 4:00.');
        return;
      }
      if (parsed.some(z => z.min! > z.max!)) {
        setSwimError('Het linker tempo (snel) moet sneller of gelijk zijn aan het rechter (rustig).');
        return;
      }
      swimOverride = parsed.map(z => ({ minSecPer100: z.min!, maxSecPer100: z.max! }));
      // Ongewijzigd t.o.v. de auto-schatting? Dan niet vastzetten — blijft meebewegen met nieuwe trainingen.
      if (swimAuto && swimOverride.every((z, i) => z.minSecPer100 === swimAuto.zones[i].minSecPer100 && z.maxSecPer100 === swimAuto.zones[i].maxSecPer100)) {
        swimOverride = undefined;
      }
    }
    setSwimError('');

    const p = getProfile();
    saveProfile({
      ...p,
      maxHR: rn[5],
      maxHRCycling: bk[5],
      hrZonesRun: { z1min: rn[0], z2min: rn[1], z3min: rn[2], z4min: rn[3], z5min: rn[4], maxHR: rn[5] },
      hrZonesCycling: { z1min: bk[0], z2min: bk[1], z3min: bk[2], z4min: bk[3], z5min: bk[4], maxHR: bk[5] },
      swimPaceZones: swimOverride,
    });
    setSwimManual(!!swimOverride);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const swimInputClass = `w-[4.25rem] bg-white/5 border text-white rounded-lg px-1 py-1 text-sm text-center ${swimError ? 'border-red-500/60' : 'border-white/10'}`;

  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-3">Zones &amp; tempo&apos;s instellen</h2>
      <div className="bg-[#0d0d0f] rounded-3xl p-4 border border-white/5 space-y-4">
        <h3 className="text-sm font-semibold text-gray-200">Hartslagzones</h3>
        <p className="text-xs text-gray-500">Stel de ondergrens van elke zone in (bpm). De bovengrens van Z5 is je max hartslag.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-white/10">
                <th className="text-left py-2 pr-3 font-medium">Zone</th>
                <th className="text-center py-2 px-2 font-medium">Hardlopen</th>
                <th className="text-center py-2 pl-2 font-medium">Fietsen</th>
              </tr>
            </thead>
            <tbody>
              {['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Max HR'].map((label, idx) => (
                <tr key={label} className="border-b border-white/5">
                  <td className="py-2 pr-3 font-semibold text-gray-200 whitespace-nowrap">{label}</td>
                  <td className="py-1 px-2">
                    <input type="number" min={60} max={230} value={zonesRun[idx]}
                      onChange={e => setZonesRun(z => z.map((v, i) => i === idx ? e.target.value : v))}
                      className="w-20 bg-white/5 border border-white/10 text-white rounded-lg px-2 py-1 text-sm text-center" />
                  </td>
                  <td className="py-1 pl-2">
                    <input type="number" min={60} max={230} value={zonesBike[idx]}
                      onChange={e => setZonesBike(z => z.map((v, i) => i === idx ? e.target.value : v))}
                      className="w-20 bg-white/5 border border-white/10 text-white rounded-lg px-2 py-1 text-sm text-center" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Zwemmen stuurt op tempo per 100m, niet op hartslag */}
        <div className="pt-2 border-t border-white/10 space-y-2">
          <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
            <h3 className="text-sm font-semibold text-gray-200">Zwemtempo&apos;s (per 100m)</h3>
            {swimManual && (
              <button onClick={resetSwimToAuto} className="text-xs text-gray-400 underline underline-offset-2">
                Terug naar automatisch
              </button>
            )}
          </div>
          <p className="text-xs text-gray-500">Richttempo per zone, van snel naar rustig (min:sec per 100m).</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-white/10">
                <th className="text-left py-2 pr-3 font-medium">Zone</th>
                <th className="text-center py-2 px-1 font-medium">Snel</th>
                <th className="text-center py-2 pl-1 font-medium">Rustig</th>
              </tr>
            </thead>
            <tbody>
              {swimZones.map((z, idx) => (
                <tr key={idx} className="border-b border-white/5">
                  <td className="py-2 pr-3 whitespace-nowrap">
                    <span className="font-semibold text-gray-200">Z{idx + 1}</span>
                    <span className="text-xs text-gray-500 ml-2">{SWIM_ZONE_LABELS[idx]}</span>
                  </td>
                  <td className="py-1 px-1 text-center">
                    <input type="text" inputMode="numeric" placeholder="2:05" value={z.min}
                      onChange={e => setSwimZone(idx, 'min', e.target.value)}
                      className={swimInputClass} />
                  </td>
                  <td className="py-1 pl-1 text-center">
                    <input type="text" inputMode="numeric" placeholder="2:12" value={z.max}
                      onChange={e => setSwimZone(idx, 'max', e.target.value)}
                      className={swimInputClass} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {swimError && <p className="text-xs text-red-400">{swimError}</p>}
          <p className="text-xs text-gray-500">
            {swimManual
              ? <>Handmatig ingesteld — deze tempo&apos;s worden gebruikt op de Schema-tab en in het trainingsschema.</>
              : swimAuto
                ? <>Automatisch geschat o.b.v. je laatste {swimAuto.basedOnCount} zwemtrainingen (gemiddeld {formatSwimPace(swimAuto.baseSecPer100)} /100m). Pas aan en sla op om ze vast te zetten.</>
                : <>Nog geen zwemtrainingen gevonden — vul de tempo&apos;s zelf in, of sync zwemtrainingen voor een automatische schatting.</>}
          </p>
        </div>

        <button onClick={save} className="w-full py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700">
          {saved ? '✓ Opgeslagen' : 'Opslaan'}
        </button>
      </div>
    </section>
  );
}
