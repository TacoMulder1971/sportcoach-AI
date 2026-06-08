# CLAUDE.md

Richtlijnen voor het werken in deze codebase. Lees dit voordat je wijzigingen maakt.

## Wat is dit
SportCoach AI — een Nederlandstalige AI-sportcoach-webapp (Next.js, PWA). Oorspronkelijk voor één atleet (Taco), sinds 2026-06-04 **multi-user**: vrienden koppelen hun eigen Garmin-account. Integreert Garmin-data, dagelijkse check-ins, AI-coach chat (Claude), weekrapporten, MyFitnessPal-voeding, materiaal-tracking, multisport en een wedstrijd-dashboard (tabblad "Races").

## Commando's
- `npm run dev` — lokale dev-server
- `npm run build` — productie-build (draai dit vóór elke push als sanity-check)
- `npm run lint` — ESLint
- `npx tsc --noEmit` — type-check (geen apart script; draai handmatig)

## Stack
- Next.js 16 (App Router), React 19, TailwindCSS 4
- `@anthropic-ai/sdk` voor Claude-calls
- `garmin-connect` voor Garmin-data
- `next-pwa` voor PWA
- Gehost op **Vercel** (project `sportcoach-ai`). Push naar `main` → auto-deploy.

## Architectuur & conventies
- **Taal:** alle UI en gebruikerstekst is **Nederlands**. Houd dit aan.
- **Opslag:** alles via `src/lib/storage.ts` (localStorage). Niet direct localStorage aanroepen elders.
- **Types:** centraal in `src/lib/types.ts`. Voeg nieuwe types daar toe.
- **AI-modellen:** Haiku (`claude-haiku-4-5-20251001`) voor snelle feedback/JSON-formattering, Opus 4.8 (`claude-opus-4-8`) voor coach-chat én de schema-redenering, Sonnet (`claude-sonnet-4-6`) voor snelle dag-aanpassingen (`adjust-day`). Zie `src/app/api/*`. **Vercel-timeout:** standaard 10s; verleng met `export const maxDuration` als een endpoint Opus gebruikt (chat=30, generate-plan=60). Opus' nieuwe thinking-API = `thinking: { type: 'adaptive' }` + `output_config: { effort }` (niet `budget_tokens`).
- **Navigatie:** tab-layout in `src/components/Navigation.tsx`.
- **Pure logica** in `src/lib/*` (bijv. `equipment.ts`, `swim.ts`, `training-load.ts`, `periodization.ts`, `races.ts`), UI in `src/components/*`.

