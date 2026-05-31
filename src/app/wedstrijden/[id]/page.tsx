'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  getGoals, getActivityArchive, getHealthArchive, formatDuration, formatRaceDateNL,
  getRaceWeather, saveRaceWeather,
} from '@/lib/storage';
import { getDaysUntilRace } from '@/lib/schedule';
import { buildRaces, getRaceSplits, getRaceTotalSeconds, getPreRaceBuildup, Race } from '@/lib/races';
import { GOAL_TYPES, RaceWeather } from '@/lib/types';
import SportIcon from '@/components/SportIcon';
import RaceSplitBar from '@/components/RaceSplitBar';
import WeatherCard from '@/components/WeatherCard';
import BuildupBarChart from '@/components/BuildupBarChart';

export default function WedstrijdDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [race, setRace] = useState<Race | null | undefined>(undefined);
  const [weather, setWeather] = useState<RaceWeather | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  useEffect(() => {
    const races = buildRaces(getGoals(), getActivityArchive());
    setRace(races.find(r => r.goal.id === id) ?? null);
  }, [id]);

  // Weer ophalen (1× per wedstrijd, daarna uit cache)
  useEffect(() => {
    if (!race?.goal.location) return;
    const cached = getRaceWeather(race.goal.id);
    if (cached) { setWeather(cached); return; }
    setWeatherLoading(true);
    fetch('/api/weather', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location: race.goal.location, date: race.goal.date }),
    })
      .then(r => r.json())
      .then(d => {
        if (d?.weather) { setWeather(d.weather); saveRaceWeather(race.goal.id, d.weather); }
      })
      .catch(() => {})
      .finally(() => setWeatherLoading(false));
  }, [race]);

  const splits = useMemo(() => race ? getRaceSplits(race) : [], [race]);
  const buildup = useMemo(
    () => race ? getPreRaceBuildup(getActivityArchive(), getHealthArchive(), race.goal.date) : null,
    [race],
  );

  if (race === undefined) return null;

  if (race === null) {
    return (
      <div className="px-4 pt-6 space-y-4">
        <BackLink />
        <div className="bg-white rounded-xl p-8 border border-gray-200 text-center">
          <p className="text-gray-500 text-sm">Wedstrijd niet gevonden.</p>
        </div>
      </div>
    );
  }

  const info = GOAL_TYPES.find(t => t.type === race.goal.type);
  const total = getRaceTotalSeconds(race);
  const days = getDaysUntilRace(race.goal.date);
  const result = race.goal.result;

  return (
    <div className="px-4 pt-6 space-y-6">
      <BackLink />

      {/* Donkere hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 p-6 text-white shadow-lg">
        <div className="absolute -right-10 -top-12 w-48 h-48 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-wide">
              {info?.label || 'Wedstrijd'}
            </p>
            <p className="text-2xl font-bold mt-1">{race.goal.name}</p>
            <p className="text-blue-200/80 text-sm">
              {formatRaceDateNL(race.goal.date)}
              {race.goal.location ? ` · ${race.goal.location}` : ''}
            </p>
          </div>
          {info?.multiSport ? (
            <div className="flex gap-1.5">
              <SportIcon sport="zwemmen" size="md" />
              <SportIcon sport="fietsen" size="md" />
              <SportIcon sport="hardlopen" size="md" />
            </div>
          ) : (
            <SportIcon sport="hardlopen" size="lg" />
          )}
        </div>

        <div className="relative mt-5">
          {race.status === 'upcoming' ? (
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl font-extrabold leading-none">{days > 0 ? days : days === 0 ? '🎉' : '–'}</p>
                <p className="text-blue-200/80 text-xs mt-1">{days > 0 ? 'dagen te gaan' : days === 0 ? 'vandaag!' : 'geweest'}</p>
              </div>
              {race.goal.targetTimeSeconds && (
                <div className="text-right">
                  <p className="text-blue-300 text-xs">Streeftijd</p>
                  <p className="text-xl font-bold">{formatDuration(race.goal.targetTimeSeconds)}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-end justify-between">
              <div>
                <p className="text-blue-300 text-xs">Eindtijd</p>
                <p className="text-4xl font-extrabold leading-none tabular-nums">{total ? formatDuration(total) : '–'}</p>
              </div>
              {race.goal.targetTimeSeconds && total && (
                <div className="text-right">
                  <p className="text-blue-300 text-xs">t.o.v. doel</p>
                  <p className={`text-xl font-bold ${total <= race.goal.targetTimeSeconds ? 'text-green-400' : 'text-orange-300'}`}>
                    {total <= race.goal.targetTimeSeconds ? '−' : '+'}
                    {formatDuration(Math.abs(total - race.goal.targetTimeSeconds))}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Splits */}
      {splits.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Splits</h2>
          <div className="bg-white rounded-xl p-4 border border-gray-200">
            <RaceSplitBar splits={splits} />
          </div>
        </section>
      )}

      {/* Weer op de racedag */}
      {race.goal.location && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Weer op de racedag</h2>
          <WeatherCard weather={weather} loading={weatherLoading} />
        </section>
      )}

      {/* Reflectie uit resultaat */}
      {result?.trainingReflection && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Terugblik</h2>
          <div className="bg-white rounded-xl p-4 border border-gray-200 space-y-2">
            {result.timeReflection && <p className="text-sm text-gray-700">{result.timeReflection}</p>}
            <p className="text-sm text-gray-600 leading-relaxed">{result.trainingReflection}</p>
          </div>
        </section>
      )}

      {/* Aanloop naar de wedstrijd */}
      <section>
        <div className="flex items-baseline gap-2 mb-2">
          <h2 className="text-base font-semibold text-gray-900">Aanloop</h2>
          <p className="text-xs text-gray-400">training vóór de wedstrijd</p>
        </div>
        {buildup && buildup.totalSessions > 0 ? (
          <div className="space-y-3">
            {/* Samenvatting — zelfde donkere stijl als de hero */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 p-4 text-white shadow-lg">
              <div className="absolute -right-8 -top-10 w-40 h-40 rounded-full bg-blue-500/10 blur-2xl" />
              <div className="relative">
                {buildup.startDate && (
                  <p className="text-blue-200/80 text-sm mb-3">
                    Gestart op <span className="font-semibold text-white">{formatRaceDateNL(buildup.startDate)}</span>
                    {' '}— {buildup.spanWeeks} weken, {buildup.weeksWithData} actief.
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <StatTile value={`${buildup.totalSessions}`} label="Trainingen" accent="text-sky-300" />
                  <StatTile value={fmtHours(buildup.totalMinutes)} label="Trainingstijd" accent="text-violet-300" />
                  <StatTile value={`${buildup.totalKm}`} label="Kilometer" accent="text-emerald-300" />
                  <StatTile value={`${buildup.totalTrimp}`} label="Belasting (TRIMP)" accent="text-amber-300" />
                </div>
                {buildup.avgHR > 0 && (
                  <p className="text-blue-200/70 text-xs text-center mt-3 pt-2.5 border-t border-white/10">
                    Gemiddelde hartslag {buildup.avgHR} bpm · ~{Math.round(buildup.totalTrimp / Math.max(1, buildup.weeksWithData))} TRIMP per actieve week
                  </p>
                )}
              </div>
            </div>

            {/* Verdeling per sport */}
            {buildup.bySport.length > 0 && (
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <p className="text-xs font-semibold text-gray-500 mb-2">Verdeling per sport</p>
                <div className="flex w-full h-3 rounded-full overflow-hidden mb-3">
                  {buildup.bySport.map(s => (
                    <div key={s.sport} style={{ width: `${(s.minutes / buildup.totalMinutes) * 100}%`, backgroundColor: s.color }} title={s.label} />
                  ))}
                </div>
                <div className="space-y-1.5">
                  {buildup.bySport.map(s => (
                    <div key={s.sport} className="flex items-center gap-2 text-xs">
                      <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="font-medium text-gray-700 w-24">{s.label}</span>
                      <span className="text-gray-500">{s.sessions}×</span>
                      <span className="text-gray-400">· {fmtHours(s.minutes)}</span>
                      {s.km > 0 && <span className="text-gray-400">· {Math.round(s.km)}km</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Weekgrafieken */}
            {buildup.weekly.length > 0 && (
              <div className="bg-white rounded-xl p-4 border border-gray-200 space-y-6">
                {buildup.weekly.map(t => (
                  <BuildupBarChart key={t.label} data={t.data} color={t.color} unit={t.unit} title={t.label} />
                ))}
              </div>
            )}

            {/* Activiteiten */}
            <div className="bg-white rounded-xl border border-gray-200">
              <p className="text-xs font-semibold text-gray-500 px-4 pt-4 pb-2">Activiteiten ({buildup.activities.length})</p>
              <div className="divide-y divide-gray-100">
                {buildup.activities.map(a => (
                  <div key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                    <SportIcon sport={a.sport !== 'overig' ? a.sport : 'overig'} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{a.activityName}</p>
                      <p className="text-xs text-gray-500">
                        {a.durationMinutes}min
                        {a.distanceKm > 0 && ` · ${a.distanceKm}km`}
                        {a.avgHR > 0 && ` · HR ${a.avgHR}`}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {new Date(a.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
            <p className="text-sm text-gray-400">
              Nog geen historische activiteiten in deze periode. Synchroniseer Garmin op het
              Data-scherm om je aanloop te vullen.
            </p>
          </div>
        )}
      </section>

      <div className="h-4" />
    </div>
  );
}

function StatTile({ value, label, accent }: { value: string; label: string; accent: string }) {
  return (
    <div className="bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-center">
      <p className={`text-xl font-extrabold ${accent}`}>{value}</p>
      <p className="text-xs text-blue-200/80 mt-0.5">{label}</p>
    </div>
  );
}

function fmtHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}u${m > 0 ? ` ${m}m` : ''}`;
}

function BackLink() {
  return (
    <Link href="/wedstrijden" className="inline-flex items-center gap-1 text-sm text-blue-600 font-medium">
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      Wedstrijden
    </Link>
  );
}
