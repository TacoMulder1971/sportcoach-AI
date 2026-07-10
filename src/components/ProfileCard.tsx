'use client';

import { useEffect, useState } from 'react';
import { getProfile, saveProfile } from '@/lib/storage';
import { TrainingSport, AthleteLevel, Gender } from '@/lib/types';
import SportIcon from '@/components/SportIcon';

const SPORT_OPTIONS: { sport: TrainingSport; label: string }[] = [
  { sport: 'hardlopen', label: 'Hardlopen' },
  { sport: 'fietsen', label: 'Fietsen' },
  { sport: 'zwemmen', label: 'Zwemmen' },
  { sport: 'mountainbike', label: 'Mountainbiken' },
];

const LEVELS: { level: AthleteLevel; label: string }[] = [
  { level: 'beginner', label: 'Beginner' },
  { level: 'gevorderd', label: 'Gevorderd' },
  { level: 'ervaren', label: 'Ervaren' },
];

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'man', label: 'Man' },
  { value: 'vrouw', label: 'Vrouw' },
  { value: 'anders', label: 'Anders' },
];

/**
 * Profiel bewerken op Data → Instellingen: sporten, niveau, trainingsdagen,
 * krachttraining en coach-wensen. Wijzigingen werken door in alle AI-adviezen
 * vanaf het eerstvolgende bericht/schema (het lopende schema wijzigt niet vanzelf).
 */
