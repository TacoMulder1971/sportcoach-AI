'use client';

import { useState } from 'react';
import TrainingCard from '@/components/TrainingCard';
import { trainingPlan } from '@/data/training-plan';
import { getCurrentWeekNumber, getTodayDayIndex } from '@/lib/schedule';
import { HEART_RATE_ZONES } from '@/lib/types';

export default function SchemaPage() {
  const currentWeek = getCurrentWeekNumber();
  const [selectedWeek, setSelectedWeek] = useState<1 | 2>(currentWeek);
  const todayDayIndex = getTodayDayIndex();

  const week = trainingPlan.find((w) => w.weekNumber === selectedWeek);

  return (
    <div className="px-4 pt-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Trainingsschema</h1>
        <p className="text-gray-500 text-sm">2-weekse cyclus</p>
      </div>

      {/* Week selector */}
      <div className="flex gap-2">
        {([1, 2] as const).map((num) => (
          <button
            key={num}
            onClick={() => setSelectedWeek(num)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              selectedWeek === num
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-200'
            }`}
          >
            Week {num}
            {num === currentWeek && (
              <span className="ml-1 text-xs opacity-75">(huidig)</span>
            )}
          </button>
        ))}
      </div>

      {/* Training days */}
      <div className="space-y-3">
        {week?.days.map((day) => (
          <TrainingCard
            key={day.dayIndex}
            training={day}
            isToday={selectedWeek === currentWeek && day.dayIndex === todayDayIndex}
          />
        ))}
      </div>

      {/* Hartslagzones legenda */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          Hartslagzones (max HR: 172)
        </h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {HEART_RATE_ZONES.map((zone, idx) => (
            <div
              key={zone.zone}
              className={`flex items-center justify-between p-3 ${
                idx < HEART_RATE_ZONES.length - 1 ? 'border-b border-gray-100' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: zone.color }}
                >
                  {zone.zone}
                </span>
                <span className="text-sm font-medium">{zone.label}</span>
              </div>
              <span className="text-sm text-gray-500">
                {zone.min}–{zone.max} bpm
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="h-4" />
    </div>
  );
}
