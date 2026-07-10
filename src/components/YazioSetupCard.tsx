'use client';

import { useState } from 'react';
import { saveYazioCredentials, clearYazioCredentials, getYazioCredentials } from '@/lib/storage';

interface Props {
  onConnect: () => void;
  syncing?: boolean;
}

export default function YazioSetupCard({ onConnect, syncing }: Props) {
  const existing = getYazioCredentials();
  const [editing, setEditing] = useState(!existing);
  const [email, setEmail] = useState(existing?.email ?? '');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');

  function handleSave() {
    if (!email.trim() || !password.trim()) {
      setError('Vul je e-mailadres en wachtwoord in.');
      return;
    }
    saveYazioCredentials({ email: email.trim(), password: password.trim() });
    setEditing(false);
    setError('');
    onConnect();
  }

  function handleDisconnect() {
    if (!confirm('Yazio-koppeling verwijderen? Je geïmporteerde voedingsdata blijft bewaard.')) return;
    clearYazioCredentials();
    setEmail('');
    setPassword('');
    setEditing(true);
  }

  if (!editing && existing) {
    return (
      <div className="bg-[#0d0d0f] rounded-3xl p-4 border border-white/5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-100">Yazio gekoppeld</p>
            <p className="text-xs text-gray-500 truncate">{existing.email}</p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0 items-center">
          <button
            onClick={onConnect}
            disabled={syncing}
            className="text-xs font-semibold text-green-400 hover:text-green-300 transition-colors disabled:opacity-50"
          >
            {syncing ? 'Bezig…' : 'Synchroniseer'}
          </button>
          <span className="text-gray-600">|</span>
          <button
            onClick={() => { setPassword(''); setEditing(true); }}
            className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            Wijzigen
          </button>
          <span className="text-gray-600">|</span>
          <button
            onClick={handleDisconnect}
            className="text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            Loskoppelen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0d0d0f] rounded-3xl p-4 border border-white/5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🥗</span>
        <h3 className="text-sm font-semibold text-gray-100">Koppel je Yazio-account</h3>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">E-mailadres</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="jouw@email.com"
            className="w-full bg-white/5 text-white text-sm rounded-lg px-3 py-2 border border-white/10 outline-none focus:ring-2 focus:ring-green-500 placeholder:text-gray-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Wachtwoord</label>
          <div className="relative">
            <input
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="••••••••"
              className="w-full bg-white/5 text-white text-sm rounded-lg px-3 py-2 pr-10 border border-white/10 outline-none focus:ring-2 focus:ring-green-500 placeholder:text-gray-500"
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              {showPw ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <p className="text-xs text-gray-500">
          Je inloggegevens worden alleen lokaal in je browser opgeslagen en direct naar Yazio gestuurd.
          Let op: een account dat met Google of Apple is aangemaakt heeft geen wachtwoord en werkt niet — registreer bij Yazio met e-mail + wachtwoord.
        </p>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={syncing}
            className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {syncing ? 'Bezig…' : 'Koppelen en synchroniseren'}
          </button>
          {existing && (
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-gray-200 transition-colors"
            >
              Annuleren
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
