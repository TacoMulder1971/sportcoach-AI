'use client';

import { useState } from 'react';
import { CheckIn, FEELING_SCALE, TrainingSession } from '@/lib/types';
import { saveCheckIn, generateId } from '@/lib/storage';

interface CheckInFormProps {
  sessions: TrainingSession[];
  dayLabel: string;
  onComplete: () => void;
}

export default function CheckInForm({ sessions, dayLabel, onComplete }: CheckInFormProps) {
  const [feeling, setFeeling] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (feeling === null) return;

    const checkIn: CheckIn = {
      id: generateId(),
      date: new Date().toISOString().split('T')[0],
      trainingDay: dayLabel,
      feeling,
      note,
      sessions,
      createdAt: new Date().toISOString(),
    };

    saveCheckIn(checkIn);
    setSubmitted(true);
    setTimeout(() => onComplete(), 1500);
  };

  if (submitted) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <p className="text-lg font-semibold text-gray-900">Check-in opgeslagen!</p>
        <p className="text-gray-500 text-sm mt-1">Je coach onthoudt dit</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          Hoe voelde de training van {dayLabel}?
        </h3>
        <div className="flex justify-between gap-2">
          {([1, 2, 3, 4, 5] as const).map((level) => (
            <button
              key={level}
              onClick={() => setFeeling(level)}
              className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all ${
                feeling === level
                  ? 'bg-blue-50 border-2 border-blue-500 scale-105'
                  : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
              }`}
            >
              <div className={`w-10 h-10 rounded-full ${FEELING_SCALE[level].color} ${FEELING_SCALE[level].textColor} flex items-center justify-center font-bold text-lg`}>
                {level}
              </div>
              <span className="text-xs text-gray-600">{FEELING_SCALE[level].label}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 mb-2 block">
          Opmerkingen (optioneel)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Hoe voelde je je? Iets bijzonders opgemerkt?"
          className="w-full border border-gray-300 rounded-xl p-3 text-sm resize-none h-24 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={feeling === null}
        className={`w-full py-3 rounded-xl font-semibold text-white transition-all ${
          feeling !== null
            ? 'bg-blue-600 hover:bg-blue-700 active:scale-98'
            : 'bg-gray-300 cursor-not-allowed'
        }`}
      >
        Opslaan
      </button>
    </div>
  );
}
