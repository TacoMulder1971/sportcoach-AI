'use client';

// Los voorbeeldscherm voor een nieuw visueel design — geen koppeling met live data,
// raakt geen bestaande pagina's of componenten aan. Puur ter beoordeling.
// Stijl: Whoop-achtig (zwart, grote ronde score, neon accenten) gecombineerd met de
// bestaande neon-glow SportIcon's uit de app.

import SportIcon from '@/components/SportIcon';
import Countdown from '@/components/Countdown';

type IconProps = { className?: string; style?: React.CSSProperties };
function IconChat({ className, style }: IconProps) {
  return (<svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>);
}
function IconCalendar({ className, style }: IconProps) {
  return (<svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>);
}
function IconTrophy({ className, style }: IconProps) {
  return (<svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>);
}
function IconHome({ className, style }: IconProps) {
  return (<svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>);
}
function IconData({ className, style }: IconProps) {
  return (<svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>);
}
function IconFood({ className, style }: IconProps) {
  return (<svg className={className} style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>);
}

// Whoop-achtige ring: groot, dun, met gloed in de score-kleur
function ScoreRing({ pct, label, sublabel, color, glow }: { pct: number; label: string; sublabel: string; color: string; glow: string }) {
  const r = 70;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative w-48 h-48 mx-auto">
      <svg viewBox="0 0 160 160" className="w-48 h-48 -rotate-90">
        <circle cx="80" cy="80" r={r} fill="none" stroke="#1c1c1e" strokeWidth="10" />
        <circle
          cx="80" cy="80" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c}
          style={{ filter: glow }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-white text-5xl font-bold tabular-nums">{pct}%</span>
        <span className="text-gray-400 text-sm font-medium mt-1 uppercase tracking-wide">{label}</span>
        <span className="text-gray-500 text-sm mt-0.5">{sublabel}</span>
      </div>
    </div>
  );
}

