'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import TrainingCard from '@/components/TrainingCard';
import GoalsSection from '@/components/GoalsSection';
import { getCurrentWeekNumber, getTodayDayIndex, getDaysInCurrentCycle, getDaysUntilRace } from '@/lib/schedule';
import { getActivePlan, getActiveStoredPlan, buildPlanStrategyText, updateActivePlan, shouldAutoBackup, markBackupDone, getGarminData, getActiveRaceDate, buildRaceContextText, buildHRZoneText, getRunZones, getCyclingZones, getSwimPaceTargets, getProfile, toggleCycleWeekFlip } from '@/lib/storage';
import { cleanStrategyText } from '@/lib/plan-strategy';
import { athleteProfilePayload, resolveSports } from '@/lib/athlete';
import { formatSwimPace, formatSwimPaceRange } from '@/lib/swim';
import { TrainingWeek, TrainingDay, GarminHealthStats, HEART_RATE_ZONES } from '@/lib/types';
import { TRAINING_PHASES, getPhaseProgress, getPhaseStatus, getPhaseDateRange } from '@/lib/periodization';

type TabSelection = 1 | 2 | 'longterm';

export default function SchemaContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const goalParam = searchParams.get('goal');
  const [plan, setPlan] = useState<TrainingWeek[] | null>(null);
  const [cycleStartDate, setCycleStartDate] = useState<string>('');
  const [planId, setPlanId] = useState<string>('default');
  const [strategy, setStrategy] = useState<string | null>(null);
  const [refinements, setRefinements] = useState<string[]>([]);
  const [showStrategy, setShowStrategy] = useState(false);
  const [selectedTab, setSelectedTab] = useState<TabSelection>(tabParam === 'longterm' ? 'longterm' : 1);
  const [cycleDay, setCycleDay] = useState(1);
  const todayDayIndex = getTodayDayIndex();
  const todayRef = useRef<HTMLDivElement>(null);
  const didScrollRef = useRef(false);

  // Ad-hoc aanpassing state
  const [adjustDay, setAdjustDay] = useState<{ weekNumber: 1 | 2; day: TrainingDay } | null>(null);
  const [adjustText, setAdjustText] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [showBackupReminder, setShowBackupReminder] = useState(false);
  const [health, setHealth] = useState<GarminHealthStats | null>(null);
  const [raceDate, setRaceDate] = useState<string>('2026-06-13');
  const [mounted, setMounted] = useState(false);

  // Zwemtempo-targets uit het archief (client-only; 1× per render van de tab)
  const swimPaces = useMemo(() => (mounted ? getSwimPaceTargets() : null), [mounted]);
  // Sporten van de atleet — bepaalt welke zone-legenda's getoond worden
  const athleteSports = useMemo(() => (mounted ? resolveSports(getProfile()) : []), [mounted]);

  function loadPlan() {
    const active = getActivePlan();
    setPlan(active.plan);
    setCycleStartDate(active.cycleStartDate);
    setPlanId(active.id);
    const stored = getActiveStoredPlan();
    setStrategy(stored?.strategy || null);
    setRefinements(stored?.refinements || []);
    const currentWeek = getCurrentWeekNumber(active.cycleStartDate);
    if (tabParam !== 'longterm') setSelectedTab(currentWeek);
    setCycleDay(getDaysInCurrentCycle(active.cycleStartDate));
  }

  useEffect(() => {
    loadPlan();
    setShowBackupReminder(shouldAutoBackup());
    setHealth(getGarminData()?.health || null);
    setRaceDate(getActiveRaceDate());
    setMounted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam]);

  const currentWeek = cycleStartDate ? getCurrentWeekNumber(cycleStartDate) : 1;
  const selectedWeek = typeof selectedTab === 'number' ? selectedTab : null;
  const week = selectedWeek ? plan?.find((w) => w.weekNumber === selectedWeek) : null;
  const showNewPlanPrompt = cycleDay >= 11;

  // Bij openen direct naar vandaag scrollen (alleen 1× per bezoek, in de huidige week)
  useEffect(() => {
    if (didScrollRef.current) return;
    if (!plan || planId === 'default') return;
    if (selectedWeek !== currentWeek) return;
    if (!todayRef.current) return;
    didScrollRef.current = true;
    todayRef.current.scrollIntoView({ block: 'center' });
  }, [plan, planId, selectedWeek, currentWeek]);

  // Handmatig de weken wisselen als de automatische berekening ernaast zit
  function handleFlipWeeks() {
    toggleCycleWeekFlip();
    didScrollRef.current = false;
    loadPlan();
  }

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
          daysUntilRace: getDaysUntilRace(getActiveRaceDate()),
          raceContext: buildRaceContextText(),
          hrZoneText: buildHRZoneText(),
          athleteProfile: athleteProfilePayload(getProfile()),
          planStrategy: buildPlanStrategyText(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Aanpassen mislukt');

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
    <div className="bg-black min-h-screen">
      <div className="fixed top-0 inset-x-0 bg-black z-50" style={{ height: 'env(safe-area-inset-top, 0px)' }} />
      <div className="fixed bottom-0 inset-x-0 bg-black z-40" style={{ height: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }} />

      <div className="px-4 pt-6 pb-8 space-y-6">
        <p className="text-gray-500 text-sm">
          {planId === 'default' ? '2-weekse cyclus' : `Dag ${cycleDay}/14 van cyclus`}
        </p>

        {/* Nog geen eigen schema: voorbeeldschema verbergen, doorverwijzen naar generatie */}
        {mounted && planId === 'default' && (
          <a href="/schema/nieuw" className="block bg-[#0d0d0f] rounded-3xl p-6 border border-white/5">
            <p className="text-white font-semibold">Nog geen eigen trainingsschema</p>
            <p className="text-gray-400 text-sm mt-1 leading-relaxed">
              Laat je coach een 2-weeks schema op maat maken op basis van je profiel,
              je doel en je beschikbaarheid.
            </p>
            <span className="inline-flex items-center gap-1.5 mt-3 bg-blue-600 text-white rounded-full px-3.5 py-1.5 text-sm font-semibold">
              Maak mijn schema
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </span>
          </a>
        )}

        {/* Backup herinnering */}
        {showBackupReminder && (
          <div className="bg-[#0d0d0f] border border-amber-500/20 rounded-3xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M4.93 4.93l14.14 14.14M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-400">Tijd voor een backup!</p>
                <p className="text-xs text-gray-400 mt-0.5">Exporteer je data zodat je niets kwijtraakt.</p>
              </div>
              <div className="flex gap-2">
                <Link href="/data" className="text-xs bg-amber-500 text-black px-2.5 py-1.5 rounded-lg font-semibold">
                  Data
                </Link>
                <button onClick={() => { markBackupDone(); setShowBackupReminder(false); }} className="text-xs text-gray-500 px-1.5 py-1.5">
                  Later
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Nieuw schema prompt */}
        {showNewPlanPrompt && (
          <div className="bg-[#0d0d0f] border border-blue-500/20 rounded-3xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-400">Einde cyclus nadert</p>
                <p className="text-xs text-gray-400 mt-0.5">Vraag een nieuw schema aan op basis van je agenda en prestaties.</p>
              </div>
              <button onClick={() => window.location.href = '/schema/nieuw'} className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium">
                Nieuw schema
              </button>
            </div>
          </div>
        )}

        {!showNewPlanPrompt && (
          <button onClick={() => window.location.href = '/schema/nieuw'} className="text-sm text-blue-400 font-medium">
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
                    ? 'bg-blue-600 text-white shadow-[0_2px_12px_rgba(37,99,235,0.4)]'
                    : 'bg-white/5 text-gray-300 border border-white/10'
                }`}
              >
                {weekData?.label || `Week ${num}`}
                {num === currentWeek && <span className="ml-1 text-xs opacity-75">(huidig)</span>}
              </button>
            );
          })}
          <button
            onClick={() => setSelectedTab('longterm')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              selectedTab === 'longterm'
                ? 'bg-blue-600 text-white shadow-[0_2px_12px_rgba(37,99,235,0.4)]'
                : 'bg-white/5 text-gray-300 border border-white/10'
            }`}
          >
            Seizoen
          </button>
        </div>

        {/* Handmatige week-correctie: als de app de verkeerde week als "huidig" toont */}
        {planId !== 'default' && selectedWeek && (
          <button
            onClick={handleFlipWeeks}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 2.1 21 6l-4 3.9M3 11V9a4 4 0 0 1 4-4h14M7 21.9 3 18l4-3.9M21 13v2a4 4 0 0 1-4 4H3"/>
            </svg>
            Klopt de huidige week niet? Wissel week 1 ↔ 2
          </button>
        )}

        {/* Waarom dit schema — bewaarde coachstrategie van de generatie */}
        {strategy && planId !== 'default' && selectedWeek && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowStrategy((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <span className="text-sm font-semibold text-blue-300">
                💡 Waarom dit schema
              </span>
              <span className="text-blue-400 text-xs">
                {showStrategy ? 'Verbergen ▲' : 'Toon analyse ▼'}
              </span>
            </button>
            {showStrategy && (
              <div className="px-4 pb-4 border-t border-blue-500/20 pt-3 space-y-3">
                <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {cleanStrategyText(strategy)}
                </p>
                {refinements.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-blue-300 mb-1">Op jouw verzoek aangepast:</p>
                    <ul className="text-sm text-gray-400 space-y-0.5">
                      {refinements.map((r, i) => (
                        <li key={i}>• {r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Week view — bij het voorbeeldschema (geen eigen plan) niet tonen */}
        {selectedWeek && week && planId !== 'default' && (
          <>
            <div className="space-y-3">
              {week.days.map((day) => {
                const isToday = selectedWeek === currentWeek && day.dayIndex === todayDayIndex;
                return (
                  <div
                    key={day.dayIndex}
                    ref={isToday ? todayRef : undefined}
                    className="relative"
                    style={isToday ? { scrollMarginTop: 'calc(env(safe-area-inset-top, 0px) + 5rem)' } : undefined}
                  >
                    <TrainingCard training={day} isToday={isToday} dark />
                    {planId !== 'default' && (
                      <button
                        onClick={() => {
                          setAdjustDay({ weekNumber: selectedWeek, day });
                          setAdjustText('');
                          setAdjustError(null);
                        }}
                        className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors"
                        title="Dag aanpassen"
                      >
                        <svg className="w-3.5 h-3.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
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
              <div className="fixed inset-0 bg-black/70 z-[60] flex items-end">
                <div className="bg-[#0d0d0f] border-t border-white/10 w-full rounded-t-3xl max-h-[85vh] flex flex-col animate-slide-up">
                  <div className="flex items-center justify-between p-5 pb-0 flex-shrink-0">
                    <h3 className="text-lg font-semibold text-gray-100">{adjustDay.day.day} aanpassen</h3>
                    <button onClick={() => setAdjustDay(null)} className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                      <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6 6 18M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>

                  <div className="p-5 space-y-4 flex-1 overflow-y-auto">
                    <p className="text-sm text-gray-400">
                      Wat wil je veranderen? De AI past het schema aan (ook de rest van de week als nodig).
                    </p>

                    <textarea
                      value={adjustText}
                      onChange={(e) => setAdjustText(e.target.value)}
                      placeholder="Bijv. 'Kan vandaag niet, verschuif naar morgen' of 'Wil langer fietsen vandaag'"
                      className="w-full bg-white/5 border border-white/10 text-white placeholder:text-gray-500 rounded-xl p-3 text-sm resize-none h-24 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      autoFocus
                    />

                    {adjustError && (
                      <div className="bg-red-500/10 text-red-400 text-sm p-3 rounded-xl">{adjustError}</div>
                    )}
                  </div>

                  <div className="flex gap-3 p-5 pt-0 flex-shrink-0">
                    <button onClick={() => setAdjustDay(null)} className="flex-1 py-3 rounded-xl font-semibold text-gray-300 bg-white/5 border border-white/10">
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

            {/* Hartslagzones legenda — alleen voor de sporten die de atleet traint */}
            <section className="space-y-4">
              {[
                { label: 'Hardlopen', zones: getRunZones(), ltHR: health?.lactateThresholdHR, ltPace: health?.lactateThresholdPace, show: athleteSports.includes('hardlopen') },
                { label: 'Fietsen', zones: getCyclingZones(), show: athleteSports.includes('fietsen') || athleteSports.includes('mountainbike') },
              ].filter(({ show }) => show).map(({ label, zones, ltHR, ltPace }) => (
                <div key={label}>
                  <h2 className="text-base font-semibold text-gray-300 mb-3">
                    Hartslagzones {label.toLowerCase()} (max HR: {zones[4].max})
                  </h2>
                  <div className="bg-[#0d0d0f] rounded-3xl border border-white/5 overflow-hidden">
                    {zones.map((zone, idx) => (
                      <div key={zone.zone} className={`flex items-center justify-between p-3 ${idx < zones.length - 1 ? 'border-b border-white/5' : ''}`}>
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: zone.color }}>
                            {zone.zone}
                          </span>
                          <span className="text-sm font-medium text-gray-200">{zone.label}</span>
                        </div>
                        <span className="text-sm text-gray-400 tabular-nums">{zone.min}–{zone.max} bpm</span>
                      </div>
                    ))}
                    {(ltHR || ltPace) && (
                      <div className="flex items-center justify-between p-3 border-t border-white/5 bg-white/[0.02]">
                        <span className="text-sm font-medium text-gray-300">Lactaatdrempel</span>
                        <span className="text-sm text-gray-200 font-semibold">
                          {ltHR ? `${ltHR} bpm` : ''}{ltHR && ltPace ? ' · ' : ''}{ltPace || ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Zwemtempo's — in het water stuur je op tempo per 100m, niet op hartslag */}
              {swimPaces && athleteSports.includes('zwemmen') && (
                <div>
                  <h2 className="text-base font-semibold text-gray-300 mb-3">
                    Zwemtempo&apos;s (per 100m)
                  </h2>
                  <div className="bg-[#0d0d0f] rounded-3xl border border-white/5 overflow-hidden">
                    {swimPaces.zones.map((t, idx) => {
                      const zoneInfo = HEART_RATE_ZONES.find((z) => z.zone === t.zone)!;
                      return (
                        <div key={t.zone} className={`flex items-center justify-between p-3 ${idx < swimPaces.zones.length - 1 ? 'border-b border-white/5' : ''}`}>
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: zoneInfo.color }}>
                              {t.zone}
                            </span>
                            <span className="text-sm font-medium text-gray-200">{t.label}</span>
                          </div>
                          <span className="text-sm text-gray-400 tabular-nums">{formatSwimPaceRange(t)} /100m</span>
                        </div>
                      );
                    })}
                    <div className="p-3 border-t border-white/5 bg-white/[0.02]">
                      <p className="text-xs text-gray-500">
                        {swimPaces.source === 'handmatig'
                          ? <>Handmatig ingestelde richttempo&apos;s — aan te passen via Data → Instellingen.</>
                          : <>Richttempo&apos;s o.b.v. je laatste {swimPaces.basedOnCount} zwemtrainingen (gemiddeld {formatSwimPace(swimPaces.baseSecPer100)} /100m).</>}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </>
        )}

        {/* Lange termijn seizoensoverzicht */}
        {selectedTab === 'longterm' && (
          <div className="space-y-4">
            <GoalsSection autoOpenResult={goalParam || undefined} dark />

            {/* Fasen tijdlijn */}
            <div className="relative">
              {TRAINING_PHASES.map((phase, idx) => {
                const status = getPhaseStatus(phase, raceDate);
                const dateRange = getPhaseDateRange(phase, raceDate);
                const isCurrent = status === 'current';
                const isDone = status === 'done';
                const progress = isCurrent ? getPhaseProgress(raceDate) : isDone ? 100 : 0;

                return (
                  <div key={phase.id} className="flex gap-3 relative">
                    <div className="flex flex-col items-center w-8 flex-shrink-0">
                      <div
                        className={`w-4 h-4 rounded-full border-2 z-10 ${
                          isCurrent ? 'border-blue-500 bg-blue-500' : isDone ? 'border-gray-600 bg-gray-600' : 'border-white/20 bg-[#0d0d0f]'
                        }`}
                      />
                      {idx < TRAINING_PHASES.length - 1 && (
                        <div className={`w-0.5 flex-1 ${isDone ? 'bg-gray-600' : 'bg-white/10'}`} />
                      )}
                    </div>

                    <div
                      className={`flex-1 mb-4 rounded-3xl p-4 border ${
                        isCurrent
                          ? 'bg-blue-500/10 border-blue-500/40 shadow-[0_0_0_1px_rgba(59,130,246,0.2)]'
                          : isDone
                          ? 'bg-[#0d0d0f] border-white/5 opacity-60'
                          : 'bg-[#0d0d0f] border-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: phase.color }} />
                          <h3 className={`font-semibold ${isCurrent ? 'text-blue-300' : 'text-gray-100'}`}>{phase.label}</h3>
                        </div>
                        {isCurrent && (
                          <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">Nu</span>
                        )}
                        {isDone && (
                          <span className="text-xs text-gray-500">
                            <svg className="w-4 h-4 inline" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-gray-500 mb-2">{dateRange.start} — {dateRange.end}</p>
                      <p className="text-sm text-gray-300 mb-3">{phase.description}</p>

                      <div className="space-y-1">
                        {phase.goals.map((goal, gi) => (
                          <div key={gi} className="flex items-center gap-2">
                            <div
                              className={`w-1.5 h-1.5 rounded-full ${isDone ? 'bg-gray-600' : ''}`}
                              style={!isDone ? { backgroundColor: phase.color } : {}}
                            />
                            <p className="text-xs text-gray-400">{goal}</p>
                          </div>
                        ))}
                      </div>

                      {isCurrent && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-500">Voortgang</span>
                            <span className="text-xs font-medium text-blue-400">{progress}%</span>
                          </div>
                          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, backgroundColor: phase.color }} />
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
      </div>
    </div>
  );
}
