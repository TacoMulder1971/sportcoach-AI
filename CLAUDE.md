# CLAUDE.md

Richtlijnen voor het werken in deze codebase. Lees dit voordat je wijzigingen maakt.

## Wat is dit
SportCoach AI — een Nederlandstalige AI-sportcoach-webapp (Next.js, PWA) voor één atleet (Taco). Integreert Garmin-data, dagelijkse check-ins, AI-coach chat (Claude), weekrapporten, MyFitnessPal-voeding, materiaal-tracking, multisport en een wedstrijd-dashboard (tabblad "Races").

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
- **AI-modellen:** Haiku voor snelle feedback, Sonnet voor coach-chat (zie `src/app/api/*`).
- **Navigatie:** tab-layout in `src/components/Navigation.tsx`.
- **Pure logica** in `src/lib/*` (bijv. `equipment.ts`, `swim.ts`, `training-load.ts`, `periodization.ts`, `races.ts`), UI in `src/components/*`.

## Belangrijke domeinkennis
- **Trends:** wandelen telt NIET mee in hardloop-trends (exacte match `sport === 'hardlopen'`). Stadsfiets-ritten tellen niet mee in trainingsstatistieken (`filterStatsActivities` in `equipment.ts`).
- **Materiaal:** fiets-types `racefiets | mountainbike | stadsfiets` + `hardloopschoenen`. Stadsfiets heeft bewust geen onderhoud. Legacy `'fiets'` wordt gemigreerd naar `racefiets`.
- **Zwemmen:** varianten binnen/buiten/openwater per activiteit.
- **Multisport (triatlon/duatlon/brick):** Garmin slaat dit op als **parent met child-activiteiten**. De disciplines zitten NIET in `/splits`, maar in `metadataDTO.childIds` → per child `activityTypeDTO.typeKey` + `summaryDTO`. Zie `src/app/api/garmin/sync/route.ts`.
- **Wedstrijden (tabblad "Races", `/wedstrijden`):** races komen uit het **Doelen-systeem** (geen aparte opslag); `src/lib/races.ts` koppelt elk `Goal` aan de Garmin-activiteit van ±1 dag voor echte splits/pace/HR. Weer via `src/app/api/weather/route.ts` (Open-Meteo, geen API-key), gecached per goalId.
- **Activiteiten-archief:** de Garmin-sync overschrijft de live-data, dus voor historische trends (bijv. de aanloop naar een wedstrijd) is er een **groeiend archief** in `storage.ts` (`ACTIVITY_ARCHIVE` + `HEALTH_ARCHIVE`, dedup). De sync haalt nu 150 activiteiten op; beide sync-handlers (`page.tsx`, `data/page.tsx`) mergen álles in het archief en trimmen de live-weergave tot 40.

## Git
- Commit/push alleen als de gebruiker erom vraagt.
- Branch eerst als je op `main` zit (tenzij de gebruiker direct-op-main vraagt).
- Verifieer met `npx tsc --noEmit` + `npm run build` vóór een push.

## Verdere context
Uitgebreide feature-historie staat in het projectgeheugen onder
`~/.claude/projects/-Users-macbook2025taco-sportcoach-AI/memory/`.