export default function DesignVoorbeeld() {
  return (
    <div className="bg-black min-h-screen">
      {/* Hero — de bestaande Countdown-component (ongewijzigd qua inhoud/opmaak), alleen
          een andere achtergrondkleur ter vergelijking met de huidige blauw/indigo. */}
      <div className="px-5 pt-6">
        <Countdown gradientClassName="bg-gradient-to-br from-teal-700 via-cyan-800 to-blue-900" />
      </div>

      <div className="px-5 -mt-5 space-y-5 pb-8">
        {/* Gereedheid-score (Whoop "Recovery") */}
        <div className="bg-[#0d0d0f] rounded-3xl p-6 border border-white/5">
          <ScoreRing
            pct={78}
            label="Gereedheid"
            sublabel="Goed herstel"
            color="#22c55e"
            glow="drop-shadow(0 0 10px #22c55e) drop-shadow(0 0 24px rgba(34,197,94,0.45))"
          />
          <div className="grid grid-cols-3 gap-2 mt-6">
            <div className="text-center">
              <p className="text-gray-500 text-sm uppercase tracking-wide">HRV</p>
              <p className="text-white font-bold text-xl mt-0.5">52<span className="text-gray-500 text-sm font-normal"> ms</span></p>
            </div>
            <div className="text-center border-x border-white/5">
              <p className="text-gray-500 text-sm uppercase tracking-wide">Rust HR</p>
              <p className="text-white font-bold text-xl mt-0.5">48<span className="text-gray-500 text-sm font-normal"> bpm</span></p>
            </div>
            <div className="text-center">
              <p className="text-gray-500 text-sm uppercase tracking-wide">Slaap</p>
              <p className="text-white font-bold text-xl mt-0.5">7.4<span className="text-gray-500 text-sm font-normal"> u</span></p>
            </div>
          </div>
        </div>

        {/* Training load (Whoop "Strain") */}
        <div className="bg-[#0d0d0f] rounded-3xl p-5 border border-white/5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-gray-400 text-sm font-semibold uppercase tracking-wide">Training load</p>
            <span className="text-sky-400 text-sm font-semibold">Optimaal</span>
          </div>
          <div className="flex items-end gap-3">
            <span className="text-white text-5xl font-bold tabular-nums" style={{ filter: 'drop-shadow(0 0 10px rgba(56,189,248,0.5))' }}>412</span>
            <span className="text-gray-500 text-base mb-1">/ 600 TRIMP deze week</span>
          </div>
          <div className="flex gap-1 mt-3 h-8 items-end">
            {[30, 55, 20, 70, 45, 90, 60].map((h, i) => (
              <div key={i} className="flex-1 rounded-sm bg-sky-500/70" style={{ height: `${h}%`, opacity: i === 5 ? 1 : 0.35 }} />
            ))}
          </div>
        </div>

        {/* Training vandaag — met bestaande SportIcon */}
        <div>
          <p className="text-gray-500 text-sm font-semibold uppercase tracking-wide mb-2 px-1">Training vandaag</p>
          <div className="bg-[#0d0d0f] rounded-3xl p-4 border border-white/5 flex items-center gap-3">
            <SportIcon sport="hardlopen" size="lg" />
            <div className="flex-1">
              <p className="text-white font-semibold text-lg">Duurloop</p>
              <p className="text-gray-500 text-sm">60 min · Zone 2 · 9.5 km</p>
            </div>
            <span className="text-gray-500 text-sm">→</span>
          </div>
        </div>

        {/* Coach bericht */}
        <div className="bg-[#0d0d0f] rounded-3xl p-4 border border-white/5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center flex-shrink-0" style={{ filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.15))' }}>
              <IconChat className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-gray-400 text-sm font-semibold uppercase tracking-wide">Coach van de dag</p>
              <p className="text-gray-200 text-base mt-1 leading-relaxed">
                Goed herstel na gisteren. Vandaag staat een duurloop op het programma — hou de
                snelheid bewust laag, de focus ligt op aerobe basis.
              </p>
            </div>
          </div>
        </div>

        {/* Snel naar — neon glow-stijl zoals SportIcon */}
        <div>
          <p className="text-gray-500 text-sm font-semibold uppercase tracking-wide mb-2 px-1">Snel naar</p>
          <div className="grid grid-cols-4 gap-2.5">
            {[
              { label: 'Coach', Icon: IconChat, color: '#3b82f6' },
              { label: 'Schema', Icon: IconCalendar, color: '#a855f7' },
              { label: 'Races', Icon: IconTrophy, color: '#eab308' },
              { label: 'Data', Icon: IconData, color: '#22c55e' },
            ].map((a) => (
              <div key={a.label} className="bg-[#0d0d0f] rounded-2xl p-3 border border-white/5 flex flex-col items-center text-center gap-1.5">
                <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center">
                  <a.Icon
                    className="w-4 h-4"
                    style={{ color: a.color, filter: `drop-shadow(0 0 6px ${a.color})` }}
                  />
                </div>
                <p className="text-gray-300 text-sm font-medium">{a.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Volume per sport — met bestaande SportIcon's */}
        <div>
          <p className="text-gray-500 text-sm font-semibold uppercase tracking-wide mb-2 px-1">Volume deze week</p>
          <div className="bg-[#0d0d0f] rounded-3xl p-4 border border-white/5 space-y-3">
            {[
              { sport: 'zwemmen' as const, label: 'Zwemmen', value: '2.1 km', pct: 35 },
              { sport: 'fietsen' as const, label: 'Fietsen', value: '64 km', pct: 70 },
              { sport: 'hardlopen' as const, label: 'Hardlopen', value: '22 km', pct: 55 },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-3">
                <SportIcon sport={s.sport} size="sm" />
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-300">{s.label}</span>
                    <span className="text-gray-500">{s.value}</span>
                  </div>
                  <div className="bg-white/5 rounded-full h-1.5">
                    <div className="rounded-full h-1.5 bg-gradient-to-r from-white/40 to-white/80" style={{ width: `${s.pct}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Navigatie-voorbeeld — donker, met neon-actief icoon zoals SportIcon */}
        <div>
          <p className="text-gray-500 text-sm font-semibold uppercase tracking-wide mb-2 px-1">Navigatie-stijl (voorbeeld)</p>
          <div className="bg-[#0d0d0f] rounded-2xl border border-white/5 p-2 flex justify-around">
            {[
              { label: 'Home', Icon: IconHome, active: true },
              { label: 'Schema', Icon: IconCalendar },
              { label: 'Coach', Icon: IconChat },
              { label: 'Races', Icon: IconTrophy },
              { label: 'Voeding', Icon: IconFood },
              { label: 'Data', Icon: IconData },
            ].map((n) => (
              <div key={n.label} className="flex flex-col items-center gap-1 py-1.5 px-1">
                <n.Icon
                  className="w-5 h-5"
                  style={n.active ? { color: '#fff', filter: 'drop-shadow(0 0 6px rgba(255,255,255,0.6))' } : { color: '#52525b' }}
                />
                <span className={`text-xs ${n.active ? 'text-white font-semibold' : 'text-gray-600'}`}>{n.label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-gray-600 text-sm text-center pt-2">
          Dit is een los ontwerpvoorbeeld met vaste demo-data — niets hierop is al doorgevoerd in de echte app.
        </p>
      </div>
    </div>
  );
}
