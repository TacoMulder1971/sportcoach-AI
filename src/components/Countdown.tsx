'use client';

import { useEffect, useState } from 'react';
import { getDaysUntilRace } from '@/lib/schedule';
import { getProfile } from '@/lib/storage';

export default function Countdown() {
  const [days, setDays] = useState<number | null>(null);

  useEffect(() => {
    const profile = getProfile();
    setDays(getDaysUntilRace(profile.raceDate));
  }, []);

  if (days === null) return null;

  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 text-white">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-blue-200 text-sm font-medium">Countdown</p>
          <p className="text-3xl font-bold mt-1">
            {days > 0 ? `${days} dagen` : days === 0 ? 'Vandaag!' : 'Voltooid'}
          </p>
          <p className="text-blue-200 text-sm mt-1">tot 1/4 Triatlon</p>
        </div>
        <div className="flex gap-2">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">Z</div>
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">F</div>
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold">H</div>
        </div>
      </div>
      <div className="mt-4 bg-blue-500/30 rounded-full h-2">
        <div
          className="bg-white rounded-full h-2 transition-all"
          style={{
            width: `${Math.min(100, Math.max(0, ((104 - days) / 104) * 100))}%`,
          }}
        />
      </div>
      <p className="text-blue-200 text-xs mt-2">13 juni 2026 — Doel: onder 3 uur</p>
    </div>
  );
}
