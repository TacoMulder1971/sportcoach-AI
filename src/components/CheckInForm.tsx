'use client';

import { useState } from 'react';
import { CheckIn, FEELING_SCALE, TrainingSession, GarminActivity } from '@/lib/types';
import { saveCheckIn, generateId, getGarminData, getRecentCheckIns } from '@/lib/storage';
import { calculateTrainingLoad } from '@/lib/training-load';

interface CheckInFormProps {
  sessions: TrainingSession[];
  dayLabel: string;
  garminActivities?: GarminActivity[];
  onComplete: () => void;
}

export default function CheckInForm({ sessions, dayLabel, garminActivities = [], onComplete }: CheckInFormProps) {
  const [feeling, setFeeling] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  const fetchFeedback = async (checkIn: CheckIn) => {
    setLoadingFeedback(true);
    try {
      const garminData = getGarminData();
      const recentCheckIns = getRecentCheckIns(5);
      const trainingLoad = garminData
        ? calculateTrainingLoad(garminData.activities, garminData.health)
        : null;

      // Build a specific feedback request
      let feedbackPrompt = `De atleet heeft zojuist een check-in gedaan na de training van ${dayLabel}.\n`;
      feedbackPrompt += `Gevoel: ${checkIn.feeling}/5`;
      if (checkIn.note) feedbackPrompt += ` - "${checkIn.note}"`;
      feedbackPrompt += '\n\nGeplande sessies:\n';
      for (const s of sessions) {
        feedbackPrompt += `- ${s.sport} ${s.type}: ${s.durationMinutes}min in ${s.zone}\n`;
      }

      if (garminActivities.length > 0) {
        feedbackPrompt += '\nWerkelijke Garmin data van vandaag:\n';
        for (const a of garminActivities) {
          feedbackPrompt += `- ${a.activityName}: ${a.durationMinutes}min, ${a.distanceKm}km, gem HR ${a.avgHR}, max HR ${a.maxHR}\n`;
        }
        feedbackPrompt += '\nGeef korte feedback (2-3 zinnen) over deze training. Vergelijk gepland vs gedaan. Was de intensiteit goed? Hoe past dit in het trainingsplan?';
      } else {
        feedbackPrompt += '\nEr is geen Garmin activiteit beschikbaar voor vandaag. Geef korte feedback (2-3 zinnen) op basis van het gevoel en de geplande training.';
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: feedbackPrompt }],
          checkIns: recentCheckIns,
          garminData,
          trainingLoad,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setFeedback(data.content);
      }
    } catch {
      // Feedback is optional, don't block the flow
    } finally {
      setLoadingFeedback(false);
    }
  };

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
    fetchFeedback(checkIn);
  };

  if (submitted) {
    return (
      <div className="py-4">
        {/* Success */}
        <div className="text-center mb-4">
          <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <p className="text-lg font-semibold text-gray-900">Check-in opgeslagen!</p>
        </div>

        {/* AI Feedback */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-blue-600 mb-1">Coach feedback</p>
              {loadingFeedback ? (
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                  </div>
                  <p className="text-sm text-gray-500">Analyse bezig...</p>
                </div>
              ) : feedback ? (
                <p className="text-sm text-gray-700">{feedback}</p>
              ) : (
                <p className="text-sm text-gray-500">Feedback niet beschikbaar</p>
              )}
            </div>
          </div>
        </div>

        {/* Back button */}
        <button
          onClick={onComplete}
          className="w-full mt-4 py-3 rounded-xl font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
        >
          Terug naar dashboard
        </button>
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
