# AEX Risico-indicator

Een op zichzelf staande Next.js PWA die dagelijks het **beurs-stress/crash-risico** op de AEX
inschat, zodat je zelf op tijd een verkoopoptie kunt overwegen.

> **Geen voorspelling, geen financieel advies.** Dit is een indicator op basis van publieke
> koersdata. De app handelt niet automatisch en heeft geen broker-koppeling. Beslis altijd zelf.

## Hoe het werkt
- **Data:** publieke dagkoersen van de AEX via **Stooq** (CSV, geen API-key), met **Yahoo Finance**
  als fallback. Zie `lib/fetch-aex.ts`.
- **Indicatoren** (`lib/risk.ts`), elk een deelscore 0..1:
  1. **Drawdown** t.o.v. de 1-jaars top.
  2. **Trend** — koers vs. SMA50/SMA200 (death cross).
  3. **Beweeglijkheid** — geannualiseerde realized volatility (20 dagen).
  4. **Momentum** — RSI(14) + 5-daags rendement.
  5. **Angstindex** — VSTOXX (Europees, met VIX als fallback): hard, voorwaarts kijkend
     volatiliteitssignaal. Zie `lib/fetch-fear.ts`.
  6. **Nieuws-sentiment (AI, optioneel)** — Claude leest recente koppen en scoort de markt-stress.
  De aanwezige signalen worden **gewogen en hernormaliseerd** → composietscore (0–100) →
  niveau **laag / verhoogd / hoog**. Ontbreekt een bron, dan tellen de overige zwaarder.
- **Nieuws** (`lib/news.ts`): RSS-feeds in drie categorieën (AEX-specifiek, NL financieel,
  internationaal), parallel opgehaald met per-feed graceful failure. De feed-lijst (`FEEDS`) is
  makkelijk aan te passen. De koppen worden ook als context-paneel getoond.
- **UI:** dagbericht-regel, risico-gauge met uitklapbare signalen, AEX-grafiek met SMA200,
  nieuws-paneel, en bij hoog risico een call-to-action. Resultaat wordt 1× per dag gecachet
  (localStorage).

## API-key (nieuws-sentiment)
Het AI-sentiment gebruikt **Claude (Haiku)** en vereist een **`ANTHROPIC_API_KEY`**:
- **Zonder key** werkt de app volledig op koersdata (price-only) + toont het de koppen; het
  AI-signaal wordt dan overgeslagen (geen fouten).
- **Met key** weegt het nieuws-sentiment mee (bescheiden gewicht ~0,20). Zet de key op Vercel als
  environment variable `ANTHROPIC_API_KEY`, of lokaal in `.env.local`.

## Lokaal draaien
```bash
npm install
npm run dev      # http://localhost:3000
```
Sanity-check vóór deploy:
```bash
npx tsc --noEmit
npm run build
```

## Naar een eigen repo + Vercel
Deze map (`aex-risk/`) is volledig zelfstandig en staat los van de SportCoach-code.
1. Kopieer de inhoud van `aex-risk/` naar een **nieuwe, lege repo**.
2. Koppel die repo aan een **nieuw Vercel-project**.
3. (Optioneel) zet `ANTHROPIC_API_KEY` als environment variable voor het nieuws-sentiment.
4. Push naar `main` → Vercel auto-deploy.

## Bewust buiten scope
- Automatische handel / broker-koppeling.
- Echte PWA-push-notificaties (kan later toegevoegd via service worker + push).
- Per-artikel volledige tekstanalyse (alleen koppen worden beoordeeld).
