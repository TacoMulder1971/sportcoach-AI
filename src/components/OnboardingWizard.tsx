'use client';

import { useEffect, useState } from 'react';
import { isOnboarded, getProfile, saveProfile, saveGoal, generateId, parseDuration } from '@/lib/storage';
import { TrainingSport, AthleteLevel, Gender, UserProfile, Goal, GoalType, GOAL_TYPES } from '@/lib/types';
import { goalTypeMatchesSports } from '@/lib/athlete';
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

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'man', label: 'Man' },
  { value: 'vrouw', label: 'Vrouw' },
  { value: 'anders', label: 'Anders' },
];

// Begeleide deelvragen voor de coach-wensen — samen vormen ze één coach-tekst.
const COACH_PROMPTS: { key: string; label: string; hint: string; chips: string[] }[] = [
  {
    key: 'Trainingsmethode',
    label: 'Hoe train je het liefst?',
    hint: 'Je manier van trainen',
    chips: ['Polarized / 80-20', 'Op gevoel', 'Veel intervallen', 'Rustig opbouwen'],
  },
  {
    key: 'Blessures of beperkingen',
    label: 'Blessures of beperkingen?',
    hint: 'Waar moet de coach rekening mee houden',
    chips: ['Gevoelige knie', 'Rugklachten', 'Herstel van blessure', 'Geen asfalt'],
  },
  {
    key: 'Momenten die niet uitkomen',
    label: 'Momenten die niet uitkomen?',
    hint: 'Vaste momenten zonder training',
    chips: ['Nooit lang doordeweeks', 'Weekend beperkt', 'Vroege ochtend niet', 'Maandag rustdag'],
  },
  {
    key: 'Doel naast wedstrijden',
    label: 'Een doel naast wedstrijden?',
    hint: 'Wat wil je verder bereiken',
    chips: ['Afvallen', 'Fitter worden', 'Blessurevrij blijven', 'Sterker worden'],
  },
];

const TOTAL_STEPS = 7;

const STEP_TITLES = [
  'Welkom bij SportCoach AI',
  'Over jou',
  'Jouw sporten',
  'Ritme & niveau',
  'Krachttraining',
  'Wensen voor je coach',
  'Je eerste doel',
];

/**
 * Stapsgewijs welkomstscherm voor nieuwe gebruikers (leeg profiel). Vult het
 * profiel dat alle AI-coaching stuurt, plus optioneel een eerste wedstrijddoel.
 * Bestaande gebruikers zijn gemigreerd (onboarded) en zien dit nooit.
 * Later aanpassen kan via Data → Instellingen.
 */
