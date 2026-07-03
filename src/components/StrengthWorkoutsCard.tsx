'use client';

import { useEffect, useState } from 'react';
import { getStrengthWorkouts, saveStrengthWorkout, resetStrengthWorkout } from '@/lib/storage';
import {
  StrengthWorkout,
  StrengthWorkoutId,
  StrengthExercise,
  cloneStrengthWorkout,
} from '@/lib/strength';

const ORDER: StrengthWorkoutId[] = ['core7', 'tri-strength'];

export default function StrengthWorkoutsCard() {
  const [workouts, setWorkouts] = useState<Record<StrengthWorkoutId, StrengthWorkout> | null>(null);
  const [savedId, setSavedId] = useState<StrengthWorkoutId | null>(null);

  useEffect(() => {
    const w = getStrengthWorkouts();
    setWorkouts({
      core7: cloneStrengthWorkout(w.core7),
      'tri-strength': cloneStrengthWorkout(w['tri-strength']),
    });
  }, []);

  if (!workouts) return null;

  function update(id: StrengthWorkoutId, fn: (w: StrengthWorkout) => void) {
    setWorkouts((prev) => {
      if (!prev) return prev;
      const next = cloneStrengthWorkout(prev[id]);
      fn(next);
      return { ...prev, [id]: next };
    });
  }

  function editExercise(id: StrengthWorkoutId, bi: number, ei: number, field: keyof StrengthExercise, value: string) {
    update(id, (w) => {
      w.blocks[bi].exercises[ei] = { ...w.blocks[bi].exercises[ei], [field]: value };
    });
  }

  function moveExercise(id: StrengthWorkoutId, bi: number, ei: number, dir: -1 | 1) {
    update(id, (w) => {
      const list = w.blocks[bi].exercises;
      const j = ei + dir;
      if (j < 0 || j >= list.length) return;
      [list[ei], list[j]] = [list[j], list[ei]];
    });
  }

  function removeExercise(id: StrengthWorkoutId, bi: number, ei: number) {
    update(id, (w) => {
      w.blocks[bi].exercises.splice(ei, 1);
    });
  }

  function addExercise(id: StrengthWorkoutId, bi: number) {
    update(id, (w) => {
      w.blocks[bi].exercises.push({ name: 'Nieuwe oefening', prescription: '' });
    });
  }

  function save(id: StrengthWorkoutId) {
    if (!workouts) return;
    saveStrengthWorkout(workouts[id]);
    setSavedId(id);
    setTimeout(() => setSavedId((s) => (s === id ? null : s)), 2000);
  }

  function reset(id: StrengthWorkoutId) {
    resetStrengthWorkout(id);
    const fresh = getStrengthWorkouts();
    setWorkouts((prev) => (prev ? { ...prev, [id]: cloneStrengthWorkout(fresh[id]) } : prev));
  }

  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-3">Krachtoefeningen aanpassen</h2>
      <p className="text-xs text-gray-500 mb-3">
        Pas de oefeningen aan die op de Home-tab onder &ldquo;Training vandaag&rdquo; verschijnen bij een krachtsessie.
      </p>

      <div className="space-y-4">
        {ORDER.map((id) => {
          const w = workouts[id];
          return (
            <div key={id} className="bg-[#0d0d0f] rounded-3xl p-4 border border-white/5 space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-semibold text-gray-100">{w.title}</h3>
                <span className="text-xs text-gray-500">{w.focus}</span>
              </div>

              <input
                value={w.intro || ''}
                onChange={(e) => update(id, (x) => { x.intro = e.target.value; })}
                placeholder="Korte introtekst (optioneel)"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-gray-300 placeholder:text-gray-500"
              />

              {w.blocks.map((block, bi) => (
                <div key={bi} className="rounded-lg border border-white/5 bg-white/[0.03] p-2.5 space-y-2">
                  <input
                    value={block.label}
                    onChange={(e) => update(id, (x) => { x.blocks[bi].label = e.target.value; })}
                    className="w-full bg-transparent text-sm font-semibold text-rose-400 px-1 py-0.5 focus:outline-none focus:bg-white/10 focus:rounded"
                  />

                  <div className="space-y-2">
                    {block.exercises.map((ex, ei) => (
                      <div key={ei} className="bg-white/[0.03] rounded-lg border border-white/10 p-2">
                        <div className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded bg-rose-500/15 text-rose-400 text-[11px] font-bold flex items-center justify-center flex-shrink-0 tabular-nums">
                            {ei + 1}
                          </span>
                          <input
                            value={ex.name}
                            onChange={(e) => editExercise(id, bi, ei, 'name', e.target.value)}
                            placeholder="Oefening"
                            className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm font-medium text-gray-100 placeholder:text-gray-500"
                          />
                          <input
                            value={ex.prescription}
                            onChange={(e) => editExercise(id, bi, ei, 'prescription', e.target.value)}
                            placeholder="3×12"
                            className="w-20 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm text-center text-gray-100 placeholder:text-gray-500"
                          />
                          <div className="flex flex-col">
                            <button onClick={() => moveExercise(id, bi, ei, -1)} disabled={ei === 0} className="text-gray-500 disabled:opacity-25 leading-none px-1" title="Omhoog">▲</button>
                            <button onClick={() => moveExercise(id, bi, ei, 1)} disabled={ei === block.exercises.length - 1} className="text-gray-500 disabled:opacity-25 leading-none px-1" title="Omlaag">▼</button>
                          </div>
                          <button onClick={() => removeExercise(id, bi, ei)} className="text-gray-600 hover:text-red-400 px-1" title="Verwijderen">✕</button>
                        </div>
                        <input
                          value={ex.note || ''}
                          onChange={(e) => editExercise(id, bi, ei, 'note', e.target.value)}
                          placeholder="Techniektip (optioneel)"
                          className="w-full mt-1.5 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-gray-400 placeholder:text-gray-500"
                        />
                      </div>
                    ))}
                  </div>

                  <button onClick={() => addExercise(id, bi)} className="text-xs font-medium text-rose-400 hover:text-rose-300">
                    + Oefening toevoegen
                  </button>
                </div>
              ))}

              <div className="flex gap-2 pt-1">
                <button onClick={() => save(id)} className="flex-1 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700">
                  {savedId === id ? '✓ Opgeslagen' : 'Opslaan'}
                </button>
                <button onClick={() => reset(id)} className="px-3 py-2 rounded-xl text-sm font-medium text-gray-300 bg-white/5 border border-white/10 hover:bg-white/10">
                  Standaard
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
