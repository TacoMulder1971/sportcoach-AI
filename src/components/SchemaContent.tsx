'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import TrainingCard from '@/components/TrainingCard';
import GoalsSection from '@/components/GoalsSection';
import SportIcon from '@/components/SportIcon';
import TodayTrainingDetail from '@/components/TodayTrainingDetail';
import { getCurrentWeekNumber, getTodayDayIndex, getDaysInCurrentCycle, getDaysUntilRace, getTodayTraining, getTrainingForDayOffset, formatDuration } from '@/lib/schedule';
import { getActivePlan, updateActivePlan, shouldAutoBackup, markBackupDone, getGarminData, getActiveRaceDate, buildRaceContextText, buildHRZoneText, getRunZones, getCyclingZones } from '@/lib/storage';
import { TrainingWeek, TrainingDay, TrainingSession, GarminHealthStats, Sport, HeartRateZoneInfo, HEART_RATE_ZONES } from '@/lib/types';
import { TRAINING_PHASES, getPhaseProgress, getPhaseStatus, getPhaseDateRange } from '@/lib/periodization';

type TabSelection = 1 | 2 | 'longterm';

function zonesForSport(sport: Sport): HeartRateZoneInfo[] {
  if (sport === 'hardlopen') return getRunZones();
  if (sport === 'fietsen' || sport === 'mountainbike') return getCyclingZones();
  return HEART_RATE_ZONES;
}

function capitalize(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

const SPORT_LABEL: Record<string, string> = {
  zwemmen: 'Zwemmen', fietsen: 'Fietsen', hardlopen: 'Hardlopen',
  mountainbike: 'Mountainbike', wandelen: 'Wandelen', voetballen: 'Voetballen',
  multisport: 'Multisport', rust: 'Rust',
};

// Gedetailleerde sessie-kaart: alle info om in een Garmin-horloge over te nemen.
function DetailedSession({ session, index, total }: { session: TrainingSession; index: number; total: number }) {
  const zoneInfo = session.zone ? zonesForSport(session.sport).find((z) => z.zone === session.zone) : null;
  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/5 p-4">
      <div className="flex items-center gap-3">
        <SportIcon sport={session.sport} size="2xl" />
        <div className="flex-1 min-w-0">
          {total > 1 && (
            <p className="text-gray-500 text-[11px] font-semibold uppercase tracking-wide">
              Onderdeel {index + 1} van {total}
            </p>
          )}
          <p className="text-base text-gray-100 leading-relaxed">{session.description}</p>
        </div>
      </div>

      {/* Stat-grid: makkelijk over te nemen in Garmin */}
      <div className="grid grid-cols-3 gap-px mt-3 rounded-xl overflow-hidden bg-white/5">
        <div className="bg-[#0d0d0f] p-2.5 text-center">
          <p className="text-gray-500 text-[10px] uppercase tracking-wide">Sport</p>
          <p className="text-gray-100 text-sm font-medium mt-0.5">{SPORT_LABEL[session.sport] || session.sport}</p>
        </div>
        <div className="bg-[#0d0d0f] p-2.5 text-center">
          <p className="text-gray-500 text-[10px] uppercase tracking-wide">Type</p>
          <p className="text-gray-100 text-sm font-medium mt-0.5">{session.type ? capitalize(session.type) : '—'}</p>
        </div>
        <div className="bg-[#0d0d0f] p-2.5 text-center">
          <p className="text-gray-500 text-[10px] uppercase tracking-wide">Duur</p>
          <p className="text-gray-100 text-sm font-medium mt-0.5">{session.durationMinutes ? formatDuration(session.durationMinutes) : '—'}</p>
        </div>
      </div>

      {/* Hartslag-doel — exact bereik voor een Garmin HR-alert */}
      {zoneInfo && (
        <div className="flex items-center justify-between mt-2 rounded-xl px-3 py-2.5" style={{ backgroundColor: `${zoneInfo.color}1a` }}>
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: zoneInfo.color }}>
              {zoneInfo.zone}
            </span>
            <span className="text-sm font-medium" style={{ color: zoneInfo.color }}>{zoneInfo.label}</span>
          </div>
          <span className="text-sm font-bold tabular-nums" style={{ color: zoneInfo.color }}>
            {zoneInfo.min}–{zoneInfo.max} bpm
          </span>
        </div>
      )}
    </div>
  );
}

