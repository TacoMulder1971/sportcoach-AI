'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import TrainingCard from '@/components/TrainingCard';
import { getDaysUntilRace, getNextMonday } from '@/lib/schedule';
import {
  getActivePlan, getGarminData, getRecentCheckIns,
  saveStoredPlan, setActivePlanId, generateId,
  getActiveRaceDate, buildRaceContextText, buildGoalsHistoryText,
  getActivityArchive, getHealthArchive, getEquipment, getActivityAssignments, getArchivedGoals,
  buildHRZoneText,
  getProfile,
  buildPlanStrategyText,
} from '@/lib/storage';
import { cleanStrategyText } from '@/lib/plan-strategy';
import { athleteProfilePayload } from '@/lib/athlete';
import { calculateTrainingLoad } from '@/lib/training-load';
import { buildPerformanceSummary } from '@/lib/performance-summary';
import { filterStatsActivities } from '@/lib/equipment';
import { AgendaInput, DayPreference, TrainingWeek } from '@/lib/types';
import { getCurrentPhase, getPhaseProgress, TRAINING_PHASES } from '@/lib/periodization';

const DAY_NAMES = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
const FULL_DAY_NAMES = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];

export default function NieuwSchemaPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Stap 1: Agenda + voorkeuren
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [constraints, setConstraints] = useState('');
  const [preferences, setPreferences] = useState<Record<string, string>>({});

  // Stap 2: Genereren + verfijning
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<TrainingWeek[] | null>(null);
  const [strategy, setStrategy] = useState<string | null>(null);
  const [refinements, setRefinements] = useState<string[]>([]);
  const [showStrategy, setShowStrategy] = useState(false);
  const [previewWeek, setPreviewWeek] = useState<1 | 2>(1);
  const [feedback, setFeedback] = useState('');
  const [refining, setRefining] = useState(false);

  function toggleDay(weekNum: 1 | 2, dayIndex: number) {
    const key = `${weekNum}-${dayIndex}`;
    setBlocked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        // Wis voorkeur als dag geblokkeerd wordt
        setPreferences((p) => {
          const updated = { ...p };
          delete updated[key];
          return updated;
        });
      }
      return next;
    });
  }

  function setPreference(weekNum: 1 | 2, dayIndex: number, value: string) {
    const key = `${weekNum}-${dayIndex}`;
    setPreferences((prev) => ({ ...prev, [key]: value }));
  }

  function buildAgenda(): AgendaInput {
    const blockedDays = Array.from(blocked).map((key) => {
      const [w, d] = key.split('-').map(Number);
      return { weekNumber: w as 1 | 2, dayIndex: d };
    });

    const dayPreferences: DayPreference[] = Object.entries(preferences)
      .filter(([, val]) => val.trim())
      .map(([key, val]) => {
        const [w, d] = key.split('-').map(Number);
        return { weekNumber: w as 1 | 2, dayIndex: d, preference: val.trim() };
      });

    return { blockedDays, constraints, dayPreferences };
  }

  async function generatePlan() {
    setLoading(true);
    setError(null);

    const agenda = buildAgenda();
    const { plan: previousPlan } = getActivePlan();
    const garminData = getGarminData();
    const checkIns = getRecentCheckIns(10);
    const trainingLoad = garminData
      ? calculateTrainingLoad(garminData.activities, garminData.health)
      : null;
    const daysUntilRace = getDaysUntilRace(getActiveRaceDate());

    // Prestatie-samenvatting uit het archief (stadsfiets uitgesloten)
    const statsActivities = filterStatsActivities(
      getActivityArchive(),
      getEquipment(),
      getActivityAssignments(),
    );
    const performanceSummary = buildPerformanceSummary(statsActivities, getHealthArchive(), getArchivedGoals());

    try {
      const currentPhase = getCurrentPhase(getActiveRaceDate());
      const phaseProgress = getPhaseProgress(getActiveRaceDate());
      const nextPhase = TRAINING_PHASES.find(p => p.minDays < currentPhase.minDays) || null;

      const res = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agenda,
          checkIns,
          garminData,
          trainingLoad,
          previousPlan,
          daysUntilRace,
          mode: 'generate',
          currentPhase: {
            label: currentPhase.label,
            description: currentPhase.description,
            goals: currentPhase.goals,
            progressPercent: Math.round(phaseProgress),
          },
          nextPhase: nextPhase ? { label: nextPhase.label } : null,
          raceContext: buildRaceContextText(),
          goalsHistory: buildGoalsHistoryText(),
          performanceSummary,
          hrZoneText: buildHRZoneText(),
          athleteProfile: athleteProfilePayload(getProfile()),
          previousStrategy: buildPlanStrategyText(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Genereren mislukt');

      setProposal(data.plan);
      setStrategy(data.strategy || null);
      setRefinements([]);
      setShowStrategy(false);
      setPreviewWeek(1);
      setFeedback('');
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Er ging iets mis');
    } finally {
      setLoading(false);
    }
  }

  async function refinePlan() {
    if (!proposal || !feedback.trim()) return;
    setRefining(true);
    setError(null);

    const daysUntilRace = getDaysUntilRace(getActiveRaceDate());

    try {
      const res = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'refine',
          currentProposal: proposal,
          refinementFeedback: feedback.trim(),
          daysUntilRace,
          raceContext: buildRaceContextText(),
          hrZoneText: buildHRZoneText(),
          athleteProfile: athleteProfilePayload(getProfile()),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Aanpassen mislukt');

      setProposal(data.plan);
      setRefinements((prev) => [...prev, feedback.trim()]);
      setPreviewWeek(1);
      setFeedback('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Er ging iets mis');
    } finally {
      setRefining(false);
    }
  }

  function approvePlan() {
    if (!proposal) return;

    const agenda = buildAgenda();
    const id = generateId();
    const cycleStartDate = getNextMonday();

    saveStoredPlan({
      id,
      plan: proposal,
      cycleStartDate,
      createdAt: new Date().toISOString(),
      agendaInput: agenda,
      status: 'active',
      strategy: strategy || undefined,
      refinements: refinements.length > 0 ? refinements : undefined,
    });
    setActivePlanId(id);
    setStep(3);
  }

  // --- STAP 1: Beschikbaarheid + voorkeuren ---
  if (step === 1) {
    return (
      <div className="px-4 pt-6 pb-24 space-y-6">
        <div>
          <button onClick={() => router.push('/schema')} className="text-sm text-blue-400 mb-2">
            &larr; Terug naar schema
          </button>
          <h1 className="text-2xl font-bold text-white">Nieuw schema</h1>
          <p className="text-gray-400 text-sm">Tik op dagen waarop je NIET kunt trainen</p>
        </div>

        {/* 14-daags grid */}
        {([1, 2] as const).map((weekNum) => (
          <div key={weekNum}>
            <p className="text-sm font-semibold text-gray-300 mb-2">Week {weekNum}</p>
            <div className="grid grid-cols-7 gap-1.5">
              {DAY_NAMES.map((name, idx) => {
                const key = `${weekNum}-${idx}`;
                const isBlocked = blocked.has(key);
                return (
                  <button
                    key={key}
                    onClick={() => toggleDay(weekNum, idx)}
                    className={`py-3 rounded-lg text-center text-sm font-medium transition-all ${
                      isBlocked
                        ? 'bg-red-500/20 text-red-300 border-2 border-red-500/40'
                        : 'bg-white/5 text-gray-200 border border-white/10'
                    }`}
                  >
                    {name}
                    {isBlocked && (
                      <div className="text-[10px] text-red-400 mt-0.5">Niet</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Dagvoorkeuren */}
        <div>
          <p className="text-sm font-semibold text-gray-300 mb-2">
            Heb je specifieke plannen per dag? (optioneel)
          </p>
          <p className="text-xs text-gray-500 mb-3">
            Bijv. &quot;ochtend zwemmen, avond hardlopen&quot; of &quot;alleen korte training&quot;
          </p>
          <div className="space-y-2">
            {([1, 2] as const).map((weekNum) => {
              const availableDays = DAY_NAMES.map((name, idx) => ({
                name,
                fullName: FULL_DAY_NAMES[idx],
                idx,
                key: `${weekNum}-${idx}`,
              })).filter((d) => !blocked.has(d.key));

              if (availableDays.length === 0) return null;

              return (
                <div key={weekNum}>
                  <p className="text-xs font-medium text-gray-500 mb-1.5">Week {weekNum}</p>
                  {availableDays.map((d) => (
                    <div key={d.key} className="flex items-center gap-2 mb-1.5">
                      <span className="text-sm font-medium text-gray-200 w-8 flex-shrink-0">{d.name}</span>
                      <input
                        type="text"
                        value={preferences[d.key] || ''}
                        onChange={(e) => setPreference(weekNum, d.idx, e.target.value)}
                        placeholder={`Voorkeur voor ${d.fullName.toLowerCase()}...`}
                        className="flex-1 bg-white/5 border border-white/10 text-white placeholder-gray-500 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Extra opmerkingen */}
        <div>
          <label className="text-sm font-medium text-gray-300 mb-2 block">
            Extra opmerkingen (optioneel)
          </label>
          <textarea
            value={constraints}
            onChange={(e) => setConstraints(e.target.value)}
            placeholder="Bijv. 'reis naar Madrid di-do week 2', 'drukke werkweek, minder intensief'"
            className="w-full bg-white/5 border border-white/10 text-white placeholder-gray-500 rounded-xl p-3 text-sm resize-none h-20 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <button
          onClick={generatePlan}
          disabled={loading}
          className="w-full py-3 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-all"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:0.1s]" />
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce [animation-delay:0.2s]" />
              </span>
              Schema wordt gegenereerd...
            </span>
          ) : (
            'Schema genereren'
          )}
        </button>
        {loading && (
          <p className="text-center text-xs text-gray-400 -mt-2">
            De coach analyseert je prestaties van de afgelopen weken — dit duurt ongeveer een halve minuut.
          </p>
        )}

        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl">{error}</div>
        )}
      </div>
    );
  }

  // --- STAP 2: Preview + verfijning ---
  if (step === 2 && proposal) {
    const week = proposal.find((w) => w.weekNumber === previewWeek);

    return (
      <div className="px-4 pt-6 pb-24 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Voorstel</h1>
          <p className="text-gray-400 text-sm">Bekijk het schema en geef feedback</p>
        </div>

        {/* Waarom dit schema — coachstrategie obv recente prestaties */}
        {strategy && (
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
              <div className="px-4 pb-4 text-sm text-gray-300 whitespace-pre-wrap leading-relaxed border-t border-blue-500/20 pt-3">
                {cleanStrategyText(strategy)}
              </div>
            )}
          </div>
        )}

        {/* Week selector */}
        <div className="flex gap-2">
          {([1, 2] as const).map((num) => {
            const weekData = proposal.find((w) => w.weekNumber === num);
            return (
              <button
                key={num}
                onClick={() => setPreviewWeek(num)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  previewWeek === num
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-white/5 text-gray-200 border border-white/10'
                }`}
              >
                {weekData?.label || `Week ${num}`}
              </button>
            );
          })}
        </div>

        {/* Training days */}
        <div className="space-y-3">
          {week?.days.map((day) => (
            <TrainingCard key={day.dayIndex} training={day} isToday={false} dark />
          ))}
        </div>

        {/* Feedback voor verfijning */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-200">Wat wil je aanpassen?</p>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Bijv. 'Donderdag liever zwemmen i.p.v. hardlopen', 'Zondag iets korter', 'Meer interval trainingen'"
            className="w-full bg-white/5 border border-white/10 text-white placeholder-gray-500 rounded-lg p-3 text-sm resize-none h-20 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={refinePlan}
            disabled={refining || !feedback.trim()}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-blue-300 bg-blue-500/15 hover:bg-blue-500/25 disabled:opacity-50 transition-colors"
          >
            {refining ? (
              <span className="flex items-center justify-center gap-2">
                <span className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                </span>
                Schema wordt aangepast...
              </span>
            ) : (
              'Aanpassen'
            )}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-xl">{error}</div>
        )}

        {/* Actieknoppen */}
        <div className="flex gap-3">
          <button
            onClick={() => {
              setProposal(null);
              setStrategy(null);
              setRefinements([]);
              setFeedback('');
              setStep(1);
            }}
            className="flex-1 py-3 rounded-xl font-semibold text-gray-200 bg-white/10 hover:bg-white/15 transition-colors"
          >
            Opnieuw
          </button>
          <button
            onClick={approvePlan}
            className="flex-1 py-3 rounded-xl font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors"
          >
            Goedkeuren
          </button>
        </div>
      </div>
    );
  }

  // --- STAP 3: Bevestiging ---
  return (
    <div className="px-4 pt-6 space-y-6">
      <div className="text-center py-8">
        <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Schema opgeslagen!</h1>
        <p className="text-gray-400 text-sm">
          Je nieuwe trainingsschema is actief vanaf aanstaande maandag.
        </p>
      </div>

      <button
        onClick={() => router.push('/schema')}
        className="w-full py-3 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-all"
      >
        Bekijk schema
      </button>

      <div className="h-4" />
    </div>
  );
}
