// Haalt AEX-slotkoersen op uit publieke, key-loze bronnen.
// Primair Stooq (CSV), fallback Yahoo Finance (JSON).

import { PricePoint } from './types';

// Stooq: dagelijkse OHLC als CSV, geen API-key.
// Kolommen: Date,Open,High,Low,Close,Volume
async function fetchStooq(): Promise<PricePoint[]> {
  const url = 'https://stooq.com/q/d/l/?s=^aex&i=d';
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Stooq HTTP ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split('\n');
  if (lines.length < 2 || !lines[0].toLowerCase().startsWith('date')) {
    throw new Error('Stooq: onverwacht CSV-formaat');
  }
  const points: PricePoint[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < 5) continue;
    const date = cols[0];
    const close = parseFloat(cols[4]);
    if (!date || Number.isNaN(close)) continue;
    points.push({ date, close });
  }
  if (points.length < 30) throw new Error('Stooq: te weinig datapunten');
  return points;
}

// Yahoo Finance chart-endpoint (fallback). Geen API-key, JSON.
async function fetchYahoo(): Promise<PricePoint[]> {
  const url =
    'https://query1.finance.yahoo.com/v8/finance/chart/%5EAEX?range=2y&interval=1d';
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  const timestamps: number[] = result?.timestamp ?? [];
  const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? [];
  if (!timestamps.length || !closes.length) {
    throw new Error('Yahoo: lege dataset');
  }
  const points: PricePoint[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const c = closes[i];
    if (c == null || Number.isNaN(c)) continue;
    const date = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
    points.push({ date, close: c });
  }
  if (points.length < 30) throw new Error('Yahoo: te weinig datapunten');
  return points;
}

export interface AexData {
  points: PricePoint[];
  source: 'stooq' | 'yahoo';
}

// Probeer Stooq, val terug op Yahoo. Gooit als beide falen.
export async function fetchAexHistory(): Promise<AexData> {
  try {
    const points = await fetchStooq();
    return { points, source: 'stooq' };
  } catch (stooqErr) {
    console.error('Stooq mislukt, val terug op Yahoo:', stooqErr);
    const points = await fetchYahoo();
    return { points, source: 'yahoo' };
  }
}
