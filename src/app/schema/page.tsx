'use client';

import { useState, useEffect } from 'react';
import TrainingCard from '@/components/TrainingCard';
import { getCurrentWeekNumber, getTodayDayIndex, getDaysInCurrentCycle } from '@/lib/schedule';
import { getActivePlan } from '@/lib/storage';
import { HEART_RATE_ZONES, TrainingWeek } from '@/lib/types';

export default function SchemaPage() {
  const [plan, setPlan] = useState<TrainingWeek[] | null>(null);
  const [cycleStartDate, setCycleStartDate] = useState<string>('');
  const [planId, setPlanId] = useState<string>('default');
  const [selectedWeek, setSelectedWeek] = useState<1 | 2>(1);
  const [cycleDay, setCycleDay] = useState(1);
  const todayDayIndex = getTodayDayIndex();

  useEffect(() => {
    const active = getActivePlan();
    setPlan(active.plan);
    setCycleStartDate(active.cycleStartDate);
    setPlanId(active.id);
    const currentWeek = getCurrentWeekNumber(active.cycleStartDate);
    setSelectedWeek(currentWeek);
    setCycleDay(getDaysInCurrentCycle(active.cycleStartDate));
  }, []);

  const currentWeek = cycleStartDate ? getCurrentWeekNumber(cycleStartDate) : 1;
  const week = plan?.find((w) => w.weekNumber === selectedWeek);
  const showNewPlanPrompt = cycleDay >= 11; // Laatste 3-4 dagen van cyclus

  if (!plan) return null;

  return (
    <div className="px-4 pt-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Trainingsschema</h1>
          <p className="text-gray-500 text-sm">
            {planId === 'default' ? '2-weekse cyclus' : `Dag ${cycleDay}/14 van cyclus`}
          </p>
        </div>
      </div>

      {/* Nieuw schema prompt */}
      {showNewPlanPrompt && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-700">Einde cyclus nadert</p>
              <p className="text-xs text-gray-600 mt-0.5">Vraag een nieuw schema aan op basis van je agenda en prestaties.</p>
            </div>
            <button
              onClick={() => window.location.href = '/schema/nieuw'}
              className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium"
            >
              Nieuw schema
            </button>
          </div>
        </div>
      )}

      {/* Altijd zichtbare link */}
      {!showNewPlanPrompt && (
        <button
          onClick={() => window.location.href = '/schema/nieuw'}
          className="text-sm text-blue-600 font-medium"
        >
          Nieuw schema aanvragen
        </button>
      )}

      {/* Week selector */}
      <div className="flex gap-2">
        {([1, 2] as const).map((num) => {
          const weekData = plan.find((w) => w.weekNumber === num);
          return (
            <button
              key={num}
              onClick={() => setSelectedWeek(num)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                selectedWeek === num
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-200'
              }`}
            >
              {weekData?.label || `Week ${num}`}
              {num === currentWeek && (
                <span className="ml-1 text-xs opacity-75">(huidig)</span>
              )}
            </button>
          );
        })}
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