export default function OnboardingWizard() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');

  // Stap 1 — naam
  const [name, setName] = useState('');
  // Stap 2 — over jou
  const [birthYear, setBirthYear] = useState('');
  const [gender, setGender] = useState<Gender | null>(null);
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  // Stap 3 — sporten
  const [sports, setSports] = useState<TrainingSport[]>([]);
  // Stap 4 — ritme & niveau
  const [days, setDays] = useState(4);
  const [level, setLevel] = useState<AthleteLevel>('gevorderd');
  // Stap 5 — kracht
  const [strength, setStrength] = useState(false);
  // Stap 6 — coach-wensen (per deelvraag)
  const [coachAnswers, setCoachAnswers] = useState<Record<string, string>>({});
  // Stap 7 — eerste doel
  const [goalType, setGoalType] = useState<GoalType | ''>('');
  const [goalName, setGoalName] = useState('');
  const [goalDate, setGoalDate] = useState('');
  const [goalTime, setGoalTime] = useState('');

  useEffect(() => {
    setShow(!isOnboarded());
  }, []);

  if (!show) return null;

  const currentYear = new Date().getFullYear();

  function toggleSport(s: TrainingSport) {
    setSports((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  function appendChip(key: string, chip: string) {
    setCoachAnswers((prev) => {
      const cur = prev[key]?.trim() || '';
      if (cur.toLowerCase().includes(chip.toLowerCase())) return prev;
      return { ...prev, [key]: cur ? `${cur}, ${chip}` : chip };
    });
  }

  // Doeltypes die passen bij de gekozen sporten
  const goalTypeOptions = GOAL_TYPES.filter((t) => goalTypeMatchesSports(t.type, sports));

  /** Valideert de huidige stap; geeft foutmelding terug of '' als ok. */
  function validateStep(s: number): string {
    if (s === 0 && !name.trim()) return 'Vul je naam in.';
    if (s === 1) {
      const year = parseInt(birthYear);
      if (!year || year < 1920 || year > currentYear - 8) return 'Vul een geldig geboortejaar in.';
      if (!gender) return 'Kies je geslacht.';
      const w = parseFloat(weight);
      if (!w || w < 25 || w > 250) return 'Vul een geldig gewicht in (kg).';
      const h = parseFloat(height);
      if (!h || h < 100 || h > 250) return 'Vul een geldige lengte in (cm).';
    }
    if (s === 2 && sports.length === 0) return 'Kies minimaal één sport.';
    // Stap 7 (doel) is optioneel maar als er iets ingevuld is, moeten type+naam+datum kloppen
    if (s === 6 && (goalType || goalName.trim() || goalDate)) {
      if (!goalType) return 'Kies een doeltype of laat alles leeg om over te slaan.';
      if (!goalName.trim()) return 'Vul de naam van je doel in.';
      if (!goalDate) return 'Vul de datum van je doel in.';
    }
    return '';
  }

  function next() {
    const err = validateStep(step);
    if (err) { setError(err); return; }
    setError('');
    if (step < TOTAL_STEPS - 1) setStep(step + 1);
    else finish();
  }

  function back() {
    setError('');
    if (step > 0) setStep(step - 1);
  }

  function finish() {
    const year = parseInt(birthYear);
    const age = currentYear - year;
    const maxHR = 220 - age;

    // Coach-wensen samenvoegen tot één tekst (alleen ingevulde deelvragen)
    const coachNotes = COACH_PROMPTS
      .map((p) => ({ label: p.key, val: coachAnswers[p.key]?.trim() }))
      .filter((x) => x.val)
      .map((x) => `${x.label}: ${x.val}`)
      .join('. ');

    const profile: UserProfile = {
      ...getProfile(),
      name: name.trim(),
      birthYear: year,
      gender: gender ?? undefined,
      weightKg: parseFloat(weight),
      heightCm: parseFloat(height),
      sports,
      trainingDaysPerWeek: days,
      level,
      strengthTraining: strength,
      coachNotes: coachNotes || undefined,
      maxHR,
      maxHRCycling: maxHR - 8,
      raceDate: '',
      raceGoal: '',
      raceType: '',
      onboarded: true,
    };
    saveProfile(profile);

    // Optioneel eerste doel opslaan
    if (goalType && goalName.trim() && goalDate) {
      const goal: Goal = {
        id: generateId(),
        type: goalType,
        name: goalName.trim(),
        date: goalDate,
        targetTimeSeconds: goalTime.trim() ? parseDuration(goalTime.trim()) : undefined,
        status: 'active',
        createdAt: new Date().toISOString(),
      };
      saveGoal(goal);
    }

    window.location.reload();
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black overflow-y-auto pt-safe pb-safe">
      <div className="max-w-lg mx-auto px-5 py-6 min-h-full flex flex-col">
        {/* Voortgang */}
        <div className="flex gap-1.5 mb-6">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-blue-500' : 'bg-white/10'}`}
            />
          ))}
        </div>

        <div className="mb-1 text-xs text-gray-500">Stap {step + 1} van {TOTAL_STEPS}</div>
        <h1 className="text-2xl font-bold text-white mb-5">{STEP_TITLES[step]}</h1>

        <div className="flex-1 space-y-4">
          {/* ── Stap 1: welkom + naam ── */}
          {step === 0 && (
            <>
              <p className="text-gray-400 text-sm leading-relaxed -mt-2">
                Vertel je AI-coach wie je bent — dan zijn je schema&apos;s en adviezen
                vanaf dag één op jou afgestemd. Dit duurt een minuutje; alles is later
                aan te passen bij Instellingen.
              </p>
              <div className="bg-[#0d0d0f] rounded-3xl border border-white/5 p-5">
                <label htmlFor="ob-name" className="block text-sm text-gray-400 mb-2">Hoe heet je?</label>
                <input
                  id="ob-name" type="text" value={name} autoComplete="given-name"
                  onChange={(e) => setName(e.target.value)} placeholder="Voornaam"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
                />
              </div>
            </>
          )}

          {/* ── Stap 2: over jou ── */}
          {step === 1 && (
            <div className="bg-[#0d0d0f] rounded-3xl border border-white/5 p-5 space-y-4">
              <div>
                <label htmlFor="ob-year" className="block text-sm text-gray-400 mb-2">Geboortejaar</label>
                <input
                  id="ob-year" type="number" inputMode="numeric" value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)} placeholder="bijv. 1985"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
                />
                <p className="text-gray-500 text-xs mt-2">Hiermee schatten we je hartslagzones — later verfijnbaar bij Instellingen.</p>
              </div>
              <div>
                <span className="block text-sm text-gray-400 mb-2">Geslacht</span>
                <div className="flex gap-2">
                  {GENDER_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value} type="button" onClick={() => setGender(value)}
                      className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition-colors ${
                        gender === value ? 'border-blue-500/60 bg-blue-500/10 text-white' : 'border-white/10 bg-white/5 text-gray-400'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label htmlFor="ob-weight" className="block text-sm text-gray-400 mb-2">Gewicht (kg)</label>
                  <input
                    id="ob-weight" type="number" inputMode="decimal" value={weight}
                    onChange={(e) => setWeight(e.target.value)} placeholder="bijv. 74"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
                  />
                </div>
                <div className="flex-1">
                  <label htmlFor="ob-height" className="block text-sm text-gray-400 mb-2">Lengte (cm)</label>
                  <input
                    id="ob-height" type="number" inputMode="numeric" value={height}
                    onChange={(e) => setHeight(e.target.value)} placeholder="bijv. 182"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Stap 3: sporten ── */}
          {step === 2 && (
            <div className="bg-[#0d0d0f] rounded-3xl border border-white/5 p-5">
              <p className="text-sm text-gray-400 mb-1">Welke sporten wil je in je trainingsschema?</p>
              <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                Je coach plant alleen de aangevinkte sporten in. Een andere sport af en
                toe? Die kun je er later los bij vragen — hij komt niet vanzelf in je schema.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {SPORT_OPTIONS.map(({ sport, label }) => {
                  const active = sports.includes(sport);
                  return (
                    <button
                      key={sport} type="button" onClick={() => toggleSport(sport)}
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
          )}

          {/* ── Stap 4: ritme & niveau ── */}
          {step === 3 && (
            <div className="bg-[#0d0d0f] rounded-3xl border border-white/5 p-5">
              <p className="text-sm text-gray-400 mb-3">Hoeveel dagen per week wil je trainen?</p>
              <div className="flex gap-2">
                {[2, 3, 4, 5, 6, 7].map((d) => (
                  <button
                    key={d} type="button" onClick={() => setDays(d)}
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
                    key={lv} type="button" onClick={() => setLevel(lv)}
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
          )}

          {/* ── Stap 5: kracht ── */}
          {step === 4 && (
            <div className="bg-[#0d0d0f] rounded-3xl border border-white/5 p-5">
              <button
                type="button" onClick={() => setStrength(!strength)}
                className="w-full flex items-center justify-between gap-3 text-left"
              >
                <span>
                  <span className="block text-sm font-medium text-white">Krachttraining in je schema?</span>
                  <span className="block text-xs text-gray-500 mt-1 leading-relaxed">
                    Korte core-workouts (7 min, zonder apparatuur) plant je coach altijd
                    in. Zet dit aan voor ook 2× per week ~40 min krachttraining.
                  </span>
                </span>
                <span className={`flex-shrink-0 w-12 h-7 rounded-full p-1 transition-colors ${strength ? 'bg-blue-500' : 'bg-white/10'}`}>
                  <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${strength ? 'translate-x-5' : ''}`} />
                </span>
              </button>
            </div>
          )}

          {/* ── Stap 6: coach-wensen ── */}
          {step === 5 && (
            <>
              <p className="text-gray-400 text-sm leading-relaxed -mt-2">
                Dit stuurt je schema&apos;s het sterkst. Vul in wat past — tik een
                voorbeeld aan of typ je eigen tekst. Alles mag leeg blijven.
              </p>
              {COACH_PROMPTS.map((p) => (
                <div key={p.key} className="bg-[#0d0d0f] rounded-3xl border border-white/5 p-5">
                  <label className="block text-sm font-medium text-white mb-0.5">{p.label}</label>
                  <p className="text-xs text-gray-500 mb-2">{p.hint}</p>
                  <input
                    type="text" value={coachAnswers[p.key] || ''}
                    onChange={(e) => setCoachAnswers((prev) => ({ ...prev, [p.key]: e.target.value }))}
                    placeholder="Typ hier of kies hieronder…"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {p.chips.map((chip) => (
                      <button
                        key={chip} type="button" onClick={() => appendChip(p.key, chip)}
                        className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300 hover:border-white/30"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* ── Stap 7: eerste doel ── */}
          {step === 6 && (
            <>
              <p className="text-gray-400 text-sm leading-relaxed -mt-2">
                Heb je al een wedstrijd of doel op het oog? Dan bouwt je coach je schema
                daar naartoe. Nog niet? Sla over — je kunt later altijd een doel toevoegen.
              </p>
              <div className="bg-[#0d0d0f] rounded-3xl border border-white/5 p-5 space-y-4">
                <div>
                  <label htmlFor="ob-goaltype" className="block text-sm text-gray-400 mb-2">Type doel</label>
                  <select
                    id="ob-goaltype" value={goalType}
                    onChange={(e) => setGoalType(e.target.value as GoalType)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-white/30"
                  >
                    <option value="">— Kies een doeltype —</option>
                    {goalTypeOptions.map((t) => (
                      <option key={t.type} value={t.type}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="ob-goalname" className="block text-sm text-gray-400 mb-2">Naam</label>
                  <input
                    id="ob-goalname" type="text" value={goalName}
                    onChange={(e) => setGoalName(e.target.value)} placeholder="bijv. Marathon Rotterdam"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
                  />
                </div>
                <div>
                  <label htmlFor="ob-goaldate" className="block text-sm text-gray-400 mb-2">Datum</label>
                  <input
                    id="ob-goaldate" type="date" value={goalDate}
                    onChange={(e) => setGoalDate(e.target.value)}
                    style={{ colorScheme: 'dark' }}
                    className="w-full min-w-0 bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-white/30"
                  />
                </div>
                <div>
                  <label htmlFor="ob-goaltime" className="block text-sm text-gray-400 mb-2">Streeftijd <span className="text-gray-600">(opt.)</span></label>
                  <input
                    id="ob-goaltime" type="text" value={goalTime}
                    onChange={(e) => setGoalTime(e.target.value)} placeholder="hh:mm:ss"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {error && <p className="text-red-400 text-sm text-center mt-4">{error}</p>}

        {/* Navigatie */}
        <div className="flex items-center gap-3 mt-6">
          {step > 0 && (
            <button
              type="button" onClick={back}
              className="px-5 py-3.5 rounded-2xl text-gray-300 font-medium bg-white/5 border border-white/10"
            >
              Vorige
            </button>
          )}
          <button
            type="button" onClick={next}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-2xl py-3.5 transition-colors"
          >
            {step === TOTAL_STEPS - 1 ? 'Start met trainen' : 'Volgende'}
          </button>
        </div>
        {/* Op de doel-stap: overslaan zonder doel */}
        {step === TOTAL_STEPS - 1 && (
          <button
            type="button"
            onClick={() => { setGoalType(''); setGoalName(''); setGoalDate(''); setGoalTime(''); setError(''); finish(); }}
            className="w-full text-center text-sm text-gray-500 hover:text-gray-300 mt-3"
          >
            Nog geen doel — later kiezen
          </button>
        )}
      </div>
    </div>
  );
}
