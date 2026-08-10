'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import SeasonBlockList from '@/components/SeasonBlockList';
import {
  getGoals, getUpcomingGoals, buildRaceContextText, buildGoalsHistoryText,
  getActivityArchive, getHealthArchive, getArchivedGoals, getEquipment, getActivityAssignments,
  buildHRZoneText, getProfile, getGarminData,
  getSeasonPlan, saveSeasonPlan, generateId,
} from '@/lib/storage';
import { buildSeasonWeekGrid, formatRangeNL, SeasonWeekSlot } from '@/lib/season';
import { athleteProfilePayload } from '@/lib/athlete';
import { calculateTrainingLoad } from '@/lib/training-load';
import { buildPerformanceSummary } from '@/lib/performance-summary';
import { filterStatsActivities } from '@/lib/equipment';
import { amsterdamDateForOffset } from '@/lib/schedule';
import { cleanStrategyText } from '@/lib/plan-strategy';
import { SeasonBlock } from '@/lib/types';

interface Proposal {
  summary: string;
  rationale: string;
  blocks: SeasonBlock[];
}

export default function SeizoensplanPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [feedback, setFeedback] = useState('');
  const [showRationale, setShowRationale] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);

  useEffect(() => {
    setMounted(true);
    setHasExisting(!!getSeasonPlan());
  }, []);

  const today = mounted ? amsterdamDateForOffset(0) : '';
  const grid: SeasonWeekSlot[] = useMemo(
    () => (mounted ? buildSeasonWeekGrid(today, getGoals()) : []),
    [mounted, today],
  );
  const upcoming = useMemo(() => (mounted ? getUpcomingGoals() : []), [mounted]);

  async function generate() {
    setLoading(true);
    setError(null);

    const garminData = getGarminData();
    const trainingLoad = garminData ? calculateTrainingLoad(garminData.activities, garminData.health) : null;
    const statsActivities = filterStatsActivities(getActivityArchive(), getEquipment(), getActivityAssignments());
    const performanceSummary = buildPerformanceSummary(statsActivities, getHealthArchive(), getArchivedGoals());

    try {
      const res = await fetch('/api/season-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weekGrid: grid,
          raceContext: buildRaceContextText(),
          goalsHistory: buildGoalsHistoryText(),
          performanceSummary,
          trainingLoad,
          hrZoneText: buildHRZoneText(),
          athleteProfile: athleteProfilePayload(getProfile()),
          feedback: feedback.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Genereren mislukt');

      setProposal({ summary: data.summary, rationale: data.rationale || '', blocks: data.blocks });
      setFeedback('');
      setShowRationale(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Er ging iets mis');
    } finally {
      setLoading(false);
    }
  }

  function save() {
    if (!proposal || proposal.blocks.length === 0) return;
    saveSeasonPlan({
      id: generateId(),
      createdAt: new Date().toISOString(),
      startDate: proposal.blocks[0].startDate,
      endDate: proposal.blocks[proposal.blocks.length - 1].endDate,
      goalIds: upcoming.map((g) => g.id),
      summary: proposal.summary,
      rationale: proposal.rationale || undefined,
      blocks: proposal.blocks,
      status: 'active',
    });
    router.push('/schema?tab=longterm');
  }

  if (!mounted) return <div className="px-4 pt-6 pb-24" />;

  // Zonder aankomende wedstrijd valt er geen seizoen te plannen.
  if (grid.length === 0) {
    return (
      <div className="px-4 pt-6 pb-24 space-y-4">
        <button onClick={() => router.push('/schema?tab=longterm')} className="text-sm text-blue-400">
          &larr; Terug naar schema
        </button>
        <h1 className="text-2xl font-bold text-white">Seizoensplan</h1>
        <div className="bg-[#0d0d0f] rounded-3xl border border-white/5 p-5">
          <p className="text-sm text-gray-300">
            Een seizoensplan loopt tot en met je laatste wedstrijd. Voeg eerst een doel toe op de Seizoen-tab.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-24 space-y-5">
      <div>
        <button onClick={() => router.push('/schema?tab=longterm')} className="text-sm text-blue-400 mb-2">
          &larr; Terug naar schema
        </button>
        <h1 className="text-2xl font-bold text-white">Seizoensplan</h1>
        <p className="text-gray-400 text-sm">
          De opbouw in blokken tot je laatste wedstrijd. Elk 2-weeks schema wordt hier een uitwerking van.
        </p>
      </div>

      {/* Wat het plan gaat bestrijken */}
      <div className="bg-[#0d0d0f] rounded-3xl border border-white/5 p-4 space-y-2">
        <p className="text-sm text-gray-300">
          <span className="font-semibold text-white">{grid.length} weken</span> — {formatRangeNL(grid[0].startDate, grid[grid.length - 1].endDate)}
        </p>
        <div className="space-y-1">
          {upcoming.map((g) => (
            <p key={g.id} className="text-xs text-gray-500">
              · {g.name} — {new Date(`${g.date}T00:00:00Z`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}
            </p>
          ))}
        </div>
      </div>

      {!proposal && (
        <>
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">
              Wensen voor dit seizoen (optioneel)
            </label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Bijv. 'in oktober twee weken vakantie', 'eerste race is een test, de tweede is het hoofddoel'"
              className="w-full bg-white/5 border border-white/10 text-white placeholder-gray-500 rounded-xl p-3 text-sm resize-none h-20 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {hasExisting && (
            <p className="text-xs text-amber-400">
              Je hebt al een seizoensplan. Een nieuw plan vervangt het oude.
            </p>
          )}

          <button
            onClick={generate}
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
                Seizoensplan wordt gemaakt...
              </span>
            ) : (
              'Seizoensplan maken'
            )}
          </button>
          {loading && (
            <p className="text-center text-xs text-gray-400 -mt-2">
              De coach kijkt naar je wedstrijden en je belasting van de afgelopen weken — dit duurt ongeveer een halve minuut.
            </p>
          )}
        </>
      )}

      {error && <div className="bg-red-500/10 border border-red-500/20 text-red-300 text-sm p-3 rounded-xl">{error}</div>}

      {proposal && (
        <>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <p className="text-sm text-blue-100 leading-relaxed">{proposal.summary}</p>
          </div>

          {proposal.rationale && (
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowRationale((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <span className="text-sm font-semibold text-gray-200">💡 Waarom dit seizoen</span>
                <span className="text-gray-400 text-xs">{showRationale ? 'Verbergen ▲' : 'Toon analyse ▼'}</span>
              </button>
              {showRationale && (
                <div className="px-4 pb-4 text-sm text-gray-300 whitespace-pre-wrap leading-relaxed border-t border-white/10 pt-3">
                  {cleanStrategyText(proposal.rationale)}
                </div>
              )}
            </div>
          )}

          <SeasonBlockList blocks={proposal.blocks} todayISO={today} />

          <div className="bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-200">Wat wil je anders?</p>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Bijv. 'meer herstelweken', 'de halve marathon is het hoofddoel'"
              className="w-full bg-white/5 border border-white/10 text-white placeholder-gray-500 rounded-lg p-3 text-sm resize-none h-20 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={generate}
              disabled={loading || !feedback.trim()}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-blue-300 bg-blue-500/15 hover:bg-blue-500/25 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Opnieuw maken...' : 'Opnieuw maken met deze wensen'}
            </button>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setProposal(null); setFeedback(''); }}
              className="flex-1 py-3 rounded-xl font-semibold text-gray-200 bg-white/10 hover:bg-white/15 transition-colors"
            >
              Verwerpen
            </button>
            <button
              onClick={save}
              className="flex-1 py-3 rounded-xl font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors"
            >
              Opslaan
            </button>
          </div>
        </>
      )}
    </div>
  );
}
