'use client';

import { useEffect, useRef, useState } from 'react';
import ChatMessage from '@/components/ChatMessage';
import { ChatMessage as ChatMessageType } from '@/lib/types';
import { getChatMessages, saveChatMessage, clearChatMessages, getRecentCheckIns, getGarminData, generateId } from '@/lib/storage';

export default function CoachPage() {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const saved = getChatMessages();
    if (saved.length === 0) {
      // Welcome message
      const welcome: ChatMessageType = {
        id: generateId(),
        role: 'assistant',
        content:
          'Hoi! Ik ben je TriCoach AI. Ik ken je trainingsschema en help je richting je 1/4 triatlon op 13 juni.\n\nJe kunt me alles vragen over:\n- Je trainingsschema en aanpassingen\n- Hartslagzones en intensiteit\n- Herstel en periodisering\n- Motivatie en mentale tips\n\nHoe kan ik je helpen?',
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

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMessage: ChatMessageType = {
      id: generateId(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };

    saveChatMessage(userMessage);
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const recentCheckIns = getRecentCheckIns(5);
      const garminData = getGarminData();

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          checkIns: recentCheckIns,
          garminData,
        }),
      });

      if (!response.ok) {
        throw new Error('API fout');
      }

      const data = await response.json();

      const assistantMessage: ChatMessageType = {
        id: generateId(),
        role: 'assistant',
        content: data.content,
        createdAt: new Date().toISOString(),
      };

      saveChatMessage(assistantMessage);
      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const errorMessage: ChatMessageType = {
        id: generateId(),
        role: 'assistant',
        content:
          'Sorry, er ging iets mis. Controleer of je API key is ingesteld in het .env.local bestand en probeer het opnieuw.',
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleClearChat = () => {
    clearChatMessages();
    setMessages([]);
    // Re-add welcome message
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
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Stel een vraag..."
            rows={1}
            className="flex-1 resize-none text-sm p-2 outline-none max-h-32"
            style={{ minHeight: '2.5rem' }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className={`p-2 rounded-xl transition-all ${
              input.trim() && !isLoading
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-100 text-gray-400'
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5"
            >
              <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.155.75.75 0 0 0 0-1.114A28.897 28.897 0 0 0 3.105 2.288Z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