export default function ProfileCard() {
  const [name, setName] = useState('');
  const [birthYear, setBirthYear] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [sports, setSports] = useState<TrainingSport[]>([]);
  const [days, setDays] = useState(4);
  const [level, setLevel] = useState<AthleteLevel>('gevorderd');
  const [strength, setStrength] = useState(false);
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const p = getProfile();
    setName(p.name || '');
    setBirthYear(p.birthYear ? String(p.birthYear) : '');
    setGender(p.gender ?? null);
    setWeight(p.weightKg ? String(p.weightKg) : '');
    setHeight(p.heightCm ? String(p.heightCm) : '');
    setSports(p.sports ?? []);
    setDays(p.trainingDaysPerWeek ?? 4);
    setLevel(p.level ?? 'gevorderd');
    setStrength(p.strengthTraining ?? false);
    setNotes(p.coachNotes ?? '');
  }, []);

  function toggleSport(s: TrainingSport) {
    setSports((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
    setSaved(false);
  }

  function save() {
    setError('');
    if (sports.length === 0) { setError('Kies minimaal één sport.'); return; }
    const year = birthYear ? parseInt(birthYear) : undefined;
    const currentYear = new Date().getFullYear();
    if (birthYear && (!year || year < 1920 || year > currentYear - 8)) {
      setError('Vul een geldig geboortejaar in (of laat het leeg).');
      return;
    }
    const w = weight ? parseFloat(weight) : undefined;
    if (weight && (!w || w < 25 || w > 250)) { setError('Vul een geldig gewicht in (of laat het leeg).'); return; }
    const h = height ? parseFloat(height) : undefined;
    if (height && (!h || h < 100 || h > 250)) { setError('Vul een geldige lengte in (of laat het leeg).'); return; }
    const p = getProfile();
    saveProfile({
      ...p,
      name: name.trim() || p.name,
      birthYear: year,
      gender: gender ?? undefined,
      weightKg: w,
      heightCm: h,
      sports,
      trainingDaysPerWeek: days,
      level,
      strengthTraining: strength,
      coachNotes: notes.trim() || undefined,
      onboarded: true,
    });
    setSaved(true);
  }

  return (
    <div className="bg-[#0d0d0f] rounded-3xl border border-white/5 p-5">
      <h3 className="text-white font-semibold">Profiel & coach-voorkeuren</h3>
      <p className="text-gray-500 text-xs mt-1 leading-relaxed">
        Je coach stemt schema&apos;s en adviezen hierop af. Sporten toevoegen of
        weghalen kan altijd — het telt mee vanaf je volgende schema of advies.
      </p>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div>
          <label htmlFor="pf-name" className="block text-xs text-gray-500 mb-1">Naam</label>
          <input
            id="pf-name"
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setSaved(false); }}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
          />
        </div>
        <div>
          <label htmlFor="pf-year" className="block text-xs text-gray-500 mb-1">Geboortejaar</label>
          <input
            id="pf-year"
            type="number"
            inputMode="numeric"
            value={birthYear}
            onChange={(e) => { setBirthYear(e.target.value); setSaved(false); }}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
          />
        </div>
      </div>

      <div className="mt-3">
        <p className="text-xs text-gray-500 mb-1">Geslacht</p>
        <div className="flex gap-1.5">
          {GENDERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => { setGender(value); setSaved(false); }}
              className={`flex-1 rounded-lg border py-1.5 text-xs font-medium transition-colors ${
                gender === value ? 'border-blue-500/60 bg-blue-500/10 text-white' : 'border-white/10 bg-white/5 text-gray-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <div>
          <label htmlFor="pf-weight" className="block text-xs text-gray-500 mb-1">Gewicht (kg)</label>
          <input
            id="pf-weight"
            type="number"
            inputMode="decimal"
            value={weight}
            onChange={(e) => { setWeight(e.target.value); setSaved(false); }}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
          />
        </div>
        <div>
          <label htmlFor="pf-height" className="block text-xs text-gray-500 mb-1">Lengte (cm)</label>
          <input
            id="pf-height"
            type="number"
            inputMode="numeric"
            value={height}
            onChange={(e) => { setHeight(e.target.value); setSaved(false); }}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-white/30"
          />
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-4 mb-1">Sporten in je schema</p>
      <p className="text-[11px] text-gray-600 mb-2 leading-relaxed">
        Alleen aangevinkte sporten plant je coach in. Andere sporten kun je er
        los bij vragen.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {SPORT_OPTIONS.map(({ sport, label }) => {
          const active = sports.includes(sport);
          return (
            <button
              key={sport}
              type="button"
              onClick={() => toggleSport(sport)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                active ? 'border-blue-500/60 bg-blue-500/10 text-white' : 'border-white/10 bg-white/5 text-gray-400'
              }`}
            >
              <SportIcon sport={sport} size="sm" />
              <span className="text-sm">{label}</span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div>
          <p className="text-xs text-gray-500 mb-1">Trainingsdagen/week</p>
          <div className="flex gap-1">
            {[2, 3, 4, 5, 6, 7].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => { setDays(d); setSaved(false); }}
                className={`flex-1 rounded-lg border py-1.5 text-xs font-semibold transition-colors ${
                  days === d ? 'border-blue-500/60 bg-blue-500/10 text-white' : 'border-white/10 bg-white/5 text-gray-400'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Niveau</p>
          <div className="flex gap-1">
            {LEVELS.map(({ level: lv, label }) => (
              <button
                key={lv}
                type="button"
                onClick={() => { setLevel(lv); setSaved(false); }}
                className={`flex-1 rounded-lg border py-1.5 text-[11px] font-semibold transition-colors ${
                  level === lv ? 'border-blue-500/60 bg-blue-500/10 text-white' : 'border-white/10 bg-white/5 text-gray-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => { setStrength(!strength); setSaved(false); }}
        className="w-full flex items-center justify-between gap-3 text-left mt-4"
      >
        <span>
          <span className="block text-sm text-gray-200">Krachttraining (~40 min, 2×/week)</span>
          <span className="block text-xs text-gray-500 mt-0.5">Core-workouts (7 min) staan altijd in je schema.</span>
        </span>
        <span className={`flex-shrink-0 w-11 h-6 rounded-full p-0.5 transition-colors ${strength ? 'bg-blue-500' : 'bg-white/10'}`}>
          <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${strength ? 'translate-x-5' : ''}`} />
        </span>
      </button>

      <label htmlFor="pf-notes" className="block text-xs text-gray-500 mt-4 mb-1">
        Wensen voor je coach
      </label>
      <textarea
        id="pf-notes"
        value={notes}
        onChange={(e) => { setNotes(e.target.value); setSaved(false); }}
        rows={2}
        placeholder={'bijv. "geen intervallen op maandag"'}
        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30 resize-none"
      />

      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}

      <button
        type="button"
        onClick={save}
        className="w-full mt-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl py-2.5 transition-colors"
      >
        {saved ? '✓ Opgeslagen' : 'Opslaan'}
      </button>
    </div>
  );
}
