'use client';

import { useState } from 'react';

/**
 * Codescherm dat vóór de app verschijnt zodra APP_ACCESS_CODE is ingesteld.
 * Bij een juiste code zet de server een cookie en herladen we; de layout
 * rendert dan de echte app.
 */
export default function LockScreen() {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      if (res.ok) {
        window.location.reload();
        return;
      }
      setError('Onjuiste code. Probeer het opnieuw.');
    } catch {
      setError('Er ging iets mis. Probeer het opnieuw.');
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-6 pt-safe pb-safe">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-white">SportCoach AI</h1>
          <p className="text-gray-400 mt-2 text-sm">
            Deze app is privé. Voer je toegangscode in om verder te gaan.
          </p>
        </div>

        <form onSubmit={submit} className="bg-[#0d0d0f] rounded-3xl border border-white/5 p-5">
          <label htmlFor="access-code" className="block text-sm text-gray-400 mb-2">
            Toegangscode
          </label>
          <input
            id="access-code"
            type="password"
            inputMode="text"
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="••••••••"
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
            autoFocus
          />

          {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="w-full mt-4 bg-white text-black font-semibold rounded-2xl px-4 py-3 disabled:opacity-40 transition-opacity"
          >
            {loading ? 'Controleren…' : 'Toegang'}
          </button>
        </form>

        <p className="text-gray-600 text-xs text-center mt-6">
          Geen code? Vraag deze aan de eigenaar van de app.
        </p>
      </div>
    </main>
  );
}
