'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import ChatMessage from '@/components/ChatMessage';
import CheckInContent from '@/app/coach/CheckInContent';
import WeeklyReportSection from '@/components/WeeklyReportSection';
import DailyCoachSection from '@/components/DailyCoachSection';
import { ChatMessage as ChatMessageType } from '@/lib/types';
import { getChatMessages, saveChatMessage, clearChatMessages, getRecentCheckIns, getCheckIns, getGarminData, getActivePlan, generateId, getNutritionForDate, getActiveRaceLabel, getActiveRaceDate, formatRaceDateNL, buildRaceContextText, buildGoalsHistoryText, getDaysUntilActiveRace, getUpcomingGoals, getEquipment, getActivityAssignments, buildHRZoneText } from '@/lib/storage';
import { buildEquipmentAttentionLine, filterStatsActivities } from '@/lib/equipment';
import { calculateTrainingLoad, getWeeklyTRIMPTotals } from '@/lib/training-load';
import { getCurrentPhase } from '@/lib/periodization';

export default function CoachContent() {
  const [activeTab, setActiveTab] = useState<'daily' | 'checkin' | 'chat' | 'report'>('daily');
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Check Web Speech API support
    const hasSpeech = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
    const hasSynth = 'speechSynthesis' in window;
    setVoiceSupported(hasSpeech && hasSynth);
  }, []);

  useEffect(() => {
    const saved = getChatMessages();
    if (saved.length === 0) {
      const raceLabel = getActiveRaceLabel();
      const raceDate = formatRaceDateNL();
      // Zonder aankomende wedstrijd (race geweest / geen doel) geen "richting je X"-intro
      const intro = getUpcomingGoals().length > 0
        ? `Ik ken je trainingsschema en help je richting je ${raceLabel} op ${raceDate}.`
        : `Je ${raceLabel} is geweest — ik help je met herstel, evaluatie en het kiezen van je volgende doel.`;
      const welcome: ChatMessageType = {
        id: generateId(),
        role: 'assistant',
        content:
          `Hoi! Ik ben je My Sport Coach AI. ${intro}\n\nJe kunt me alles vragen over:\n- Je trainingsschema en aanpassingen\n- Hartslagzones en intensiteit\n- Herstel en periodisering\n- Motivatie en mentale tips\n\nHoe kan ik je helpen?`,
        createdAt: new Date().toISOString(),
      };
      saveChatMessage(welcome);
      setMessages([welcome]);
    } else {
      setMessages(saved);
    }
  }, []);

  useEffect(() => {
    // 'nearest' vult de chat van boven naar beneden: een kort bericht dokt
    // onderaan (geen lege ruimte), een lang bericht (groter dan het scherm)
    // toont vanaf zijn bovenkant in plaats van het afgekapte einde.
    lastMessageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages]);

  const speakText = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    // Verwijder markdown voor uitspreken
    const cleanText = text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/#+\s/g, '')
      .replace(/- /g, '')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'nl-NL';
    utterance.rate = 0.9;
    utterance.pitch = 1.1;
    utterance.volume = 1;

    const doSpeak = () => {
      const voices = window.speechSynthesis.getVoices();
      const femaleVoice =
        voices.find(v => v.lang === 'nl-NL' && /female|vrouw|fem|fiona|ellen/i.test(v.name)) ||
        voices.find(v => v.lang === 'nl-NL') ||
        voices.find(v => v.lang.startsWith('nl')) ||
        voices.find(v => v.default);

      if (femaleVoice) utterance.voice = femaleVoice;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    };

    // Wacht tot stemmen geladen zijn (belangrijk op iPhone!)
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      doSpeak();
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        doSpeak();
      };
    }
  }, []);

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const startListening = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = 'nl-NL';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      // Automatisch versturen via stem — coach praat terug
      setTimeout(() => {
        setInput('');
        sendMessageWithText(transcript, true);
      }, 300);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  const unlockAudio = () => {
    // iOS vereist een gebruikersactie om audio te starten — unlock hier
    if ('speechSynthesis' in window) {
      const unlock = new SpeechSynthesisUtterance('');
      unlock.volume = 0;
      window.speechSynthesis.speak(unlock);
      window.speechSynthesis.cancel();
    }
  };

  const sendMessageWithText = async (text: string, useVoice = false) => {
    if (!text.trim() || isLoading) return;

    // Unlock audio op iOS direct bij gebruikersactie (alleen bij stem)
    if (useVoice) unlockAudio();

    const userMessage: ChatMessageType = {
      id: generateId(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };

    saveChatMessage(userMessage);
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const recentCheckIns = getRecentCheckIns(5);
      const garminData = getGarminData();
      const equipmentList = getEquipment();
      const activityAssignments = getActivityAssignments();
      // Stadsfiets-ritten worden niet als training meegenomen
      const statsActivities = garminData
        ? filterStatsActivities(garminData.activities, equipmentList, activityAssignments)
        : [];
      const trainingLoad = garminData
        ? calculateTrainingLoad(statsActivities, garminData.health)
        : null;

      const { plan: currentPlan, cycleStartDate } = getActivePlan();

      const restingHR = garminData?.health?.restingHR || 55;
      const weeklyTRIMP = garminData
        ? getWeeklyTRIMPTotals(statsActivities, restingHR, 4)
        : [];

      const allCheckIns = getCheckIns();
      const fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
      const fourWeeksAgoStr = fourWeeksAgo.toISOString().split('T')[0];
      const last28CheckIns = allCheckIns.filter((ci) => ci.date >= fourWeeksAgoStr);
      const avgFeeling = last28CheckIns.length > 0
        ? Math.round((last28CheckIns.reduce((s, c) => s + c.feeling, 0) / last28CheckIns.length) * 10) / 10
        : null;
      const recentNotes = last28CheckIns
        .filter((ci) => ci.note)
        .slice(-7)
        .map((ci) => ({ date: ci.date, feeling: ci.feeling, note: ci.note }));

      const currentPhase = getCurrentPhase(getActiveRaceDate());
      const daysUntilRace = getDaysUntilActiveRace();

      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Amsterdam' });
      const todayNutrition = getNutritionForDate(today);

      const currentMessages = await new Promise<ChatMessageType[]>((resolve) => {
        setMessages((prev) => { resolve(prev); return prev; });
      });

      const garminForCoach = garminData
        ? { ...garminData, activities: statsActivities }
        : null;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...currentMessages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          checkIns: recentCheckIns,
          garminData: garminForCoach,
          trainingLoad,
          currentPlan,
          cycleStartDate,
          weeklyTRIMP,
          currentPhase: { id: currentPhase.id, label: currentPhase.label },
          daysUntilRace,
          avgFeeling,
          recentNotes,
          todayNutrition,
          localDateTime: new Date().toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' }),
          raceContext: buildRaceContextText(),
          goalsHistory: buildGoalsHistoryText(),
          equipmentAttention: buildEquipmentAttentionLine(getEquipment(), garminData?.activities || [], getActivityAssignments()),
          hrZoneText: buildHRZoneText(),
        }),
      });

      if (!response.ok) throw new Error('API fout');

      const data = await response.json();

      const assistantMessage: ChatMessageType = {
        id: generateId(),
        role: 'assistant',
        content: data.content,
        createdAt: new Date().toISOString(),
      };

      saveChatMessage(assistantMessage);
      setMessages((prev) => [...prev, assistantMessage]);

      // Alleen voorlezen als via stem gesteld
      if (useVoice) speakText(data.content);

    } catch {
      const errorMessage: ChatMessageType = {
        id: generateId(),
        role: 'assistant',
        content: 'Sorry, er ging iets mis. Probeer het opnieuw.',
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    await sendMessageWithText(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleClearChat = () => {
    clearChatMessages();
    stopSpeaking();
    const welcome: ChatMessageType = {
      id: generateId(),
      role: 'assistant',
      content: 'Chat gewist! Hoe kan ik je helpen?',
      createdAt: new Date().toISOString(),
    };
    saveChatMessage(welcome);
    setMessages([welcome]);
  };

  return (
    <div className="bg-black flex flex-col" style={{ height: 'calc(100vh - 4.5rem - env(safe-area-inset-bottom, 0px))' }}>
      <div className="fixed top-0 inset-x-0 bg-black z-50" style={{ height: 'env(safe-area-inset-top, 0px)' }} />
      <div className="fixed bottom-0 inset-x-0 bg-black z-40" style={{ height: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }} />

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-6 pb-3 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Coach</h1>
          <p className="text-gray-400 text-sm">Vraag advies aan je trainingscoach</p>
        </div>
        {activeTab === 'chat' && (
          <button
            onClick={handleClearChat}
            className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1"
          >
            Wis chat
          </button>
        )}
      </div>

      {/* Sub-tab switcher */}
      <div className="px-5 pt-1 flex-shrink-0">
        <div className="flex bg-white/5 border border-white/10 rounded-xl p-1">
          {([
            { id: 'daily', label: 'Vandaag' },
            { id: 'checkin', label: 'Check-out' },
            { id: 'chat', label: 'Chat' },
            { id: 'report', label: 'Weekrapport' },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-[0_2px_12px_rgba(37,99,235,0.4)]' : 'text-gray-400'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'daily' ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <DailyCoachSection />
        </div>
      ) : activeTab === 'checkin' ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <CheckInContent onComplete={() => setActiveTab('chat')} />
        </div>
      ) : activeTab === 'report' ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <WeeklyReportSection />
        </div>
      ) : (
        <>
          {/* Messages */}
          <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-4 hide-scrollbar">
            {messages.map((msg, i) => (
              <div key={msg.id} ref={i === messages.length - 1 ? lastMessageRef : undefined}>
                <ChatMessage message={msg} />
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start mb-3">
                <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-md px-4 py-3">
                  <p className="text-xs font-semibold text-blue-400 mb-1">Coach AI</p>
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0.1s]" />
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-5 pb-20 pt-2 flex-shrink-0">
            <div className="flex items-end gap-2 bg-white/5 rounded-2xl border border-white/10 p-2">
              {/* Microfoon knop */}
              {voiceSupported && (
                <button
                  onClick={isListening ? stopListening : startListening}
                  disabled={isLoading}
                  className={`p-2 rounded-xl transition-all flex-shrink-0 ${
                    isListening
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                  title={isListening ? 'Stop luisteren' : 'Spreek je vraag in'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
                    <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291a6.751 6.751 0 0 1-6-6.709v-1.5A.75.75 0 0 1 6 10.5Z" />
                  </svg>
                </button>
              )}

              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isListening ? '🎤 Luisteren...' : 'Stel een vraag...'}
                rows={1}
                className="flex-1 resize-none text-sm p-2 outline-none max-h-32 bg-transparent text-white placeholder:text-gray-500"
                style={{ minHeight: '2.5rem' }}
              />

              {/* Stop spreken knop */}
              {isSpeaking && (
                <button
                  onClick={stopSpeaking}
                  className="p-2 rounded-xl bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 transition-all flex-shrink-0"
                  title="Stop voorlezen"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M4.5 7.5a3 3 0 0 1 3-3h9a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3h-9a3 3 0 0 1-3-3v-9Z" clipRule="evenodd" />
                  </svg>
                </button>
              )}

              {/* Verstuur knop */}
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                className={`p-2 rounded-xl transition-all flex-shrink-0 ${
                  input.trim() && !isLoading
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-white/5 text-gray-500'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.155.75.75 0 0 0 0-1.114A28.897 28.897 0 0 0 3.105 2.288Z" />
                </svg>
              </button>
            </div>

            {/* Status melding */}
            {isListening && (
              <p className="text-center text-xs text-red-400 mt-1 animate-pulse">🎤 Luisteren... tik op microfoon om te stoppen</p>
            )}
            {isSpeaking && (
              <p className="text-center text-xs text-orange-400 mt-1">🔊 Coach spreekt... tik op stop om te onderbreken</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
