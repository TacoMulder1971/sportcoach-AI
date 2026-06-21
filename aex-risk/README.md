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
  Gewogen som → composietscore (0–100) → niveau **laag / verhoogd / hoog**.
- **UI:** dagbericht-regel, risico-gauge met uitklapbare signalen, AEX-grafiek met SMA200,
  en bij hoog risico een call-to-action. Resultaat wordt 1× per dag gecachet (localStorage).

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
3. Push naar `main` → Vercel auto-deploy. Geen environment variables nodig.

## Bewust buiten scope
- Automatische handel / broker-koppeling.
- Echte PWA-push-notificaties (kan later toegevoegd via service worker + push).
- AI-gegenereerde tekst (het dagbericht is rule-based, dus key-loos).
