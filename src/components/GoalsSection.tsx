'use client';

import { useState, useEffect } from 'react';
import { Goal, GoalResult, GoalSplit, GOAL_TYPES, GoalType, DisciplineDistances } from '@/lib/types';
import {
  getGoals,
  getUpcomingGoals,
  getArchivedGoals,
  saveGoal,
  deleteGoal,
  archiveGoal,
  goalIsMultiSport,
  formatDuration,
  parseDuration,
  generateId,
} from '@/lib/storage';

interface GoalsSectionProps {
  onGoalChange?: () => void;
  autoOpenResult?: string; // goal id voor auto-open resultaat-modal
  dark?: boolean;
}

export default function GoalsSection({ onGoalChange, autoOpenResult, dark = false }: GoalsSectionProps) {
  const [upcoming, setUpcoming] = useState<Goal[]>([]);
  const [archived, setArchived] = useState<Goal[]>([]);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [resultGoal, setResultGoal] = useState<Goal | null>(null);
  const [showSchemaPrompt, setShowSchemaPrompt] = useState<Goal | null>(null);

  const refresh = () => {
    setUpcoming(getUpcomingGoals());
    setArchived(getArchivedGoals());
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (autoOpenResult) {
      const goals = getGoals();
      const g = goals.find(g => g.id === autoOpenResult);
      if (g) setResultGoal(g);
    }
  }, [autoOpenResult]);

  const daysUntil = (dateStr: string): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const race = new Date(dateStr);
    race.setHours(0, 0, 0, 0);
    return Math.ceil((race.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const formatDate = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('nl-NL', {
      day: 'numeric', month: 'long', year: 'numeric',
    });
  };

  const typeLabel = (type: GoalType) =>
    GOAL_TYPES.find(t => t.type === type)?.label || type;

  return (
    <div className="space-y-4">
      {/* Aankomende doelen */}
      {upcoming.length > 0 ? (
        <div className="space-y-3">
          {upcoming.map((g, idx) => (
            <div
              key={g.id}
              className={dark
                ? `rounded-3xl p-4 border ${idx === 0 ? 'bg-blue-500/10 border-blue-500/40' : 'bg-[#0d0d0f] border-white/5'}`
                : `rounded-xl p-4 border ${idx === 0 ? 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200' : 'bg-white border-gray-200'}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  {idx === 0 && (
                    <p className={`text-xs font-semibold uppercase tracking-wide mb-0.5 ${dark ? 'text-blue-400' : 'text-blue-700'}`}>Volgende wedstrijd</p>
                  )}
                  <h3 className={`font-bold ${dark ? 'text-white' : 'text-gray-900'} ${idx === 0 ? 'text-lg' : 'text-base'}`}>{g.name}</h3>
                  <p className={`text-xs ${dark ? 'text-gray-500' : 'text-gray-500'}`}>{typeLabel(g.type)}</p>
                </div>
                <button
                  onClick={() => setEditGoal(g)}
                  className={`text-xs font-medium px-2 py-1 rounded ${dark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
                >
                  Wijzig
                </button>
              </div>

              <div className={`flex items-center gap-4 text-sm mt-2 ${dark ? 'text-gray-200' : ''}`}>
                <div>
                  <p className="text-xs text-gray-500">Datum</p>
                  <p className="font-semibold">{formatDate(g.date)}</p>
                </div>
                {g.targetTimeSeconds && (
                  <div>
                    <p className="text-xs text-gray-500">Streeftijd</p>
                    <p className="font-semibold">{formatDuration(g.targetTimeSeconds)}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500">Nog</p>
                  <p className="font-semibold">{daysUntil(g.date)} dagen</p>
                </div>
              </div>

              {g.location && (
                <p className="text-xs text-gray-500 mt-2">📍 {g.location}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className={dark ? 'bg-[#0d0d0f] rounded-3xl p-4 border border-white/5 text-center' : 'bg-gray-50 rounded-xl p-4 border border-gray-200 text-center'}>
          <p className="text-sm text-gray-500">Nog geen wedstrijden gepland</p>
        </div>
      )}

      {/* Archief */}
      {archived.length > 0 && (
        <div className={dark ? 'bg-[#0d0d0f] rounded-3xl border border-white/5 overflow-hidden' : 'bg-white rounded-xl border border-gray-200 overflow-hidden'}>
          <button
            onClick={() => setArchiveOpen(v => !v)}
            className={`w-full flex items-center justify-between p-4 ${dark ? 'hover:bg-white/[0.03]' : 'hover:bg-gray-50'}`}
          >
            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold ${dark ? 'text-gray-200' : 'text-gray-700'}`}>Eerdere doelen</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${dark ? 'bg-white/10 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                {archived.length}
              </span>
            </div>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${archiveOpen ? 'rotate-180' : ''}`}
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {archiveOpen && (
            <div className={dark ? 'border-t border-white/5 divide-y divide-white/5' : 'border-t border-gray-100 divide-y divide-gray-100'}>
              {archived.map(g => (
                <ArchiveRow
                  key={g.id}
                  goal={g}
                  onEdit={() => setEditGoal(g)}
                  formatDate={formatDate}
                  typeLabel={typeLabel}
                  dark={dark}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Nieuw doel knop */}
      <button
        onClick={() => setShowNew(true)}
        className={`w-full py-3 rounded-xl border-2 border-dashed transition-colors font-semibold text-sm ${
          dark
            ? 'border-blue-500/40 text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/60'
            : 'border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-400'
        }`}
      >
        + Nieuw doel
      </button>

      {/* Modals */}
      {(editGoal || showNew) && (
        <GoalFormModal
          goal={editGoal}
          onClose={() => {
            setEditGoal(null);
            setShowNew(false);
          }}
          onSave={(g, isNew) => {
            saveGoal(g);
            setEditGoal(null);
            setShowNew(false);
            refresh();
            onGoalChange?.();
            if (isNew) setShowSchemaPrompt(g);
          }}
          onDelete={(id) => {
            if (confirm('Weet je zeker dat je dit doel wilt verwijderen?')) {
              deleteGoal(id);
              setEditGoal(null);
              refresh();
              onGoalChange?.();
            }
          }}
        />
      )}

      {resultGoal && (
        <GoalResultModal
          goal={resultGoal}
          onClose={() => setResultGoal(null)}
          onSave={(result) => {
            archiveGoal(resultGoal.id, result);
            setResultGoal(null);
            refresh();
            onGoalChange?.();
          }}
        />
      )}

      {showSchemaPrompt && (
        <SchemaPromptModal
          goal={showSchemaPrompt}
          onClose={() => setShowSchemaPrompt(null)}
          onConfirm={() => {
            setShowSchemaPrompt(null);
            window.location.href = '/schema/nieuw';
          }}
        />
      )}
    </div>
  );
}

// ─── Archive row ────────────────────────────────────────────────

function ArchiveRow({
  goal,
  onEdit,
  formatDate,
  typeLabel,
  dark = false,
}: {
  goal: Goal;
  onEdit: () => void;
  formatDate: (d: string) => string;
  typeLabel: (t: GoalType) => string;
  dark?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const r = goal.result;
  const achieved = r && goal.targetTimeSeconds && r.totalTimeSeconds <= goal.targetTimeSeconds;
  const icon = !r ? '—' : achieved ? '✅' : '⚠️';

  return (
    <div className="p-3">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span>{icon}</span>
            <p className={`text-sm font-semibold truncate ${dark ? 'text-gray-100' : ''}`}>{goal.name}</p>
          </div>
          <p className="text-xs text-gray-500">
            {typeLabel(goal.type)} · {formatDate(goal.date)}
            {r && ` · ${formatDuration(r.totalTimeSeconds)}`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {r && (
            <span className="text-xs text-amber-500">
              {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
            </span>
          )}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className={`mt-3 pt-3 border-t space-y-2 text-sm ${dark ? 'border-white/5' : 'border-gray-100'}`}>
          {r ? (
            <>
              {goal.targetTimeSeconds && (
                <p className="text-xs text-gray-600">
                  Streeftijd: <span className="font-semibold">{formatDuration(goal.targetTimeSeconds)}</span>
                  {' · '}Gehaald: <span className="font-semibold">{formatDuration(r.totalTimeSeconds)}</span>
                </p>
              )}
              {r.splits && r.splits.length > 0 && (
                <div className="space-y-0.5">
                  <p className="text-xs text-gray-500">Splittijden:</p>
                  {r.splits.map((s, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="text-gray-600 capitalize">{s.discipline}</span>
                      <span className="font-mono">{formatDuration(s.timeSeconds)}</span>
                    </div>
                  ))}
                </div>
              )}
              {r.timeReflection && (
                <div>
                  <p className="text-xs text-gray-500">Reflectie tijd:</p>
                  <p className="text-xs text-gray-700">{r.timeReflection}</p>
                </div>
              )}
              {r.trainingReflection && (
                <div>
                  <p className="text-xs text-gray-500">Reflectie trainingen:</p>
                  <p className="text-xs text-gray-700 whitespace-pre-wrap">{r.trainingReflection}</p>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-gray-400 italic">Geen resultaat ingevuld</p>
          )}
          <button
            onClick={onEdit}
            className="text-xs text-blue-600 hover:text-blue-700 mt-1"
          >
            Bewerken
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Goal form modal (nieuw / bewerken) ─────────────────────────

function GoalFormModal({
  goal,
  onClose,
  onSave,
  onDelete,
}: {
  goal: Goal | null;
  onClose: () => void;
  onSave: (g: Goal, isNew: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const isNew = !goal;
  const [type, setType] = useState<GoalType>(goal?.type || '10km');
  const [name, setName] = useState(goal?.name || '');
  const [date, setDate] = useState(goal?.date || '');
  const [targetTime, setTargetTime] = useState(
    goal?.targetTimeSeconds ? formatDuration(goal.targetTimeSeconds) : ''
  );
  const [location, setLocation] = useState(goal?.location || '');
  const [note, setNote] = useState(goal?.note || '');
  const [distSwim, setDistSwim] = useState(goal?.disciplineDistancesKm?.swim?.toString() || '');
  const [distBike, setDistBike] = useState(goal?.disciplineDistancesKm?.bike?.toString() || '');
  const [distRun, setDistRun] = useState(goal?.disciplineDistancesKm?.run?.toString() || '');
  const [distRun2, setDistRun2] = useState(goal?.disciplineDistancesKm?.run2?.toString() || '');

  const typeInfo = GOAL_TYPES.find(t => t.type === type);
  const isMultiSport = typeInfo?.multiSport ?? false;
  const isDuatlon = type === 'duatlon';

  function handleSubmit() {
    if (!name.trim() || !date) return;
    let disciplineDistancesKm: DisciplineDistances | undefined;
    if (isMultiSport) {
      const d: DisciplineDistances = {};
      if (distSwim) d.swim = parseFloat(distSwim);
      if (distBike) d.bike = parseFloat(distBike);
      if (distRun) d.run = parseFloat(distRun);
      if (isDuatlon && distRun2) d.run2 = parseFloat(distRun2);
      if (Object.keys(d).length > 0) disciplineDistancesKm = d;
    }
    const newGoal: Goal = {
      id: goal?.id || generateId(),
      type,
      name: name.trim(),
      date,
      targetTimeSeconds: targetTime ? parseDuration(targetTime) : undefined,
      disciplineDistancesKm,
      location: location.trim() || undefined,
      note: note.trim() || undefined,
      status: goal?.status || 'active',
      result: goal?.result,
      createdAt: goal?.createdAt || new Date().toISOString(),
      archivedAt: goal?.archivedAt,
    };
    onSave(newGoal, isNew);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 pb-20 sm:pb-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col">
        <div className="p-5 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">{isNew ? 'Nieuw doel' : 'Doel bewerken'}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as GoalType)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              {GOAL_TYPES.map(t => (
                <option key={t.type} value={t.type}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Naam *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Bijv. 1/4 Triatlon Eindhoven"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Datum *</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              Streeftijd (optioneel, bv "2:55" of "45:00")
            </label>
            <input
              type="text"
              value={targetTime}
              onChange={(e) => setTargetTime(e.target.value)}
              placeholder="hh:mm:ss of mm:ss"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Locatie (optioneel)</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Bijv. Eindhoven"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {isMultiSport && (
            <div>
              <label className="text-xs font-medium text-gray-600 mb-2 block">
                Afstanden per onderdeel (km, optioneel)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {!isDuatlon && (
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Zwemmen</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={distSwim}
                      onChange={(e) => setDistSwim(e.target.value)}
                      placeholder="bv. 1.5"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                )}
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Fietsen</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={distBike}
                    onChange={(e) => setDistBike(e.target.value)}
                    placeholder="bv. 40"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">{isDuatlon ? 'Lopen (1e)' : 'Lopen'}</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={distRun}
                    onChange={(e) => setDistRun(e.target.value)}
                    placeholder="bv. 10"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                {isDuatlon && (
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Lopen (2e)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={distRun2}
                      onChange={(e) => setDistRun2(e.target.value)}
                      placeholder="bv. 5"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Notitie (optioneel)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Bijzonderheden, parcours, etc."
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
            />
          </div>
        </div>

        <div className="p-5 border-t border-gray-100 flex gap-2 flex-shrink-0">
          {!isNew && goal && (
            <button
              onClick={() => onDelete(goal.id)}
              className="px-4 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50"
            >
              Verwijderen
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
          >
            Annuleren
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || !date}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            Opslaan
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Result invul modal ────────────────────────────────────────

function GoalResultModal({
  goal,
  onClose,
  onSave,
}: {
  goal: Goal;
  onClose: () => void;
  onSave: (r: GoalResult) => void;
}) {
  const multi = goalIsMultiSport(goal);
  const disciplines = GOAL_TYPES.find(t => t.type === goal.type)?.disciplines || [];

  const [totalTime, setTotalTime] = useState(
    goal.result ? formatDuration(goal.result.totalTimeSeconds) : ''
  );
  const [splits, setSplits] = useState<{ discipline: string; time: string }[]>(() => {
    if (goal.result?.splits) {
      return goal.result.splits.map(s => ({
        discipline: s.discipline,
        time: formatDuration(s.timeSeconds),
      }));
    }
    if (multi) {
      // Standaard: disciplines + T1/T2 bij triatlon
      const result: { discipline: string; time: string }[] = [];
      disciplines.forEach((d, i) => {
        result.push({ discipline: d, time: '' });
        if (i < disciplines.length - 1) {
          result.push({ discipline: `T${i + 1}`, time: '' });
        }
      });
      return result;
    }
    return [];
  });
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5>(goal.result?.rating || 3);
  const [timeReflection, setTimeReflection] = useState(goal.result?.timeReflection || '');
  const [trainingReflection, setTrainingReflection] = useState(goal.result?.trainingReflection || '');

  function handleSubmit() {
    const totalSec = parseDuration(totalTime);
    if (totalSec <= 0) {
      alert('Vul een geldige eindtijd in');
      return;
    }
    const splitsArr: GoalSplit[] = multi
      ? splits
          .filter(s => s.time.trim())
          .map(s => ({ discipline: s.discipline, timeSeconds: parseDuration(s.time) }))
      : [];

    onSave({
      totalTimeSeconds: totalSec,
      splits: splitsArr.length > 0 ? splitsArr : undefined,
      rating,
      timeReflection: timeReflection.trim(),
      trainingReflection: trainingReflection.trim(),
      filledAt: new Date().toISOString(),
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 pb-20 sm:pb-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col">
        <div className="p-5 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">🏁 Resultaat invullen</h2>
              <p className="text-xs text-gray-500">{goal.name}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
<div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Eindtijd * (hh:mm:ss)</label>
            <input
              type="text"
              value={totalTime}
              onChange={(e) => setTotalTime(e.target.value)}
              placeholder="bv. 2:54:12"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
            />
            {goal.targetTimeSeconds && (
              <p className="text-xs text-gray-500 mt-1">
                Streeftijd: {formatDuration(goal.targetTimeSeconds)}
              </p>
            )}
          </div>

          {multi && (
            <div>
              <label className="text-xs font-medium text-gray-600 mb-2 block">Splittijden per onderdeel</label>
              <div className="space-y-2">
                {splits.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 w-20 capitalize">{s.discipline}</span>
                    <input
                      type="text"
                      value={s.time}
                      onChange={(e) => {
                        const next = [...splits];
                        next[i].time = e.target.value;
                        setSplits(next);
                      }}
                      placeholder="mm:ss"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Beoordeling</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setRating(n as 1 | 2 | 3 | 4 | 5)}
                  className={`text-2xl ${n <= rating ? 'text-amber-400' : 'text-gray-300'}`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Reflectie over de tijd</label>
            <textarea
              value={timeReflection}
              onChange={(e) => setTimeReflection(e.target.value)}
              placeholder="Hoe verhoudt je tijd zich tot je doel?"
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Reflectie over de trainingen</label>
            <textarea
              value={trainingReflection}
              onChange={(e) => setTrainingReflection(e.target.value)}
              placeholder="Wat werkte? Wat niet? Wat neem je mee naar het volgende doel?"
              rows={5}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
            />
          </div>
        </div>

        <div className="p-5 border-t border-gray-100 flex gap-2 justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
          >
            Later
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700"
          >
            Opslaan & archiveren
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Schema genereren prompt ────────────────────────────────────

function SchemaPromptModal({
  goal,
  onClose,
  onConfirm,
}: {
  goal: Goal;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4">
        <h2 className="text-lg font-bold">Nieuw schema maken?</h2>
        <p className="text-sm text-gray-600">
          Je hebt een nieuw doel gemaakt ({goal.name}). Wil je ook een nieuw trainingsschema
          laten genereren dat bij dit doel past?
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
          >
            Nu niet
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700"
          >
            Ja, genereer
          </button>
        </div>
      </div>
    </div>
  );
}
