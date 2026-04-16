'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import TrainingCard from '@/components/TrainingCard';
import { getCurrentWeekNumber, getTodayDayIndex, getDaysInCurrentCycle, getDaysUntilRace } from '@/lib/schedule';
import { getActivePlan, updateActivePlan, shouldAutoBackup, markBackupDone, getGarminData } from '@/lib/storage';
import { HEART_RATE_ZONES, TrainingWeek, TrainingDay, GarminHealthStats } from '@/lib/types';
import { TRAINING_PHASES, getCurrentPhase, getPhaseProgress, getPhaseStatus, getPhaseDateRange, getDaysUntilRace as getDaysUntilRacePeriod } from '@/lib/periodization';

type TabSelection = 1 | 2 | 'longterm';

export default function SchemaPage() {
  const [plan, setPlan] = useState<TrainingWeek[] | null>(null);
  const [cycleStartDate, setCycleStartDate] = useState<string>('');
  const [planId, setPlanId] = useState<string>('default');
  const [selectedTab, setSelectedTab] = useState<TabSelection>(1);
  const [cycleDay, setCycleDay] = useState(1);
  const todayDayIndex = getTodayDayIndex();

  // Auto-scroll naar vandaag
  const todayRef = useRef<HTMLDivElement>(null);
  const hasScrolled = useRef(false);

  // Ad-hoc aanpassing state
  const [adjustDay, setAdjustDay] = useState<{ weekNumber: 1 | 2; day: TrainingDay } | null>(null);
  const [adjustText, setAdjustText] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [showBackupReminder, setShowBackupReminder] = useState(false);
  const [health, setHealth] = useState<GarminHealthStats | null>(null);

  useEffect(() => {
    const active = getActivePlan();
    setPlan(active.plan);
    setCycleStartDate(active.cycleStartDate);
    setPlanId(active.id);
    const currentWeek = getCurrentWeekNumber(active.cycleStartDate);
    setSelectedTab(currentWeek);
    setCycleDay(getDaysInCurrentCycle(active.cycleStartDate));
    setShowBackupReminder(shouldAutoBackup());
    setHealth(getGarminData()?.health || null);
  }, []);

  // Auto-scroll naar vandaag bij initieel laden
  useEffect(() => {
    if (plan && !hasScrolled.current && todayRef.current) {
      setTimeout(() => {
        todayRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        hasScrolled.current = true;
      }, 100);
    }
  }, [plan]);

  const currentWeek = cycleStartDate ? getCurrentWeekNumber(cycleStartDate) : 1;
  const selectedWeek = typeof selectedTab === 'number' ? selectedTab : null;
  const week = selectedWeek ? plan?.find((w) => w.weekNumber === selectedWeek) : null;
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

      {/* Backup herinnering */}
      {showBackupReminder && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-amber-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M4.93 4.93l14.14 14.14M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-700">Tijd voor een backup!</p>
              <p className="text-xs text-gray-600 mt-0.5">Exporteer je data zodat je niets kwijtraakt.</p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/data"
                className="text-xs bg-amber-500 text-white px-2.5 py-1.5 rounded-lg font-medium"
              >
                Data
              </Link>
              <button
                onClick={() => { markBackupDone(); setShowBackupReminder(false); }}
                className="text-xs text-gray-400 px-1.5 py-1.5"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Tab selector */}
      <div className="flex gap-2">
        {([1, 2] as const).map((num) => {
          const weekData = plan.find((w) => w.weekNumber === num);
          return (
            <button
              key={num}
              onClick={() => setSelectedTab(num)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                selectedTab === num
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
        <button
          onClick={() => setSelectedTab('longterm')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            selectedTab === 'longterm'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-white text-gray-700 border border-gray-200'
          }`}
        >
          Seizoen
        </button>
      </div>

      {/* Week view */}
      {selectedWeek && week && (
        <>
          {/* Training days met aanpas-icoon */}
          <div className="space-y-3">
            {week.days.map((day) => {
              const isToday = selectedWeek === currentWeek && day.dayIndex === todayDayIndex;
              return (
              <div key={day.dayIndex} className="relative" ref={isToday ? todayRef : undefined}>
                <TrainingCard
                  training={day}
                  isToday={isToday}
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
              );
            })}
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
              {(health?.lactateThresholdHR || health?.lactateThresholdPace) && (
                <div className="flex items-center justify-between p-3 border-t border-gray-100 bg-gray-50">
                  <span className="text-sm font-medium text-gray-700">Lactaatdrempel</span>
                  <span className="text-sm text-gray-700 font-semibold">
                    {health.lactateThresholdHR ? `${health.lactateThresholdHR} bpm` : ''}
                    {health.lactateThresholdHR && health.lactateThresholdPace ? ' · ' : ''}
                    {health.lactateThresholdPace || ''}
                  </span>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {/* Lange termijn seizoensoverzicht */}
      {selectedTab === 'longterm' && (
        <div className="space-y-4">
          {/* Countdown */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-sm text-gray-500">Nog</p>
            <p className="text-3xl font-bold text-gray-900">{getDaysUntilRacePeriod()} dagen</p>
            <p className="text-sm text-gray-500">tot de 1/4 triatlon</p>
          </div>

          {/* Fasen tijdlijn */}
          <div className="relative">
            {TRAINING_PHASES.map((phase, idx) => {
              const status = getPhaseStatus(phase);
              const dateRange = getPhaseDateRange(phase);
              const isCurrent = status === 'current';
              const isDone = status === 'done';
              const progress = isCurrent ? getPhaseProgress() : isDone ? 100 : 0;

              return (
                <div key={phase.id} className="flex gap-3 relative">
                  {/* Tijdlijn lijn */}
                  <div className="flex flex-col items-center w-8 flex-shrink-0">
                    <div
                      className={`w-4 h-4 rounded-full border-2 z-10 ${
                        isCurrent
                          ? 'border-blue-500 bg-blue-500'
                          : isDone
                          ? 'border-gray-400 bg-gray-400'
                          : 'border-gray-300 bg-white'
                      }`}
                    />
                    {idx < TRAINING_PHASES.length - 1 && (
                      <div
                        className={`w-0.5 flex-1 ${
                          isDone ? 'bg-gray-400' : 'bg-gray-200'
                        }`}
                      />
                    )}
                  </div>

                  {/* Fase kaart */}
                  <div
                    className={`flex-1 mb-4 rounded-xl p-4 border ${
                      isCurrent
                        ? 'bg-blue-50 border-blue-300 shadow-md'
                        : isDone
                        ? 'bg-gray-50 border-gray-200 opacity-60'
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: phase.color }}
                        />
                        <h3 className={`font-bold ${isCurrent ? 'text-blue-700' : 'text-gray-900'}`}>
                          {phase.label}
                        </h3>
                      </div>
                      {isCurrent && (
                        <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">
                          Nu
                        </span>
                      )}
                      {isDone && (
                        <span className="text-xs text-gray-400">
                          <svg className="w-4 h-4 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-gray-500 mb-2">{dateRange.start} — {dateRange.end}</p>
                    <p className="text-sm text-gray-700 mb-3">{phase.description}</p>

                    {/* Doelen */}
                    <div className="space-y-1">
                      {phase.goals.map((goal, gi) => (
                        <div key={gi} className="flex items-center gap-2">
                          <div
                            className={`w-1.5 h-1.5 rounded-full ${
                              isDone ? 'bg-gray-400' : ''
                            }`}
                            style={!isDone ? { backgroundColor: phase.color } : {}}
                          />
                          <p className="text-xs text-gray-600">{goal}</p>
                        </div>
                      ))}
                    </div>

                    {/* Progressiebalk bij huidige fase */}
                    {isCurrent && (
                      <div className="mt-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-500">Voortgang</span>
                          <span className="text-xs font-medium text-blue-600">{progress}%</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${progress}%`,
                              backgroundColor: phase.color,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="h-4" />
    </div>
  );
}
