'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { CheckIn, CheckInMessage, FEELING_SCALE, TrainingSession, GarminActivity, Equipment, EquipmentType, Sport, SwimVariant, SWIM_VARIANT_LABEL } from '@/lib/types';
import { saveCheckIn, updateCheckIn, generateId, getGarminData, syncGarminData, getRecentCheckIns, getActivePlan, getEquipment, getActivityAssignments, getActiveEquipment, assignActivityToEquipment, getLastSwimVariant, setLastSwimVariant, setActivitySwimVariant } from '@/lib/storage';
import { calculateTrainingLoad } from '@/lib/training-load';
import { buildVerifiedFactsBlock } from '@/lib/fact-check';
import { buildEquipmentAttentionLine, filterStatsActivities, assignableEquipment, inSameSportGroup } from '@/lib/equipment';

const SWIM_VARIANTS: SwimVariant[] = ['zwembad_binnen', 'zwembad_buiten', 'openwater'];

const TYPE_ICON: Record<EquipmentType, string> = {
  racefiets: '🚴',
  mountainbike: '⛰️',
  stadsfiets: '🚲',
  hardloopschoenen: '👟',
  overig: '🛠️',
  fiets: '🚲', // legacy fallback
};

// Welke sporten ondersteunen materiaal-keuze (overige = niet relevant)
const SPORTS_WITH_EQUIPMENT: Sport[] = ['fietsen', 'hardlopen', 'mountainbike'];

interface CheckInFormProps {
  sessions: TrainingSession[];
  dayLabel: string;
  garminActivities?: GarminActivity[];
  onComplete: () => void;
  /** Bestaande check-out van vandaag — opent direct het gesprek (resume-modus). */
  resumeCheckIn?: CheckIn;
}

