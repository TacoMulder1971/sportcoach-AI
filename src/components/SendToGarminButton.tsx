'use client';

import { useState } from 'react';
import { SessionSegment, TrainingSession } from '@/lib/types';
import { getGarminCredentials, getGarminTokens, saveGarminTokens } from '@/lib/storage';
import { buildGarminWorkout, canSendToGarmin } from '@/lib/garmin-workout';

type Status = 'idle' | 'sending' | 'done' | 'error';

/**
 * Zet de geplande sessie als gestructureerde workout in Garmin Connect.
 * Alleen zichtbaar voor hardlopen en fietsen (zie canSendToGarmin) — zwemmen
 * stuurt op tempo en kracht heeft geen hartslagdoel.
 */
export default function SendToGarminButton({
  session,
  segments,
  skipWarmup,
}: {
  session: TrainingSession;
  segments: SessionSegment[] | null;
  skipWarmup?: boolean;
}) {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);

  if (!canSendToGarmin(session)) return null;

  async function send() {
    setStatus('sending');
    setMessage(null);
    try {
      const built = buildGarminWorkout(session, segments, { skipWarmup });
      if (!built) throw new Error('Kon deze sessie niet omzetten');

      const tokens = getGarminTokens();
      const creds = getGarminCredentials();
      if (!tokens && !creds) {
        setStatus('error');
        setMessage('Garmin is nog niet gekoppeld — doe dat op de Data-tab.');
        return;
      }

      const res = await fetch('/api/garmin/workout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workout: built.payload,
          tokens: tokens ?? undefined,
          email: creds?.email,
          password: creds?.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Onbekende fout');
      if (data.tokens) saveGarminTokens(data.tokens);

      setStatus('done');
      setMessage(built.summary.join(' · '));
    } catch (e) {
      setStatus('error');
      setMessage(e instanceof Error ? e.message : 'Naar Garmin sturen mislukt');
    }
  }

  if (status === 'done') {
    return (
      <div className="mt-3 pt-3 border-t border-white/5">
        <p className="text-sm font-medium text-green-400">In Garmin gezet</p>
        {message && <p className="text-xs text-gray-500 mt-0.5">{message}</p>}
        <p className="text-xs text-gray-500 mt-1">
          Synchroniseer je horloge om de workout op te halen.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-white/5">
      <button
        onClick={send}
        disabled={status === 'sending'}
        className="w-full text-sm font-semibold text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-2.5 transition-colors disabled:opacity-50"
      >
        {status === 'sending' ? 'Bezig met versturen...' : 'Stuur naar Garmin'}
      </button>
      {status === 'error' && message && <p className="text-xs text-red-400 mt-2">{message}</p>}
    </div>
  );
}
