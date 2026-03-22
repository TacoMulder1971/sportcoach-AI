'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import TrainingCard from '@/components/TrainingCard';
import { getDaysUntilRace, getNextMonday } from '@/lib/schedule';
import {
  getActivePlan, getGarminData, getRecentCheckIns,
  saveStoredPlan, setActivePlanId, generateId,
} from '@/lib/storage';
import { calculateTrainingLoad } from '@/lib/training-load';
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
    const daysUntilRace = getDaysUntilRace('2026-06-13');

    try {
      const currentPhase = getCurrentPhase();
      const phaseProgress = getPhaseProgress();
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
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Genereren mislukt');

      setProposal(data.plan);
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

    const daysUntilRace = getDaysUntilRace('2026-06-13');

    try {
      const res = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'refine',
          currentProposal: proposal,
          refinementFeedback: feedback.trim(),
          daysUntilRace,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Aanpassen mislukt');

      setProposal(data.plan);
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
    });
    setActivePlanId(id);
    setStep(3);
  }

  // --- STAP 1: Beschikbaarheid + voorkeuren ---
  if (step === 1) {
    return (
      <div className="px-4 pt-6 pb-24 space-y-6">
        <div>
          <button onClick={() => router.push('/schema')} className="text-sm text-blue-600 mb-2">
            &larr; Terug naar schema
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Nieuw schema</h1>
          <p className="text-gray-500 text-sm">Tik op dagen waarop je NIET kunt trainen</p>
        </div>

        {/* 14-daags grid */}
        {([1, 2] as const).map((weekNum) => (
          <div key={weekNum}>
            <p className="text-sm font-semibold text-gray-700 mb-2">Week {weekNum}</p>
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
                        ? 'bg-red-100 text-red-700 border-2 border-red-300'
                        : 'bg-white text-gray-700 border border-gray-200'
                    }`}
                  >
                    {name}
                    {isBlocked && (
                      <div className="text-[10px] text-red-500 mt-0.5">Niet</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Dagvoorkeuren */}
        <div>
          <p className="text-sm font-semibold text-gray-700 mb-2">
            Heb je specifieke plannen per dag? (optioneel)
          </p>
          <p className="text-xs text-gray-400 mb-3">
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
                      <span className="text-sm font-medium text-gray-700 w-8 flex-shrink-0">{d.name}</span>
                      <input
                        type="text"
                        value={preferences[d.key] || ''}
                        onChange={(e) => setPreference(weekNum, d.idx, e.target.value)}
                        placeholder={`Voorkeur voor ${d.fullName.toLowerCase()}...`}
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Extra opmerkingen (optioneel)
          </label>
          <textarea
            value={constraints}
            onChange={(e) => setConstraints(e.target.value)}
            placeholder="Bijv. 'reis naar Madrid di-do week 2', 'drukke werkweek, minder intensief'"
            className="w-full border border-gray-300 rounded-xl p-3 text-sm resize-none h-20 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
          <h1 className="text-2xl font-bold text-gray-900">Voorstel</h1>
          <p className="text-gray-500 text-sm">Bekijk het schema en geef feedback</p>
        </div>

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
                    : 'bg-white text-gray-700 border border-gray-200'
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
            <TrainingCard key={day.dayIndex} training={day} isToday={false} />
          ))}
        </div>

        {/* Feedback voor verfijning */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">Wat wil je aanpassen?</p>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Bijv. 'Donderdag liever zwemmen i.p.v. hardlopen', 'Zondag iets korter', 'Meer interval trainingen'"
            className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none h-20 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={refinePlan}
            disabled={refining || !feedback.trim()}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 transition-colors"
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
              setFeedback('');
              setStep(1);
            }}
            className="flex-1 py-3 rounded-xl font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
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
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Schema opgeslagen!</h1>
        <p className="text-gray-500 text-sm">
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
