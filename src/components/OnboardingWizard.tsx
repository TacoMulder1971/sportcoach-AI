'use client';

import { useEffect, useState } from 'react';
import { isOnboarded, getProfile, saveProfile } from '@/lib/storage';
import { TrainingSport, AthleteLevel, UserProfile } from '@/lib/types';
import SportIcon from '@/components/SportIcon';

const SPORT_OPTIONS: { sport: TrainingSport; label: string }[] = [
  { sport: 'hardlopen', label: 'Hardlopen' },
  { sport: 'fietsen', label: 'Fietsen' },
  { sport: 'zwemmen', label: 'Zwemmen' },
  { sport: 'mountainbike', label: 'Mountainbiken' },
];

const LEVEL_OPTIONS: { level: AthleteLevel; label: string; sub: string }[] = [
  { level: 'beginner', label: 'Beginner', sub: 'Net begonnen of lange pauze gehad' },
  { level: 'gevorderd', label: 'Gevorderd', sub: 'Traint al langer regelmatig' },
  { level: 'ervaren', label: 'Ervaren', sub: 'Jaren gestructureerde training' },
];

/**
 * Welkomstscherm voor nieuwe gebruikers (leeg profiel). Vult het profiel dat
 * alle AI-coaching stuurt. Bestaande gebruikers zijn gemigreerd (onboarded)
 * en zien dit scherm nooit. Later aanpassen kan via Data → Instellingen.
 */
export default function OnboardingWizard() {
  const [show, setShow] = useState(false);
  const [name, setName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [sports, setSports] = useState<TrainingSport[]>([]);
  const [days, setDays] = useState(4);
  const [level, setLevel] = useState<AthleteLevel>('gevorderd');
  const [strength, setStrength] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setShow(!isOnboarded());
  }, []);

  if (!show) return null;

  function toggleSport(s: TrainingSport) {
    setSports((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const year = parseInt(birthYear);
    const currentYear = new Date().getFullYear();
    if (!name.trim()) { setError('Vul je naam in.'); return; }
    if (!year || year < 1920 || year > currentYear - 8) { setError('Vul een geldig geboortejaar in.'); return; }
    if (sports.length === 0) { setError('Kies minimaal één sport.'); return; }

    const age = currentYear - year;
    const maxHR = 220 - age;
    const profile: UserProfile = {
      ...getProfile(),
      name: name.trim(),
      birthYear: year,
      sports,
      trainingDaysPerWeek: days,
      level,
      strengthTraining: strength,
      coachNotes: notes.trim() || undefined,
      maxHR,
      maxHRCycling: maxHR - 8,
      raceDate: '',
      raceGoal: '',
      raceType: '',
      onboarded: true,
    };
    saveProfile(profile);
    window.location.reload();
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black overflow-y-auto pt-safe pb-safe">
      <div className="max-w-lg mx-auto px-5 py-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-white">Welkom bij SportCoach AI</h1>
          <p className="text-gray-400 mt-2 text-sm leading-relaxed">
            Vertel je AI-coach wie je bent — dan zijn je schema&apos;s en adviezen
            vanaf dag één op jou afgestemd. Alles is later aan te passen via
            Data → Instellingen.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="bg-[#0d0d0f] rounded-3xl border border-white/5 p-5">
            <label htmlFor="ob-name" className="block text-sm text-gray-400 mb-2">Hoe heet je?</label>
            <input
              id="ob-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Voornaam"
              autoComplete="given-name"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
            />
            <label htmlFor="ob-year" className="block text-sm text-gray-400 mb-2 mt-4">Geboortejaar</label>
            <input
              id="ob-year"
              type="number"
              inputMode="numeric"
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value)}
              placeholder="bijv. 1985"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
            />
            <p className="text-gray-500 text-xs mt-2">
              Hiermee schatten we je hartslagzones. Weet je je echte maximale
              hartslag? Die stel je later in bij Instellingen.
            </p>
          </div>

          <div className="bg-[#0d0d0f] rounded-3xl border border-white/5 p-5">
            <p className="text-sm text-gray-400 mb-3">Welke sporten train je?</p>
            <div className="grid grid-cols-2 gap-2">
              {SPORT_OPTIONS.map(({ sport, label }) => {
                const active = sports.includes(sport);
                return (
                  <button
                    key={sport}
                    type="button"
                    onClick={() => toggleSport(sport)}
                    className={`flex items-center gap-2.5 rounded-2xl border px-3 py-3 text-left transition-colors ${
                      active ? 'border-blue-500/60 bg-blue-500/10 text-white' : 'border-white/10 bg-white/5 text-gray-400'
                    }`}
                  >
                    <SportIcon sport={sport} size="sm" />
                    <span className="text-sm font-medium">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-[#0d0d0f] rounded-3xl border border-white/5 p-5">
            <p className="text-sm text-gray-400 mb-3">Hoeveel dagen per week wil je trainen?</p>
            <div className="flex gap-2">
              {[2, 3, 4, 5, 6, 7].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(d)}
                  className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                    days === d ? 'border-blue-500/60 bg-blue-500/10 text-white' : 'border-white/10 bg-white/5 text-gray-400'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>

            <p className="text-sm text-gray-400 mb-3 mt-5">Wat is je niveau?</p>
            <div className="space-y-2">
              {LEVEL_OPTIONS.map(({ level: lv, label, sub }) => (
                <button
                  key={lv}
                  type="button"
                  onClick={() => setLevel(lv)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                    level === lv ? 'border-blue-500/60 bg-blue-500/10' : 'border-white/10 bg-white/5'
                  }`}
                >
                  <span className={`block text-sm font-medium ${level === lv ? 'text-white' : 'text-gray-300'}`}>{label}</span>
                  <span className="block text-xs text-gray-500 mt-0.5">{sub}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#0d0d0f] rounded-3xl border border-white/5 p-5">
            <button
              type="button"
              onClick={() => setStrength(!strength)}
              className="w-full flex items-center justify-between gap-3 text-left"
            >
              <span>
                <span className="block text-sm font-medium text-white">Krachttraining in je schema?</span>
                <span className="block text-xs text-gray-500 mt-1 leading-relaxed">
                  Korte core-workouts (7 min, zonder apparatuur) plant je coach
                  altijd in. Zet dit aan voor ook 2× per week ~40 min krachttraining.
                </span>
              </span>
              <span className={`flex-shrink-0 w-12 h-7 rounded-full p-1 transition-colors ${strength ? 'bg-blue-500' : 'bg-white/10'}`}>
                <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${strength ? 'translate-x-5' : ''}`} />
              </span>
            </button>
          </div>

          <div className="bg-[#0d0d0f] rounded-3xl border border-white/5 p-5">
            <label htmlFor="ob-notes" className="block text-sm text-gray-400 mb-2">
              Wensen voor je coach <span className="text-gray-600">(optioneel)</span>
            </label>
            <textarea
              id="ob-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={'bijv. "geen lange trainingen doordeweeks" of "ik herstel van een blessure"'}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-white/30 resize-none"
            />
            <p className="text-gray-500 text-xs mt-2">Je coach houdt hier bij elk advies rekening mee.</p>
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-2xl py-3.5 transition-colors"
          >
            Start met trainen
          </button>
        </form>
      </div>
    </div>
  );
}
