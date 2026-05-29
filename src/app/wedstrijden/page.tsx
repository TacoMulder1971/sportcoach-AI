'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getGoals, getActivityArchive, formatDuration, formatRaceDateNL } from '@/lib/storage';
import { getDaysUntilRace } from '@/lib/schedule';
import { buildRaces, getRaceTotalSeconds, getRaceSplits, Race } from '@/lib/races';
import { GOAL_TYPES } from '@/lib/types';
import SportIcon from '@/components/SportIcon';

function typeLabel(race: Race): string {
  return GOAL_TYPES.find(t => t.type === race.goal.type)?.label || race.goal.name;
}

function HeroIcons({ race }: { race: Race }) {
  const info = GOAL_TYPES.find(t => t.type === race.goal.type);
  if (info?.multiSport) {
    return (
      <div className="flex gap-1.5">
        <SportIcon sport="zwemmen" size="md" />
        <SportIcon sport="fietsen" size="md" />
        <SportIcon sport="hardlopen" size="md" />
      </div>
    );
  }
  // Enkelvoudig: kies icoon op basis van type
  const sport = race.goal.type.includes('triatlon') ? 'multisport'
    : race.goal.type === 'duatlon' ? 'hardlopen'
    : race.goal.type === 'fietstocht' ? 'fietsen'
    : race.goal.type === 'zwemtocht' ? 'zwemmen'
    : 'hardlopen';
  return <SportIcon sport={sport} size="lg" />;
}

export default function WedstrijdenPage() {
  const [races, setRaces] = useState<Race[] | null>(null);

  useEffect(() => {
    setRaces(buildRaces(getGoals(), getActivityArchive()));
  }, []);

  if (!races) return null;

  const upcoming = races.filter(r => r.status === 'upcoming');
  const done = races.filter(r => r.status === 'done');
  const nextRace = upcoming[0];

  return (
    <div className="px-4 pt-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Wedstrijden</h1>
        <p className="text-gray-500 text-sm">Je races, splits en trends op één plek</p>
      </div>

      {races.length === 0 && (
        <div className="bg-white rounded-xl p-8 border border-gray-200 text-center">
          <p className="text-3xl mb-2">🏁</p>
          <p className="text-gray-500 text-sm">
            Nog geen wedstrijden. Voeg een doel toe op het Home-scherm.
          </p>
        </div>
      )}

      {/* Volgende wedstrijd — donkere sporty hero */}
      {nextRace && (
        <Link href={`/wedstrijden/${nextRace.goal.id}`} className="block active:scale-98 transition-transform">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 p-6 text-white shadow-lg">
            <div className="absolute -right-8 -top-10 w-40 h-40 rounded-full bg-blue-500/10 blur-2xl" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-blue-300 text-xs font-semibold uppercase tracking-wide">Volgende wedstrijd</p>
                <p className="text-2xl font-bold mt-1 truncate">{nextRace.goal.name}</p>
                <p className="text-blue-200/80 text-sm">
                  {typeLabel(nextRace)}{nextRace.goal.location ? ` · ${nextRace.goal.location}` : ''}
                </p>
              </div>
              <HeroIcons race={nextRace} />
            </div>

            <div className="relative mt-5 flex items-end justify-between">
              <div>
                <p className="text-4xl font-extrabold leading-none">
                  {(() => {
                    const d = getDaysUntilRace(nextRace.goal.date);
                    return d > 0 ? d : d === 0 ? '🎉' : '–';
                  })()}
                </p>
                <p className="text-blue-200/80 text-xs mt-1">
                  {getDaysUntilRace(nextRace.goal.date) > 0 ? 'dagen te gaan'
                    : getDaysUntilRace(nextRace.goal.date) === 0 ? 'vandaag!' : 'geweest'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-blue-100 text-sm font-medium">{formatRaceDateNL(nextRace.goal.date)}</p>
                {nextRace.goal.targetTimeSeconds && (
                  <p className="text-blue-300 text-xs">Doel: {formatDuration(nextRace.goal.targetTimeSeconds)}</p>
                )}
              </div>
            </div>
          </div>
        </Link>
      )}

      {/* Overige komende wedstrijden */}
      {upcoming.length > 1 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Ook gepland</h2>
          <div className="space-y-2">
            {upcoming.slice(1).map(r => (
              <RaceRow key={r.goal.id} race={r} />
            ))}
          </div>
        </section>
      )}

      {/* Afgeronde wedstrijden */}
      {done.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Afgerond</h2>
          <div className="space-y-2">
            {done.map(r => (
              <RaceRow key={r.goal.id} race={r} showResult />
            ))}
          </div>
        </section>
      )}

      <div className="h-4" />
    </div>
  );
}

function RaceRow({ race, showResult }: { race: Race; showResult?: boolean }) {
  const total = getRaceTotalSeconds(race);
  const splits = getRaceSplits(race);
  const rating = race.goal.result?.rating;
  return (
    <Link
      href={`/wedstrijden/${race.goal.id}`}
      className="flex items-center gap-3 bg-white rounded-xl p-3 border border-gray-200 active:scale-98 transition-transform"
    >
      <HeroIcons race={race} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{race.goal.name}</p>
        <p className="text-xs text-gray-500">
          {formatRaceDateNL(race.goal.date)}
          {splits.length > 0 && ` · ${splits.length} onderdelen`}
        </p>
        {showResult && rating && (
          <p className="text-xs text-amber-500 mt-0.5">{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</p>
        )}
      </div>
      <div className="text-right flex-shrink-0">
        {total ? (
          <p className="text-sm font-bold text-gray-900 tabular-nums">{formatDuration(total)}</p>
        ) : (
          <p className="text-xs text-gray-400">geen tijd</p>
        )}
      </div>
    </Link>
  );
}
