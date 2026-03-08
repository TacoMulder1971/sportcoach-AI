'use client';

import { useState, useRef, useEffect } from 'react';
import { CheckIn, CheckInMessage, FEELING_SCALE, TrainingSession, GarminActivity } from '@/lib/types';
import { saveCheckIn, updateCheckIn, generateId, getGarminData, getRecentCheckIns, getActivePlan } from '@/lib/storage';
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
  const [messages, setMessages] = useState<CheckInMessage[]>([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const [checkInId, setCheckInId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function fetchFeedback(checkIn: CheckIn) {
    setLoadingFeedback(true);
    try {
      const garminData = getGarminData();
      const recentCheckIns = getRecentCheckIns(5);
      const trainingLoad = garminData
        ? calculateTrainingLoad(garminData.activities, garminData.health)
        : null;
      const { plan: currentPlan, cycleStartDate } = getActivePlan();

      let feedbackPrompt = `De atleet heeft zojuist een check-out gedaan na de training van ${dayLabel}.\n`;
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
          currentPlan,
          cycleStartDate,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const assistantMsg: CheckInMessage = { role: 'assistant', content: data.content };
        setMessages([assistantMsg]);
        updateCheckIn(checkIn.id, {
          feedback: data.content,
          messages: [assistantMsg],
        });
      }
    } catch {
      // Feedback is optional
    } finally {
      setLoadingFeedback(false);
    }
  }

  async function sendMessage() {
    const text = chatInput.trim();
    if (!text || sending) return;

    const userMsg: CheckInMessage = { role: 'user', content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setChatInput('');
    setSending(true);

    try {
      const garminData = getGarminData();
      const recentCheckIns = getRecentCheckIns(5);
      const trainingLoad = garminData
        ? calculateTrainingLoad(garminData.activities, garminData.health)
        : null;
      const { plan: currentPlan, cycleStartDate } = getActivePlan();

      const apiMessages = [
        { role: 'user' as const, content: `[Check-out context: ${dayLabel}, gevoel ${feeling}/5${note ? `, notitie: "${note}"` : ''}]` },
        ...updatedMessages.map(m => ({ role: m.role, content: m.content })),
      ];

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          checkIns: recentCheckIns,
          garminData,
          trainingLoad,
          currentPlan,
          cycleStartDate,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const assistantMsg: CheckInMessage = { role: 'assistant', content: data.content };
        const allMessages = [...updatedMessages, assistantMsg];
        setMessages(allMessages);
        updateCheckIn(checkInId, {
          feedback: data.content,
          messages: allMessages,
        });
      }
    } catch {
      // silently fail
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const handleSubmit = () => {
    if (feeling === null) return;

    const id = generateId();
    const checkIn: CheckIn = {
      id,
      date: new Date().toISOString().split('T')[0],
      trainingDay: dayLabel,
      feeling,
      note,
      sessions,
      createdAt: new Date().toISOString(),
    };

    saveCheckIn(checkIn);
    setCheckInId(id);
    setSubmitted(true);
    fetchFeedback(checkIn);
  };

  if (submitted) {
    return (
      <div className="py-4 space-y-4">
        {/* Success */}
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <p className="text-lg font-semibold text-gray-900">Check-out opgeslagen!</p>
        </div>

        {/* Chat berichten */}
        <div className="space-y-3">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-md'
                  : 'bg-gray-100 text-gray-800 rounded-bl-md'
              }`}>
                {msg.role === 'assistant' && (
                  <p className="text-xs font-semibold text-blue-600 mb-1">Coach</p>
                )}
                <p className="text-sm leading-relaxed">{msg.content}</p>
              </div>
            </div>
          ))}

          {/* Loading */}
          {(loadingFeedback || sending) && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                <p className="text-xs font-semibold text-blue-600 mb-1">Coach</p>
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Chat input */}
        {!loadingFeedback && messages.length > 0 && (
          <div className="flex items-end gap-2 bg-white rounded-2xl border border-gray-200 p-2">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Stel een vraag aan de coach..."
              rows={1}
              className="flex-1 resize-none text-sm p-2 outline-none max-h-24"
              style={{ minHeight: '2.5rem' }}
            />
            <button
              onClick={sendMessage}
              disabled={!chatInput.trim() || sending}
              className={`p-2 rounded-xl transition-all ${
                chatInput.trim() && !sending
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.155.75.75 0 0 0 0-1.114A28.897 28.897 0 0 0 3.105 2.288Z" />
              </svg>
            </button>
          </div>
        )}

        {/* Back button */}
        <button
          onClick={onComplete}
          className="w-full py-3 rounded-xl font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
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