## Belangrijke domeinkennis
- **Trends:** wandelen telt NIET mee in hardloop-trends (exacte match `sport === 'hardlopen'`). Stadsfiets-ritten tellen niet mee in trainingsstatistieken (`filterStatsActivities` in `equipment.ts`).
- **Materiaal:** fiets-types `racefiets | mountainbike | stadsfiets` + `hardloopschoenen`. Stadsfiets heeft bewust geen onderhoud. Legacy `'fiets'` wordt gemigreerd naar `racefiets`.
- **Zwemmen:** varianten binnen/buiten/openwater per activiteit.
- **Multisport (triatlon/duatlon/brick):** Garmin slaat dit op als **parent met child-activiteiten**. De disciplines zitten NIET in `/splits`, maar in `metadataDTO.childIds` → per child `activityTypeDTO.typeKey` + `summaryDTO`. Zie `src/app/api/garmin/sync/route.ts`.
- **Wedstrijden (tabblad "Races", `/wedstrijden`):** races komen uit het **Doelen-systeem** (geen aparte opslag); `src/lib/races.ts` koppelt elk `Goal` aan de Garmin-activiteit van ±1 dag voor echte splits/pace/HR. Weer via `src/app/api/weather/route.ts` (Open-Meteo, geen API-key), gecached per goalId.
- **Activiteiten-archief:** de Garmin-sync overschrijft de live-data, dus voor historische trends (bijv. de aanloop naar een wedstrijd) is er een **groeiend archief** in `storage.ts` (`ACTIVITY_ARCHIVE` + `HEALTH_ARCHIVE`, dedup). De sync haalt nu 150 activiteiten op; beide sync-handlers (`page.tsx`, `data/page.tsx`) mergen álles in het archief en trimmen de live-weergave tot 40.
- **Schema-generatie (`/schema/nieuw` → `/api/generate-plan`, generate-mode):** twee-traps. **Trap 1** = Opus 4.8 met extended thinking schrijft een coachstrategie (geen JSON) op basis van de **prestatie-samenvatting** van de afgelopen weken; **trap 2** = Haiku zet die strategie om naar gevalideerde JSON. De prestatie-samenvatting komt uit `src/lib/performance-summary.ts` (`buildPerformanceSummary`): **8-weekse** breakdown uit het archief (volume/afstand/HR per sport, TRIMP-trend, herstel-trend, wedstrijdresultaten per week), stadsfiets uitgesloten via `filterStatsActivities`. De API geeft naast `plan` ook `strategy` terug; die toont de UI als inklapbare "Waarom dit schema"-kaart (markdown opgeschoond met `cleanStrategyText`). Duurt ~40s — bewust. De refine-mode en `adjust-day` blijven snel (Haiku/Sonnet, één call).
- **Meerdere wedstrijden / jaarplanning (2026-06-04):** het Doelen-systeem ondersteunt meerdere actieve doelen tegelijk — geen "hoofddoel", alle wedstrijden zijn gelijkwaardig. `getUpcomingGoals()` geeft alle actieve doelen met datum ≥ vandaag gesorteerd op datum. `getActiveGoal()` kiest altijd de dichtstbijzijnde toekomstige race (voor countdown, periodisering, schema-focus). `buildRaceContextText()` geeft de volledige wedstrijdkalender aan de AI, met "← VOLGENDE" markering. `getPendingResultGoal()` checkt alle voorbije actieve doelen zonder resultaat. De `GoalsSection` toont een gerangschikte lijst: bovenste = volgende wedstrijd (blauw), de rest wit. Formulier-modals gebruiken nu **flex-column layout** (header/footer `flex-shrink-0`, body `flex-1 overflow-y-auto`) zodat de Opslaan-knop altijd zichtbaar is op mobiel.
- **Afstanden per discipline (2026-06-04):** multisport-doelen (triatlon, duatlon) hebben optioneel `disciplineDistancesKm: { swim?, bike?, run?, run2? }` (km). Ingevuld via het bewerkformulier (velden verschijnen alleen bij multisport-types; duatlon heeft een tweede looponderdeel). Worden opgenomen in `buildRaceContextText()` en `buildGoalsHistoryText()` voor AI-context.
- **Sport-specifieke hartslagzones (2026-06-04):** `UserProfile` heeft `hrZonesRun` en `hrZonesCycling` (`HRZoneConfig`: z1min–z5min + maxHR). Instelbaar via "Hartslagzones instellen" op de Data-tab (tabel met Z1–Max HR × hardlopen/fietsen, Opslaan-knop). `getRunZones()` / `getCyclingZones()` in `storage.ts` lossen de config op (aangepast of berekend via `computeHRZones(maxHR)` als fallback). `buildHRZoneText()` genereert sport-specifieke zone-tekst voor alle AI-prompts (generate-plan, adjust-day, chat). Schema-tab toont twee aparte zone-tabellen. `HEART_RATE_ZONES` blijft als backward-compat constante (hardlopen, max HR 172).
- **Multi-user / Garmin-koppeling (2026-06-04):** Garmin-credentials zitten **niet** meer hardcoded op de server. Elke gebruiker vult email+wachtwoord in via `GarminSetupCard` (Data-tab), opgeslagen in localStorage (`GARMIN_CREDENTIALS`, helpers `getGarminCredentials/saveGarminCredentials/clearGarminCredentials`). Beide sync-handlers (`page.tsx`, `data/page.tsx`) sturen de credentials mee in de POST naar `/api/garmin/sync`; de route leest ze uit het request body met **env vars als fallback** (`GARMIN_EMAIL/PASSWORD`). Auto-sync op de homepage wordt overgeslagen als er geen credentials in localStorage staan. Let op: Garmin met MFA aan geeft "login failed (Ticket not found or MFA)" — de `garmin-connect` library ondersteunt MFA niet, gebruiker moet 2FA uitzetten.
- **Cyclus vóór startdatum:** `getCurrentWeekNumber`/`getTrainingForDayOffset` in `schedule.ts` geven **week 1** als `cycleStartDate` in de toekomst ligt (negatieve `diffDays`) — anders gaf JS-modulo op negatieve getallen ten onrechte week 2.
- **Cyclus uitlijnen op de race (2026-06-08):** `getActivePlan()` in `storage.ts` corrigeert bij het inlezen de `cycleStartDate` via `alignCycleStartToRace()`: als de race binnen de cyclus valt (`0 ≤ daysUntilRace < weken×7`), wordt de week mét de race aan de **laatste planweek** gekoppeld (wedstrijdweek = week 2). Anders blijft de opgeslagen datum staan. Past géén plan-inhoud of opgeslagen data aan — alleen de read-time ankerdatum, dus home/coach/schema (die allemaal `getActivePlan` gebruiken) tonen meteen de juiste "huidige week". Reden: `approvePlan` zet `cycleStartDate = getNextMonday()` met week 1 vooraan, waardoor de wedstrijdweek anders een week te laat "huidig" werd. Rekent in **UTC** (`...T00:00:00Z` + `getUTCDay`) om tijdzone-drift in de ankerdatum te vermijden.
- **Grafieken:** `src/components/BuildupBarChart.tsx` (staafdiagram, wedstrijd-aanloop + Data-trends), `TrendLineChart.tsx` (lijn), `WeeklyVolumeChart.tsx` (gestapeld staafdiagram volume per sport: zwem=blauw/fiets=groen/run=oranje). Alle drie hebben **hover/touch-tooltips** (React-state + absoluut gepositioneerde overlay-div, dichtstbijzijnde staaf/punt via x-positie). De **Data-tab Trends** gebruikt `BuildupBarChart` op een `bg-gray-100`-kaart, in volgorde: volume per sport → rusthartslag → HRV → gem. HR/tempo/speed/power/zwemtempo. Rusthart+HRV komen uit `HEALTH_ARCHIVE` (`getHealthArchive`), volume uit `ACTIVITY_ARCHIVE` (`getActivityArchive`).
- **Gedeelde Garmin-sync (2026-06-06):** `syncGarminData()` in `storage.ts` is de **canonieke** sync (delta-fetch, hrZones behouden, archief-merge, live-weergave trimmen tot 40, `markAutoSyncDone`). Gebruikt door de check-out (`CheckInForm`/`CheckInContent`); homepage `page.tsx` heeft nog z'n eigen `handleGarminSync` (stuurt creds mee). Geeft verse data terug of throwt bij mislukte sync (caller valt terug op cache).
- **Check-out coach (`/coach`, tab "Check-out", 2026-06-06):** `CheckInContent` **synct Garmin bij het openen** (cache eerst tonen, dan vers; sync-indicator) zodat de activiteiten van vandaag direct zichtbaar zijn. Drie situaties: (1) trainingsdag → gepland-vs-gedaan + check-out-formulier; (2) **rustdag mét Garmin-activiteit** → toont "Rustdag — maar je hebt toch getraind" + activiteit + check-out (lege `sessions`, coach krijgt rustdag-specifieke opdracht: focus op herstel i.p.v. geplande doelen); (3) rustdag zonder activiteit → rust-boodschap. **Al ingecheckt is geen dead-end meer:** `CheckInForm` krijgt een `resumeCheckIn`-prop die het gesprek heropent met de eerdere coach-berichten zodat je kunt doorvragen. Activiteiten-kaartjes via gedeelde `TodayActivities`-helper.
- **Coach van de dag (`/api/daily-message`, 2026-06-06):** (a) **timing-fix** — elke recente activiteit krijgt een expliciet dag-label (`[VANDAAG]`/`[GISTEREN]`/`[WEEKDAG, X DAGEN GELEDEN]`) op basis van echte datum vs. vandaag, met harde regel "noem iets alleen 'gisteren' bij `[GISTEREN]`, anders de weekdag" — anders gokte Haiku "gisteren" voor alles. (b) **sync-first** — `page.tsx` forceert een Garmin-sync vóór het eerste dagbericht van de dag (zolang er creds zijn); de `syncing`-gate laat de generatie wachten tot de sync klaar is. De vernieuw-knop synct nu ook eerst (`refreshDailyMessage`). Cache 1x/dag (`getDailyMessage`, key = Amsterdam-datum). Model: Haiku.

## Git
- **Werkwijze (voorkeur gebruiker, 2026-05-31): bij UI-wijzigingen eerst een preview tonen en de gebruiker laten bevestigen dat het goed is; pas ná akkoord committen + pushen. Niet ongevraagd pushen.** Werk direct op `main`, geen feature-branch nodig.
- Verifieer áltijd met `npx tsc --noEmit` + `npm run build` vóór de push.
- Push naar `main` → Vercel auto-deploy (productie).

## Verdere context
Uitgebreide feature-historie staat in het projectgeheugen onder
`~/.claude/projects/-Users-macbook2025taco-sportcoach-AI/memory/`.
