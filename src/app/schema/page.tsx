'use client';

import { useState, useEffect } from 'react';
import TrainingCard from '@/components/TrainingCard';
import { getCurrentWeekNumber, getTodayDayIndex, getDaysInCurrentCycle, getDaysUntilRace } from '@/lib/schedule';
import { getActivePlan, updateActivePlan } from '@/lib/storage';
import { HEART_RATE_ZONES, TrainingWeek, TrainingDay } from '@/lib/types';

export default function SchemaPage() {
  const [plan, setPlan] = useState<TrainingWeek[] | null>(null);
  const [cycleStartDate, setCycleStartDate] = useState<string>('');
  const [planId, setPlanId] = useState<string>('default');
  const [selectedWeek, setSelectedWeek] = useState<1 | 2>(1);
  const [cycleDay, setCycleDay] = useState(1);
  const todayDayIndex = getTodayDayIndex();

  // Ad-hoc aanpassing state
  const [adjustDay, setAdjustDay] = useState<{ weekNumber: 1 | 2; day: TrainingDay } | null>(null);
  const [adjustText, setAdjustText] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

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
  const showNewPlanPrompt = cycleDay >= 11;

  async function handleAdjust() {
    if (!adjustDay || !adjustText.trim() || !plan) return;
    setAdjusting(true);
    setAdjustError(null);

    try {
      const res = await fetch('/api/adjust-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPlan: plan,
          weekNumber: adjustDay.weekNumber,
          dayIndex: adjustDay.day.dayIndex,
          adjustmentRequest: adjustText.trim(),
          daysUntilRace: getDaysUntilRace('2026-06-13'),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Aanpassen mislukt');

      // Update plan in state en storage
      setPlan(data.plan);
      updateActivePlan(data.plan);
      setAdjustDay(null);
      setAdjustText('');
    } catch (e) {
      setAdjustError(e instanceof Error ? e.message : 'Er ging iets mis');
    } finally {
      setAdjusting(false);
    }
  }

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

      {/* Training days met aanpas-icoon */}
      <div className="space-y-3">
        {week?.days.map((day) => (
          <div key={day.dayIndex} className="relative">
            <TrainingCard
              training={day}
              isToday={selectedWeek === currentWeek && day.dayIndex === todayDayIndex}
            />
            {planId !== 'default' && (
              <button
                onClick={() => {
                  setAdjustDay({ weekNumber: selectedWeek, day });
                  setAdjustText('');
                  setAdjustError(null);
                }}
                className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                title="Dag aanpassen"
              >
                <svg className="w-3.5 h-3.5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                  <path d="m15 5 4 4"/>
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Ad-hoc aanpassing modal */}
      {adjustDay && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-2xl p-5 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">
                {adjustDay.day.day} aanpassen
              </h3>
              <button
                onClick={() => setAdjustDay(null)}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>

            <p className="text-sm text-gray-500">
              Wat wil je veranderen? De AI past het schema aan (ook de rest van de week als nodig).
            </p>

            <textarea
              value={adjustText}
              onChange={(e) => setAdjustText(e.target.value)}
              placeholder="Bijv. 'Kan vandaag niet, verschuif naar morgen' of 'Wil langer fietsen vandaag'"
              className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none h-24 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />

            {adjustError && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl">{adjustError}</div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setAdjustDay(null)}
                className="flex-1 py-3 rounded-xl font-semibold text-gray-600 bg-gray-100"
              >
                Annuleren
              </button>
              <button
                onClick={handleAdjust}
                disabled={adjusting || !adjustText.trim()}
                className="flex-1 py-3 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-all"
              >
                {adjusting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" />
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:0.1s]" />
                      <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:0.2s]" />
                    </span>
                    Aanpassen...
                  </span>
                ) : (
                  'Aanpassen'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