export default function CheckInForm({ sessions, dayLabel, garminActivities = [], onComplete, resumeCheckIn }: CheckInFormProps) {
  // Resume-modus: heropen het gesprek van een al gedane check-out
  const resumeMessages: CheckInMessage[] = resumeCheckIn?.messages?.length
    ? resumeCheckIn.messages
    : resumeCheckIn?.feedback
      ? [{ role: 'assistant', content: resumeCheckIn.feedback }]
      : [];

  const [feeling, setFeeling] = useState<1 | 2 | 3 | 4 | 5 | null>(resumeCheckIn?.feeling ?? null);
  const [note, setNote] = useState(resumeCheckIn?.note || '');
  const [submitted, setSubmitted] = useState(!!resumeCheckIn);
  const [messages, setMessages] = useState<CheckInMessage[]>(resumeMessages);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'analyzing'>('idle');
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const [checkInId, setCheckInId] = useState<string>(resumeCheckIn?.id || '');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Materiaal-keuze per sport ───────────────────────────────────
  // Bepaal welke sporten in deze check-out materiaal hebben (fietsen/hardlopen/mountainbike),
  // en welke actieve equipment-items er voor zijn. Toon dropdown alleen als >0 opties.
  const sportsInCheckOut = useMemo<Sport[]>(
    () => Array.from(new Set(
      sessions
        .map(s => s.sport)
        .filter((s): s is Sport => SPORTS_WITH_EQUIPMENT.includes(s as Sport))
    )),
    [sessions]
  );

  const equipmentBySport = useMemo<Record<string, Equipment[]>>(() => {
    if (typeof window === 'undefined') return {};
    const active = getActiveEquipment();
    const today = new Date().toISOString().split('T')[0];
    const map: Record<string, Equipment[]> = {};
    for (const sport of sportsInCheckOut) {
      // Alle uitwisselbare equipment (fietsen onderling: race/MTB/stad)
      map[sport] = assignableEquipment({ sport, date: today }, active);
    }
    return map;
  }, [sportsInCheckOut]);

  // Initial keuze = default-equipment van de exacte sport, anders eerste default, anders eerste
  const [equipmentChoices, setEquipmentChoices] = useState<Record<string, string>>({});

  useEffect(() => {
    const initial: Record<string, string> = {};
    for (const sport of sportsInCheckOut) {
      const list = equipmentBySport[sport] || [];
      const def = list.find(e => e.isDefault && e.sport === sport) || list.find(e => e.isDefault) || list[0];
      if (def) initial[sport] = def.id;
    }
    setEquipmentChoices(initial);
  }, [sportsInCheckOut, equipmentBySport]);

  /** Past de gekozen equipment toe op activiteiten van vandaag (matcht binnen sportgroep). */
  const applyEquipmentChoices = (activities: GarminActivity[]) => {
    for (const a of activities) {
      // Directe match op activiteit-sport, anders een keuze uit dezelfde sportgroep
      // (bv. geplande 'fietsen' keuze toepassen op een Garmin 'mountainbike' rit)
      const choiceSport = Object.keys(equipmentChoices).find(
        sp => sp === a.sport || inSameSportGroup(sp, a.sport)
      );
      const chosen = choiceSport ? equipmentChoices[choiceSport] : undefined;
      if (chosen) assignActivityToEquipment(a.id, chosen);
    }
  };

  // ── Zwem-variant keuze ──────────────────────────────────────────
  const hasSwimSession = useMemo(
    () => sessions.some(s => s.sport === 'zwemmen'),
    [sessions]
  );
  // Default = laatst gekozen variant (gevraagd: "laatste keuze als default")
  const [swimChoice, setSwimChoice] = useState<SwimVariant>('zwembad_binnen');
  useEffect(() => {
    if (hasSwimSession) setSwimChoice(getLastSwimVariant());
  }, [hasSwimSession]);

  /** Past de gekozen zwem-variant toe op alle zwem-activiteiten van vandaag. */
  const applySwimChoice = (activities: GarminActivity[]) => {
    if (!hasSwimSession) return;
    let appliedAny = false;
    for (const a of activities) {
      if (a.sport === 'zwemmen') { setActivitySwimVariant(a.id, swimChoice); appliedAny = true; }
    }
    if (appliedAny) setLastSwimVariant(swimChoice);
  };

  useEffect(() => {
    // Scroll alleen naar beneden als de coach antwoordt of aan het typen is,
    // niet direct na het versturen van een eigen bericht (anders schiet het beeld
    // op mobiel weg door keyboard-close + viewport resize).
    const lastMessage = messages[messages.length - 1];
    const shouldScroll = lastMessage?.role === 'assistant' || loadingFeedback || sending;
    if (shouldScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, loadingFeedback, sending]);

  async function fetchFeedback(checkIn: CheckIn) {
    setLoadingFeedback(true);
    setSyncStatus('syncing');
    try {
      // 1. Eerst Garmin synchroniseren zodat de coach de meest recente activiteit ziet
      let garminData = getGarminData();
      try {
        const fresh = await syncGarminData();
        if (fresh) garminData = fresh;
      } catch {
        // Sync mag falen (offline, Garmin down) — we vallen terug op cache
      }

      setSyncStatus('analyzing');

      // 2. Filter activiteiten van vandaag op basis van de verse data
      const today = new Date().toISOString().split('T')[0];
      const freshTodayActivities = garminData?.activities?.filter(a => a.date === today) || [];
      const todayActivities = freshTodayActivities.length > 0 ? freshTodayActivities : garminActivities;

      // Pas de gekozen equipment + zwem-variant toe op de verse activiteiten van vandaag
      applyEquipmentChoices(todayActivities);
      applySwimChoice(todayActivities);

      const recentCheckIns = getRecentCheckIns(5);
      // Stadsfiets-ritten worden niet meegerekend als training-belasting
      const statsActivities = garminData
        ? filterStatsActivities(garminData.activities, getEquipment(), getActivityAssignments())
        : [];
      const trainingLoad = garminData
        ? calculateTrainingLoad(statsActivities, garminData.health)
        : null;
      const { plan: currentPlan, cycleStartDate } = getActivePlan();

      let feedbackPrompt = `De atleet heeft zojuist een check-out gedaan na de training van ${dayLabel}.\n`;
      feedbackPrompt += `Gevoel: ${checkIn.feeling}/5`;
      if (checkIn.note) feedbackPrompt += ` — "${checkIn.note}"`;
      feedbackPrompt += '\n';

      if (todayActivities.length > 0) {
        feedbackPrompt += buildVerifiedFactsBlock('vandaag', sessions, todayActivities);
        if (sessions.length > 0) {
          feedbackPrompt += `\nOPDRACHT: Geef in 2-3 zinnen feedback op basis van bovenstaande feiten. Gebruik de getallen exact zoals ze hier staan — verzin geen andere HR-waarden, zones of snelheden. Begin met of de doelen gehaald zijn (zie VERGELIJKING), benoem 1 hoogtepunt en 1 concreet verbeterpunt voor de volgende keer.`;
        } else {
          // Ongeplande activiteit op een rustdag — er zijn geen geplande doelen
          feedbackPrompt += `\nCONTEXT: Dit was een RUSTDAG, maar de atleet heeft toch getraind. Gebruik de getallen exact zoals ze hier staan — verzin geen andere HR-waarden, zones of snelheden.\nOPDRACHT: Geef in 2-3 zinnen feedback op deze ongeplande sessie. Benoem 1 hoogtepunt, maar bewaak ook het herstel: was dit verstandig op een rustdag, en waar moet hij op letten qua belasting?`;
        }
      } else {
        feedbackPrompt += '\nGEEN Garmin-activiteit beschikbaar voor vandaag.\n\nGeplande sessies:\n';
        for (const s of sessions) {
          feedbackPrompt += `- ${s.sport} ${s.type}: ${s.durationMinutes}min${s.zone ? ` in ${s.zone}` : ''}\n`;
        }
        feedbackPrompt += '\nOPDRACHT: Geef korte feedback (2-3 zinnen) op basis van het gevoel en de geplande training. Vraag of de training is uitgevoerd en op welke intensiteit, omdat er geen Garmin-data is.';
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
          equipmentAttention: buildEquipmentAttentionLine(getEquipment(), garminData?.activities || [], getActivityAssignments()),
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
      } else {
        const errorMsg: CheckInMessage = { role: 'assistant', content: 'Sorry, er ging iets mis bij het ophalen van feedback. Probeer het later opnieuw.' };
        setMessages([errorMsg]);
      }
    } catch {
      const errorMsg: CheckInMessage = { role: 'assistant', content: 'Sorry, er ging iets mis bij het ophalen van feedback. Probeer het later opnieuw.' };
      setMessages([errorMsg]);
    } finally {
      setLoadingFeedback(false);
      setSyncStatus('idle');
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
      // Stadsfiets-ritten worden niet meegerekend als training-belasting
      const statsActivities = garminData
        ? filterStatsActivities(garminData.activities, getEquipment(), getActivityAssignments())
        : [];
      const trainingLoad = garminData
        ? calculateTrainingLoad(statsActivities, garminData.health)
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
          equipmentAttention: buildEquipmentAttentionLine(getEquipment(), garminData?.activities || [], getActivityAssignments()),
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
      } else {
        const errorMsg: CheckInMessage = { role: 'assistant', content: 'Sorry, er ging iets mis. Probeer het opnieuw.' };
        setMessages([...updatedMessages, errorMsg]);
      }
    } catch {
      const errorMsg: CheckInMessage = { role: 'assistant', content: 'Sorry, er ging iets mis. Probeer het opnieuw.' };
      setMessages([...updatedMessages, errorMsg]);
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
    // Pas equipment- + zwem-keuzes direct toe op de huidige (gecachte) activiteiten van vandaag
    applyEquipmentChoices(garminActivities);
    applySwimChoice(garminActivities);
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
          <p className="text-lg font-semibold text-gray-100">
            {resumeCheckIn ? 'Je check-out van vandaag' : 'Check-out opgeslagen!'}
          </p>
          {resumeCheckIn && (
            <p className="text-gray-400 text-sm mt-1">Je kunt het gesprek met de coach voortzetten.</p>
          )}
        </div>

        {/* Chat berichten */}
        <div className="space-y-3">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-md'
                  : 'bg-white/5 border border-white/10 text-gray-100 rounded-bl-md'
              }`}>
                {msg.role === 'assistant' && (
                  <p className="text-xs font-semibold text-blue-400 mb-1">Coach</p>
                )}
                <p className="text-sm leading-relaxed">{msg.content}</p>
              </div>
            </div>
          ))}

          {/* Loading */}
          {(loadingFeedback || sending) && (
            <div className="flex justify-start">
              <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-md px-4 py-3">
                <p className="text-xs font-semibold text-blue-400 mb-1">Coach</p>
                {syncStatus === 'syncing' ? (
                  <p className="text-sm text-gray-400">Garmin data ophalen...</p>
                ) : syncStatus === 'analyzing' ? (
                  <p className="text-sm text-gray-400">Activiteit analyseren...</p>
                ) : (
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0.1s]" />
                    <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                  </div>
                )}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Chat input */}
        {!loadingFeedback && (messages.length > 0 || !!resumeCheckIn) && (
          <div className="flex items-end gap-2 bg-white/5 rounded-2xl border border-white/10 p-2">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Stel een vraag aan de coach..."
              rows={1}
              className="flex-1 resize-none text-sm p-2 outline-none max-h-24 bg-transparent text-white placeholder:text-gray-500"
              style={{ minHeight: '2.5rem' }}
            />
            <button
              onClick={sendMessage}
              disabled={!chatInput.trim() || sending}
              className={`p-2 rounded-xl transition-all ${
                chatInput.trim() && !sending
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-white/5 text-gray-500'
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
          className="w-full py-3 rounded-xl font-semibold text-blue-400 bg-blue-500/10 hover:bg-blue-500/15 transition-colors"
        >
          Terug naar dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-gray-300 mb-3">
          Hoe voelde de training van {dayLabel}?
        </h3>
        <div className="flex justify-between gap-2">
          {([1, 2, 3, 4, 5] as const).map((level) => (
            <button
              key={level}
              onClick={() => setFeeling(level)}
              className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all ${
                feeling === level
                  ? 'bg-blue-500/15 border-2 border-blue-500 scale-105'
                  : 'bg-white/5 border-2 border-transparent hover:bg-white/10'
              }`}
            >
              <div className={`w-10 h-10 rounded-full ${FEELING_SCALE[level].color} ${FEELING_SCALE[level].textColor} flex items-center justify-center font-bold text-lg`}>
                {level}
              </div>
              <span className="text-xs text-gray-400">{FEELING_SCALE[level].label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Materiaal-keuze per sport */}
      {sportsInCheckOut.map(sport => {
        const options = equipmentBySport[sport] || [];
        if (options.length === 0) return null;
        const sportLabel = sport === 'fietsen' ? 'fiets' : sport === 'hardlopen' ? 'schoenen' : sport === 'mountainbike' ? 'mountainbike' : sport;
        return (
          <div key={sport}>
            <label className="text-sm font-medium text-gray-300 mb-2 block">
              Welke {sportLabel} gebruikt?
            </label>
            <select
              value={equipmentChoices[sport] || ''}
              onChange={(e) => setEquipmentChoices(prev => ({ ...prev, [sport]: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 text-white rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {options.map(eq => (
                <option key={eq.id} value={eq.id} className="bg-[#0d0d0f]">
                  {TYPE_ICON[eq.type]} {eq.name}{eq.isDefault ? ' · default' : ''}
                </option>
              ))}
            </select>
          </div>
        );
      })}

      {/* Zwem-variant keuze (default = laatste keuze) */}
      {hasSwimSession && (
        <div>
          <label className="text-sm font-medium text-gray-300 mb-2 block">
            Waar gezwommen?
          </label>
          <select
            value={swimChoice}
            onChange={(e) => setSwimChoice(e.target.value as SwimVariant)}
            className="w-full bg-white/5 border border-white/10 text-white rounded-xl p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {SWIM_VARIANTS.map(v => (
              <option key={v} value={v} className="bg-[#0d0d0f]">
                🌊 {SWIM_VARIANT_LABEL[v]}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="text-sm font-medium text-gray-300 mb-2 block">
          Opmerkingen (optioneel)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Hoe voelde je je? Iets bijzonders opgemerkt?"
          className="w-full bg-white/5 border border-white/10 text-white placeholder:text-gray-500 rounded-xl p-3 text-sm resize-none h-24 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={feeling === null}
        className={`w-full py-3 rounded-xl font-semibold text-white transition-all ${
          feeling !== null
            ? 'bg-blue-600 hover:bg-blue-700 active:scale-98'
            : 'bg-white/10 text-gray-500 cursor-not-allowed'
        }`}
      >
        Opslaan
      </button>
    </div>
  );
}
