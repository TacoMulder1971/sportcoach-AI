// Los voorbeeldscherm voor een nieuw visueel design — geen koppeling met live data,
// raakt geen bestaande pagina's of componenten aan. Puur ter beoordeling.

function IconBolt({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 3 14h7l-1 8 11-12h-7z"/></svg>);
}
function IconCheck({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>);
}
function IconChat({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>);
}
function IconCalendar({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>);
}
function IconTrophy({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>);
}
function IconHome({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>);
}
function IconData({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>);
}
function IconFood({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>);
}
function IconSwim({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M2 17.5c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 4.5 0 3-1.2 4.5 0M5 13l5-5 3 3 5-5"/></svg>);
}
function IconBike({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5L9 12l4-4 3 3h4M9 12 7.5 9.5 4 12"/></svg>);
}
function IconRun({ className }: { className?: string }) {
  return (<svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="13" cy="4" r="2"/><path d="M4 17l4-2 2-5 4 1 3 5 4 2M9 11 7 8M11 13l-3 7"/></svg>);
}

export default function DesignVoorbeeld() {
  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 rounded-b-[32px] px-5 pt-8 pb-9 shadow-lg shadow-indigo-200/50">
        <div className="absolute -top-10 -right-10 w-44 h-44 bg-white/15 rounded-full blur-2xl" />

        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-white/75 text-sm">Goedemorgen</p>
            <h1 className="text-white text-2xl font-bold">Taco</h1>
          </div>
          <div className="w-11 h-11 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white font-semibold">
            T
          </div>
        </div>

        {/* Countdown ring */}
        <div className="relative mt-6 flex items-center gap-4 bg-white/15 backdrop-blur-md rounded-2xl p-4 border border-white/20">
          <div className="relative w-16 h-16 flex-shrink-0">
            <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeDasharray="97.4" strokeDashoffset="32" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-white font-bold text-sm">23d</span>
            </div>
          </div>
          <div>
            <p className="text-white font-semibold">Triatlon 1/4</p>
            <p className="text-white/75 text-xs">Opbouwfase · 67% voltooid</p>
          </div>
        </div>
      </div>

      <div className="px-5 -mt-5 space-y-4 pb-8">
        {/* Stat chips */}
        <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
          <div className="flex-shrink-0 bg-white rounded-2xl p-4 w-32 shadow-sm shadow-gray-200/60 border border-gray-100">
            <p className="text-gray-400 text-[11px]">Load</p>
            <p className="text-emerald-600 text-xl font-bold mt-1">412</p>
            <p className="text-emerald-600/80 text-[11px]">Optimaal</p>
          </div>
          <div className="flex-shrink-0 bg-white rounded-2xl p-4 w-32 shadow-sm shadow-gray-200/60 border border-gray-100">
            <p className="text-gray-400 text-[11px]">Gereedheid</p>
            <p className="text-amber-500 text-xl font-bold mt-1">7/9</p>
            <p className="text-amber-500/80 text-[11px]">Goed</p>
          </div>
          <div className="flex-shrink-0 bg-white rounded-2xl p-4 w-32 shadow-sm shadow-gray-200/60 border border-gray-100">
            <p className="text-gray-400 text-[11px]">Rust HR</p>
            <p className="text-sky-600 text-xl font-bold mt-1">48</p>
            <p className="text-sky-600/80 text-[11px]">-2 vs vorige week</p>
          </div>
        </div>

        {/* Coach bericht */}
        <div className="bg-white rounded-2xl p-4 shadow-sm shadow-gray-200/60 border border-gray-100">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0">
              <IconChat className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-indigo-500 text-[11px] font-semibold uppercase tracking-wide">Coach van de dag</p>
              <p className="text-gray-700 text-sm mt-1 leading-relaxed">
                Goed herstel na gisteren. Vandaag staat een duurloop op het programma — hou de
                snelheid bewust laag, de focus ligt op aerobe basis.
              </p>
            </div>
          </div>
        </div>

        {/* Training vandaag */}
        <div>
          <p className="text-gray-400 text-[11px] font-medium uppercase tracking-wide mb-2 px-1">Training vandaag</p>
          <div className="bg-gradient-to-br from-orange-50 to-orange-50/30 rounded-2xl p-4 border border-orange-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                  <IconRun className="w-5 h-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-gray-900 font-semibold">Duurloop</p>
                  <p className="text-gray-500 text-xs">60 min · Z2 · 9.5 km</p>
                </div>
              </div>
              <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center">
                <IconBolt className="w-3.5 h-3.5 text-emerald-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Snel naar */}
        <div>
          <p className="text-gray-400 text-[11px] font-medium uppercase tracking-wide mb-2 px-1">Snel naar</p>
          <div className="grid grid-cols-4 gap-2.5">
            {[
              { label: 'Check-out', Icon: IconCheck, color: 'from-emerald-500 to-emerald-600' },
              { label: 'Coach', Icon: IconChat, color: 'from-sky-500 to-sky-600' },
              { label: 'Schema', Icon: IconCalendar, color: 'from-violet-500 to-violet-600' },
              { label: 'Data', Icon: IconData, color: 'from-amber-500 to-amber-600' },
            ].map((a) => (
              <div key={a.label} className="bg-white rounded-2xl p-3 shadow-sm shadow-gray-200/60 border border-gray-100 flex flex-col items-center text-center gap-1.5">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${a.color} flex items-center justify-center`}>
                  <a.Icon className="w-4 h-4 text-white" />
                </div>
                <p className="text-gray-700 text-[11px] font-medium">{a.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Volume per sport */}
        <div>
          <p className="text-gray-400 text-[11px] font-medium uppercase tracking-wide mb-2 px-1">Volume deze week</p>
          <div className="bg-white rounded-2xl p-4 shadow-sm shadow-gray-200/60 border border-gray-100 space-y-3">
            {[
              { label: 'Zwemmen', Icon: IconSwim, value: '2.1 km', pct: 35, color: 'bg-cyan-400' },
              { label: 'Fietsen', Icon: IconBike, value: '64 km', pct: 70, color: 'bg-emerald-400' },
              { label: 'Hardlopen', Icon: IconRun, value: '22 km', pct: 55, color: 'bg-orange-400' },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-3">
                <s.Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600">{s.label}</span>
                    <span className="text-gray-400">{s.value}</span>
                  </div>
                  <div className="bg-gray-100 rounded-full h-1.5">
                    <div className={`${s.color} rounded-full h-1.5`} style={{ width: `${s.pct}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Volgende wedstrijd */}
        <div>
          <p className="text-gray-400 text-[11px] font-medium uppercase tracking-wide mb-2 px-1">Volgende wedstrijd</p>
          <div className="bg-white rounded-2xl p-4 shadow-sm shadow-gray-200/60 border border-gray-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-fuchsia-100 flex items-center justify-center flex-shrink-0">
              <IconTrophy className="w-5 h-5 text-fuchsia-500" />
            </div>
            <div className="flex-1">
              <p className="text-gray-900 font-semibold text-sm">Triatlon Almere · 1/4</p>
              <p className="text-gray-400 text-xs">13 juli 2026 · over 23 dagen</p>
            </div>
            <span className="text-gray-300 text-xs">→</span>
          </div>
        </div>

        {/* Navigatie-voorbeeld (statisch, los van de echte app-navigatie) */}
        <div>
          <p className="text-gray-400 text-[11px] font-medium uppercase tracking-wide mb-2 px-1">Navigatie-stijl (voorbeeld)</p>
          <div className="bg-white rounded-2xl shadow-sm shadow-gray-200/60 border border-gray-100 p-2 flex justify-around">
            {[
              { label: 'Home', Icon: IconHome, active: true },
              { label: 'Schema', Icon: IconCalendar },
              { label: 'Coach', Icon: IconChat },
              { label: 'Races', Icon: IconTrophy },
              { label: 'Voeding', Icon: IconFood },
              { label: 'Data', Icon: IconData },
            ].map((n) => (
              <div key={n.label} className="flex flex-col items-center gap-1 py-1.5 px-1">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${n.active ? 'bg-gradient-to-br from-indigo-500 to-fuchsia-500' : ''}`}>
                  <n.Icon className={`w-4 h-4 ${n.active ? 'text-white' : 'text-gray-300'}`} />
                </div>
                <span className={`text-[9px] ${n.active ? 'text-indigo-600 font-semibold' : 'text-gray-300'}`}>{n.label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-gray-300 text-[11px] text-center pt-2">
          Dit is een los ontwerpvoorbeeld met vaste demo-data — niets hierop is al doorgevoerd in de echte app.
        </p>
      </div>
    </div>
  );
}
