// Extra, key-loze risicobronnen: de rentecurve (2j/10j-spread via FRED) en
// wereldwijde indices (S&P 500 + Euro Stoxx 50) als breadth-bevestiging.

import { fetchCloses, withTimeout } from './market-data';

// ---- Rentecurve (FRED: 10-jaars minus 2-jaars, in procentpunten) ----
// Negatief = "inverted" = klassiek recessie-/crashvoorspeller.
export async function fetchYieldSpread(): Promise<number | null> {
  try {
    const res = await withTimeout('https://fred.stlouisfed.org/graph/fredgraph.csv?id=T10Y2Y');
    if (!res.ok) throw new Error(`FRED HTTP ${res.status}`);
    const text = await res.text();
    const lines = text.trim().split('\n');
    // Loop van achter naar voren tot een geldige numerieke waarde ('.' = ontbreekt).
    for (let i = lines.length - 1; i >= 1; i--) {
      const v = parseFloat(lines[i].split(',')[1]);
      if (!Number.isNaN(v)) return v;
    }
    return null;
  } catch (err) {
    console.error('Rentecurve (FRED) mislukt:', err);
    return null;
  }
}

// ---- Wereldwijde indices ----
export interface IndexStress {
  name: string;
  weekChangePercent: number; // % over ~5 handelsdagen
  drawdownPercent: number; // % t.o.v. 1-jaars top (<= 0)
}

const INDICES = [
  { name: 'S&P 500', stooq: '^spx', yahoo: '%5EGSPC' },
  { name: 'Euro Stoxx 50', stooq: '^stx', yahoo: '%5ESTOXX50E' },
];

function pctChange(from: number, to: number): number {
  if (!from) return 0;
  return ((to - from) / from) * 100;
}

async function oneIndex(idx: (typeof INDICES)[number]): Promise<IndexStress> {
  const closes = await fetchCloses(idx.stooq, idx.yahoo);
  const last = closes[closes.length - 1];
  const weekAgo = closes[Math.max(0, closes.length - 6)];
  const high = Math.max(...closes.slice(Math.max(0, closes.length - 252)));
  return {
    name: idx.name,
    weekChangePercent: Number(pctChange(weekAgo, last).toFixed(2)),
    drawdownPercent: Number(Math.min(0, pctChange(high, last)).toFixed(2)),
  };
}

// Haalt de indices parallel op; een falende index wordt simpelweg overgeslagen.
export async function fetchGlobalIndices(): Promise<IndexStress[]> {
  const results = await Promise.allSettled(INDICES.map(oneIndex));
  const out: IndexStress[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') out.push(r.value);
    else console.error('Index mislukt:', r.reason);
  }
  return out;
}
