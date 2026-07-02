// Pure rekenlogica voor de AEX-risico-indicator. Geen I/O, geen React —
// alleen functies op een reeks slotkoersen. Zo makkelijk te testen/redeneren.

import { AexRisk, PricePoint, RiskLevel, RiskSignal } from './types';

// ---- Hulpfuncties ----

export function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(values.length - period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// SMA-reeks (één waarde per punt; null waar te weinig historie is).
export function smaSeries(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}

// Geannualiseerde realized volatility uit dag-rendementen (laatste `window` dagen).
export function realizedVolatility(closes: number[], window: number): number | null {
  if (closes.length < window + 1) return null;
  const slice = closes.slice(closes.length - (window + 1));
  const returns: number[] = [];
  for (let i = 1; i < slice.length; i++) {
    returns.push(Math.log(slice[i] / slice[i - 1]));
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(252); // geannualiseerd
}

// RSI(period) volgens de klassieke (Wilder-achtige, hier simpel gemiddelde) methode.
export function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  const slice = closes.slice(closes.length - (period + 1));
  let gains = 0;
  let losses = 0;
  for (let i = 1; i < slice.length; i++) {
    const diff = slice[i] - slice[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// Maximale slotkoers van de laatste `lookback` dagen.
function recentHigh(closes: number[], lookback: number): number {
  const slice = closes.slice(Math.max(0, closes.length - lookback));
  return Math.max(...slice);
}

function pctChange(from: number, to: number): number {
  if (from === 0) return 0;
  return ((to - from) / from) * 100;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export function scoreToLevel(score: number): RiskLevel {
  if (score >= 0.66) return 'hoog';
  if (score >= 0.33) return 'verhoogd';
  return 'laag';
}

function fmtPct(p: number): string {
  const sign = p > 0 ? '+' : '';
  return `${sign}${p.toFixed(1).replace('.', ',')}%`;
}

// ---- Hoofdberekening ----

// Relatieve gewichten per signaal. Alleen de AANWEZIGE signalen tellen mee en de
// gewichten worden hernormaliseerd, zodat elke combinatie (met/zonder angstindex
// of nieuws) klopt. Nieuws krijgt bewust een bescheiden gewicht (ruis); de
// angstindex (VIX/VSTOXX) is een hard, voorwaarts kijkend signaal.
const BASE_WEIGHTS: Record<RiskSignal['key'], number> = {
  drawdown: 0.2,
  trend: 0.15,
  volatility: 0.12,
  momentum: 0.1,
  fear: 0.13,
  yield: 0.12,
  breadth: 0.1,
  news: 0.08,
};

export function computeRisk(
  points: PricePoint[],
  source: 'stooq' | 'yahoo',
  extraSignals: RiskSignal[] = [],
): AexRisk {
  if (points.length < 2) {
    throw new Error('Te weinig koersdata om risico te berekenen');
  }

  const closes = points.map((p) => p.close);
  const last = closes[closes.length - 1];
  const prev = closes[closes.length - 2];
  const weekAgo = closes[Math.max(0, closes.length - 6)];

  const signals: RiskSignal[] = [];

  // 1) Drawdown t.o.v. 1-jaars top (~252 handelsdagen).
  const high = recentHigh(closes, 252);
  const drawdown = pctChange(high, last); // negatief getal
  const ddMag = Math.abs(Math.min(0, drawdown)); // 0..∞
  // 0% -> 0 ; 20% daling -> 1
  const ddScore = clamp01(ddMag / 20);
  signals.push({
    key: 'drawdown',
    label: 'Koersdaling t.o.v. jaartop',
    value: fmtPct(Math.min(0, drawdown)),
    score: ddScore,
    level: scoreToLevel(ddScore),
    explanation:
      ddMag < 5
        ? 'Koers vlak bij de jaartop — weinig stress.'
        : ddMag < 10
          ? 'Lichte terugval vanaf de top.'
          : ddMag < 20
            ? 'Stevige correctie gaande.'
            : 'Diepe daling vanaf de top.',
  });

  // 2) Trend: SMA50 vs SMA200 + koers t.o.v. SMA200 (death cross).
  const sma50 = sma(closes, 50);
  const sma200 = sma(closes, 200);
  let trendScore = 0.5;
  let trendValue = 'onbekend';
  let trendExpl = 'Niet genoeg historie voor een trend.';
  if (sma50 !== null && sma200 !== null) {
    const belowLong = last < sma200;
    const deathCross = sma50 < sma200;
    trendScore = (belowLong ? 0.5 : 0) + (deathCross ? 0.5 : 0);
    trendValue = `${last < sma200 ? 'onder' : 'boven'} SMA200`;
    trendExpl = deathCross
      ? 'SMA50 onder SMA200 (death cross) — bearish trend.'
      : belowLong
        ? 'Koers onder het 200-daags gemiddelde — voorzichtig.'
        : 'Koers boven de lange gemiddelden — gezonde trend.';
  }
  signals.push({
    key: 'trend',
    label: 'Trend (50/200-daags)',
    value: trendValue,
    score: trendScore,
    level: scoreToLevel(trendScore),
    explanation: trendExpl,
  });

  // 3) Volatility: realized vol (20d). Rustig ~12%, stress >35%.
  const vol = realizedVolatility(closes, 20);
  let volScore = 0;
  let volValue = 'onbekend';
  let volExpl = 'Niet genoeg historie.';
  if (vol !== null) {
    const volPct = vol * 100;
    // 12% -> 0 ; 35% -> 1
    volScore = clamp01((volPct - 12) / (35 - 12));
    volValue = `${volPct.toFixed(0)}%`;
    volExpl =
      volScore < 0.33
        ? 'Rustige markt, lage beweeglijkheid.'
        : volScore < 0.66
          ? 'Beweeglijkheid neemt toe.'
          : 'Hoge beweeglijkheid — typisch bij paniek.';
  }
  signals.push({
    key: 'volatility',
    label: 'Beweeglijkheid (20d)',
    value: volValue,
    score: volScore,
    level: scoreToLevel(volScore),
    explanation: volExpl,
  });

  // 4) Momentum: RSI(14) laag + snelle 5-daagse daling.
  const r = rsi(closes, 14);
  const week = pctChange(weekAgo, last);
  let momScore = 0;
  let momValue = 'onbekend';
  let momExpl = 'Niet genoeg historie.';
  if (r !== null) {
    // RSI 50 -> 0 ; RSI 20 -> 1 (oversold = stress/uitverkoop)
    const rsiScore = clamp01((50 - r) / (50 - 20));
    // 5-daagse daling: 0% -> 0 ; -8% -> 1
    const dropScore = clamp01(-Math.min(0, week) / 8);
    momScore = clamp01(0.6 * rsiScore + 0.4 * dropScore);
    momValue = `RSI ${r.toFixed(0)} · ${fmtPct(week)}/wk`;
    momExpl =
      momScore < 0.33
        ? 'Geen uitgesproken neerwaarts momentum.'
        : momScore < 0.66
          ? 'Toenemende verkoopdruk.'
          : 'Sterke neerwaartse druk / uitverkoop.';
  }
  signals.push({
    key: 'momentum',
    label: 'Momentum (RSI + week)',
    value: momValue,
    score: momScore,
    level: scoreToLevel(momScore),
    explanation: momExpl,
  });

  // Voeg extra signalen toe (angstindex en/of nieuws, indien aanwezig).
  signals.push(...extraSignals);

  // Hernormaliseer de gewichten over de aanwezige signalen.
  const totalWeight = signals.reduce((acc, s) => acc + (BASE_WEIGHTS[s.key] ?? 0), 0) || 1;

  // Composietscore (0..1) -> 0..100.
  const composite =
    signals.reduce((acc, s) => acc + s.score * (BASE_WEIGHTS[s.key] ?? 0), 0) / totalWeight;
  const riskScore = Math.round(composite * 100);
  const riskLevel = scoreToLevel(composite);

  return {
    date: points[points.length - 1].date,
    aexClose: Number(last.toFixed(2)),
    changeDayPercent: Number(pctChange(prev, last).toFixed(2)),
    changeWeekPercent: Number(week.toFixed(2)),
    riskLevel,
    riskScore,
    signals,
    message: buildMessage(riskLevel, riskScore, signals),
    history: points.slice(Math.max(0, points.length - 260)),
    sma200: smaSeries(closes, 200).slice(Math.max(0, closes.length - 260)),
    source,
    newsItems: [],
    newsEnabled: false,
    fetchedAt: new Date().toISOString(),
  };
}

// Rule-based dagbericht (geen AI-key nodig).
export function buildMessage(level: RiskLevel, score: number, signals: RiskSignal[]): string {
  const top = [...signals].sort((a, b) => b.score - a.score)[0];
  if (level === 'hoog') {
    return `Hoog risico (${score}/100). Belangrijkste signaal: ${top.label.toLowerCase()}. Overweeg je verkoopoptie te checken — beslis zelf.`;
  }
  if (level === 'verhoogd') {
    return `Verhoogd risico (${score}/100). Let op: ${top.label.toLowerCase()}. Houd de markt deze week in de gaten.`;
  }
  return `Laag risico (${score}/100). De AEX oogt stabiel; geen actie nodig.`;
}
