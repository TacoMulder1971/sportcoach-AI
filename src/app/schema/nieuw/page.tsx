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
import { AgendaInput, TrainingWeek } from '@/lib/types';

const DAY_NAMES = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

export default function NieuwSchemaPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Stap 1: Agenda
  const [blocked, setBlocked] = useState<Set<string>>(new Set()); // "1-0", "2-3" etc
  const [constraints, setConstraints] = useState('');

  // Stap 2: Genereren
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<TrainingWeek[] | null>(null);
  const [previewWeek, setPreviewWeek] = useState<1 | 2>(1);

  function toggleDay(weekNum: 1 | 2, dayIndex: number) {
    const key = `${weekNum}-${dayIndex}`;
    setBlocked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function generatePlan() {
    setLoading(true);
    setError(null);

    const agenda: AgendaInput = {
      blockedDays: Array.from(blocked).map((key) => {
        const [w, d] = key.split('-').map(Number);
        return { weekNumber: w as 1 | 2, dayIndex: d };
      }),
      constraints,
    };

    const { plan: previousPlan } = getActivePlan();
    const garminData = getGarminData();
    const checkIns = getRecentCheckIns(10);
    const trainingLoad = garminData
      ? calculateTrainingLoad(garminData.activities, garminData.health)
      : null;
    const daysUntilRace = getDaysUntilRace('2026-06-13');

    try {
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
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Genereren mislukt');

      setProposal(data.plan);
      setPreviewWeek(1);
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Er ging iets mis');
    } finally {
      setLoading(false);
    }
  }

  function approvePlan() {
    if (!proposal) return;

    const agenda: AgendaInput = {
      blockedDays: Array.from(blocked).map((key) => {
        const [w, d] = key.split('-').map(Number);
        return { weekNumber: w as 1 | 2, dayIndex: d };
      }),
      constraints,
    };

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

  // Stap 1: Agenda invoer
  if (step === 1) {
    return (
      <div className="px-4 pt-6 space-y-6">
        <div>
          <button onClick={() => router.push('/schema')} className="text-sm text-blue-600 mb-2">
            ← Terug naar schema
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Nieuw schema</h1>
          <p className="text-gray-500 text-sm">Welke dagen kun je de komende 2 weken NIET trainen?</p>
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
                      <div className="text-[10px] text-red-500 mt-0.5">Geen</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

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

        <div className="h-4" />
      </div>
    );
  }

  // Stap 2: Preview
  if (step === 2 && proposal) {
    const week = proposal.find((w) => w.weekNumber === previewWeek);

    return (
      <div className="px-4 pt-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Voorstel</h1>
          <p className="text-gray-500 text-sm">Bekijk het voorgestelde schema</p>
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

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => {
              setProposal(null);
              setStep(1);
              generatePlan();
            }}
            className="flex-1 py-3 rounded-xl font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
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

        <div className="h-4" />
      </div>
    );
  }

  // Stap 3: Bevestiging
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