function DetailedDay({ label, weekday, training }: { label: string; weekday: string; training: TrainingDay | null }) {
  return (
    <div className="bg-[#0d0d0f] rounded-3xl p-4 border border-white/5">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-gray-100 text-base font-semibold">{label}</p>
        <p className="text-gray-500 text-xs uppercase tracking-wide">{weekday}</p>
      </div>
      {!training || training.isRestDay ? (
        <p className="text-gray-500 text-sm">Rustdag — geen training gepland. Focus op herstel.</p>
      ) : (
        <div className="space-y-2">
          {training.sessions.map((s, i) => (
            <DetailedSession key={i} session={s} index={i} total={training.sessions.length} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SchemaContent() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const goalParam = searchParams.get('goal');
  const [plan, setPlan] = useState<TrainingWeek[] | null>(null);
  const [cycleStartDate, setCycleStartDate] = useState<string>('');
  const [planId, setPlanId] = useState<string>('default');
  const [selectedTab, setSelectedTab] = useState<TabSelection>(tabParam === 'longterm' ? 'longterm' : 1);
  const [cycleDay, setCycleDay] = useState(1);
  const [todayTraining, setTodayTraining] = useState<TrainingDay | null>(null);
  const [tomorrowTraining, setTomorrowTraining] = useState<TrainingDay | null>(null);
  const todayDayIndex = getTodayDayIndex();

  // Ad-hoc aanpassing state
  const [adjustDay, setAdjustDay] = useState<{ weekNumber: 1 | 2; day: TrainingDay } | null>(null);
  const [adjustText, setAdjustText] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [showBackupReminder, setShowBackupReminder] = useState(false);
  const [health, setHealth] = useState<GarminHealthStats | null>(null);
  const [raceDate, setRaceDate] = useState<string>('2026-06-13');

  useEffect(() => {
    const active = getActivePlan();
    setPlan(active.plan);
    setCycleStartDate(active.cycleStartDate);
    setPlanId(active.id);
    const currentWeek = getCurrentWeekNumber(active.cycleStartDate);
    if (tabParam !== 'longterm') setSelectedTab(currentWeek);
    setCycleDay(getDaysInCurrentCycle(active.cycleStartDate));
    setShowBackupReminder(shouldAutoBackup());
    setHealth(getGarminData()?.health || null);
    setRaceDate(getActiveRaceDate());
    setTodayTraining(getTodayTraining(active.plan, active.cycleStartDate));
    setTomorrowTraining(getTrainingForDayOffset(1, active.plan, active.cycleStartDate));
  }, [tabParam]);

  const currentWeek = cycleStartDate ? getCurrentWeekNumber(cycleStartDate) : 1;
  const selectedWeek = typeof selectedTab === 'number' ? selectedTab : null;
  const week = selectedWeek ? plan?.find((w) => w.weekNumber === selectedWeek) : null;
  const showNewPlanPrompt = cycleDay >= 11;

  const tomorrowWeekday = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return capitalize(d.toLocaleDateString('nl-NL', { weekday: 'long' }));
  })();
  const todayWeekday = capitalize(new Date().toLocaleDateString('nl-NL', { weekday: 'long' }));

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
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Aanpassen mislukt');

      setPlan(data.plan);
      updateActivePlan(data.plan);
      // Vandaag/morgen-weergave meelopen met de aanpassing
      setTodayTraining(getTodayTraining(data.plan, cycleStartDate));
      setTomorrowTraining(getTrainingForDayOffset(1, data.plan, cycleStartDate));
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

        {/* Detail voor je Garmin — vandaag (uitgesplitst) & morgen */}
        <div className="space-y-3">
          <div>
            <div className="flex items-baseline justify-between mb-2 px-1">
              <p className="text-gray-100 text-base font-semibold">Vandaag</p>
              <p className="text-gray-500 text-xs uppercase tracking-wide">{todayWeekday}</p>
            </div>
            <TodayTrainingDetail training={todayTraining} />
          </div>
          <DetailedDay label={tomorrowWeekday} weekday="Morgen" training={tomorrowTraining} />
        </div>

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

        {/* Week view */}
        {selectedWeek && week && (
          <>
            <div className="space-y-3">
              {week.days.map((day) => {
                const isToday = selectedWeek === currentWeek && day.dayIndex === todayDayIndex;
                return (
                  <div key={day.dayIndex} className="relative">
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
              <div className="fixed inset-0 bg-black/70 z-50 flex items-end">
                <div className="bg-[#0d0d0f] border-t border-white/10 w-full rounded-t-3xl p-5 space-y-4 animate-slide-up">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-100">{adjustDay.day.day} aanpassen</h3>
                    <button onClick={() => setAdjustDay(null)} className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                      <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6 6 18M6 6l12 12"/>
                      </svg>
                    </button>
                  </div>

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

                  <div className="flex gap-3">
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

            {/* Hartslagzones legenda */}
            <section className="space-y-4">
              {[
                { label: 'Hardlopen', zones: getRunZones(), ltHR: health?.lactateThresholdHR, ltPace: health?.lactateThresholdPace },
                { label: 'Fietsen', zones: getCyclingZones() },
              ].map(({ label, zones, ltHR, ltPace }) => (
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
