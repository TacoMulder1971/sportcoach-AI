'use client';

import { useState, useEffect } from 'react';
import { Goal, GoalResult, GoalSplit, GOAL_TYPES, GoalType } from '@/lib/types';
import {
  getGoals,
  getActiveGoal,
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
}

export default function GoalsSection({ onGoalChange, autoOpenResult }: GoalsSectionProps) {
  const [active, setActive] = useState<Goal | null>(null);
  const [archived, setArchived] = useState<Goal[]>([]);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [resultGoal, setResultGoal] = useState<Goal | null>(null);
  const [showSchemaPrompt, setShowSchemaPrompt] = useState<Goal | null>(null);

  const refresh = () => {
    setActive(getActiveGoal());
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
      {/* Actief doel */}
      {active ? (
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-xs text-blue-700 font-semibold uppercase tracking-wide">Actief doel</p>
              <h3 className="text-lg font-bold text-gray-900">{active.name}</h3>
              <p className="text-xs text-gray-500">{typeLabel(active.type)}</p>
            </div>
            <button
              onClick={() => setEditGoal(active)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded"
            >
              Wijzig
            </button>
          </div>

          <div className="flex items-center gap-4 text-sm mt-3">
            <div>
              <p className="text-xs text-gray-500">Datum</p>
              <p className="font-semibold">{formatDate(active.date)}</p>
            </div>
            {active.targetTimeSeconds && (
              <div>
                <p className="text-xs text-gray-500">Streeftijd</p>
                <p className="font-semibold">{formatDuration(active.targetTimeSeconds)}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500">Nog</p>
              <p className="font-semibold">
                {daysUntil(active.date) >= 0
                  ? `${daysUntil(active.date)} dagen`
                  : 'Voorbij'}
              </p>
            </div>
          </div>

          {active.location && (
            <p className="text-xs text-gray-500 mt-2">📍 {active.location}</p>
          )}

          {daysUntil(active.date) < 0 && (
            <button
              onClick={() => setResultGoal(active)}
              className="w-full mt-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
            >
              Resultaat invullen
            </button>
          )}
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 text-center">
          <p className="text-sm text-gray-500">Nog geen doel ingesteld</p>
        </div>
      )}

      {/* Archief */}
      {archived.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button
            onClick={() => setArchiveOpen(v => !v)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">Eerdere doelen</span>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
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
            <div className="border-t border-gray-100 divide-y divide-gray-100">
              {archived.map(g => (
                <ArchiveRow
                  key={g.id}
                  goal={g}
                  onEdit={() => setEditGoal(g)}
                  formatDate={formatDate}
                  typeLabel={typeLabel}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Nieuw doel knop */}
      <button
        onClick={() => setShowNew(true)}
        className="w-full py-3 rounded-xl border-2 border-dashed border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-400 transition-colors font-semibold text-sm"
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
}: {
  goal: Goal;
  onEdit: () => void;
  formatDate: (d: string) => string;
  typeLabel: (t: GoalType) => string;
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
            <p className="text-sm font-semibold truncate">{goal.name}</p>
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
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2 text-sm">
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

  function handleSubmit() {
    if (!name.trim() || !date) return;
    const newGoal: Goal = {
      id: goal?.id || generateId(),
      type,
      name: name.trim(),
      date,
      targetTimeSeconds: targetTime ? parseDuration(targetTime) : undefined,
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-gray-100 sticky top-0 bg-white">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">{isNew ? 'Nieuw doel' : 'Doel bewerken'}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
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

        <div className="p-5 border-t border-gray-100 flex gap-2 sticky bottom-0 bg-white">
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-gray-100 sticky top-0 bg-white">
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

        <div className="p-5 space-y-4">
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

        <div className="p-5 border-t border-gray-100 flex gap-2 justify-end sticky bottom-0 bg-white">
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
