'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import ChatMessage from '@/components/ChatMessage';
import { ChatMessage as ChatMessageType } from '@/lib/types';
import { getChatMessages, saveChatMessage, clearChatMessages, getRecentCheckIns, getCheckIns, getGarminData, getActivePlan, generateId } from '@/lib/storage';
import { calculateTrainingLoad, getWeeklyTRIMPTotals } from '@/lib/training-load';
import { getCurrentPhase, getDaysUntilRace } from '@/lib/periodization';

export default function CoachPage() {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
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
      const welcome: ChatMessageType = {
        id: generateId(),
        role: 'assistant',
        content:
          'Hoi! Ik ben je My Sport Coach AI. Ik ken je trainingsschema en help je richting je 1/4 triatlon op 13 juni.\n\nJe kunt me alles vragen over:\n- Je trainingsschema en aanpassingen\n- Hartslagzones en intensiteit\n- Herstel en periodisering\n- Motivatie en mentale tips\n\nHoe kan ik je helpen?',
        createdAt: new Date().toISOString(),
      };
      saveChatMessage(welcome);
      setMessages([welcome]);
    } else {
      setMessages(saved);
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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
    utterance.rate = 0.95;
    utterance.pitch = 1.1;

    // Kies beste beschikbare vrouwenstem
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice =
      voices.find(v => v.lang === 'nl-NL' && /female|vrouw|fem/i.test(v.name)) ||
      voices.find(v => v.lang === 'nl-NL') ||
      voices.find(v => v.lang.startsWith('nl'));

    if (femaleVoice) utterance.voice = femaleVoice;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
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
      // Automatisch versturen na spreken
      setTimeout(() => {
        setInput('');
        sendMessageWithText(transcript);
      }, 300);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  const sendMessageWithText = async (text: string) => {
    if (!text.trim() || isLoading) return;

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
      const trainingLoad = garminData
        ? calculateTrainingLoad(garminData.activities, garminData.health)
        : null;

      const { plan: currentPlan, cycleStartDate } = getActivePlan();

      const restingHR = garminData?.health?.restingHR || 55;
      const weeklyTRIMP = garminData
        ? getWeeklyTRIMPTotals(garminData.activities, restingHR, 4)
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

      const currentPhase = getCurrentPhase();
      const daysUntilRace = getDaysUntilRace();

      const currentMessages = await new Promise<ChatMessageType[]>((resolve) => {
        setMessages((prev) => { resolve(prev); return prev; });
      });

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...currentMessages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          checkIns: recentCheckIns,
          garminData,
          trainingLoad,
          currentPlan,
          cycleStartDate,
          weeklyTRIMP,
          currentPhase: { id: currentPhase.id, label: currentPhase.label },
          daysUntilRace,
          avgFeeling,
          recentNotes,
          localDateTime: new Date().toLocaleString('nl-NL', { timeZone: 'Europe/Amsterdam' }),
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

      // Automatisch voorlezen als via stem gesteld
      speakText(data.content);

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
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-6 pb-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Coach</h1>
          <p className="text-gray-500 text-sm">Vraag advies aan je trainingscoach</p>
        </div>
        <button
          onClick={handleClearChat}
          className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
        >
          Wis chat
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 hide-scrollbar">
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isLoading && (
          <div className="flex justify-start mb-3">
            <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
              <p className="text-xs font-semibold text-blue-600 mb-1">Coach AI</p>
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

      {/* Input */}
      <div className="px-4 pb-20 pt-2 bg-gradient-to-t from-background">
        <div className="flex items-end gap-2 bg-white rounded-2xl border border-gray-200 p-2 shadow-sm">
          {/* Microfoon knop */}
          {voiceSupported && (
            <button
              onClick={isListening ? stopListening : startListening}
              disabled={isLoading}
              className={`p-2 rounded-xl transition-all flex-shrink-0 ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
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
            className="flex-1 resize-none text-sm p-2 outline-none max-h-32"
            style={{ minHeight: '2.5rem' }}
          />

          {/* Stop spreken knop */}
          {isSpeaking && (
            <button
              onClick={stopSpeaking}
              className="p-2 rounded-xl bg-orange-100 text-orange-600 hover:bg-orange-200 transition-all flex-shrink-0"
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
                : 'bg-gray-100 text-gray-400'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.155.75.75 0 0 0 0-1.114A28.897 28.897 0 0 0 3.105 2.288Z" />
            </svg>
          </button>
        </div>

        {/* Status melding */}
        {isListening && (
          <p className="text-center text-xs text-red-500 mt-1 animate-pulse">🎤 Luisteren... tik op microfoon om te stoppen</p>
        )}
        {isSpeaking && (
          <p className="text-center text-xs text-orange-500 mt-1">🔊 Coach spreekt... tik op stop om te onderbreken</p>
        )}
      </div>
    </div>
  );
}
