// Haalt een volatiliteits-/angstindex op als hard, voorwaarts kijkend signaal.
// Voorkeur: VSTOXX (Europese variant, dichtst bij de AEX); valt terug op VIX.
// Per bron Stooq (CSV) -> Yahoo (JSON). Alles key-loos.

export interface FearIndex {
  name: string; // 'VSTOXX' of 'VIX'
  value: number; // laatste slotwaarde
  changePercent: number; // % t.o.v. vorige dag
}

// Kandidaten in volgorde van voorkeur. Werkt een symbool/bron niet,
// dan schuift hij door naar de volgende — VIX is de betrouwbare vangnet.
const CANDIDATES = [
  { name: 'VSTOXX', stooq: '^vstx', yahoo: '%5EV2TX' },
  { name: 'VIX', stooq: '^vix', yahoo: '%5EVIX' },
];

const TIMEOUT_MS = 7000;

function lastTwo(values: number[]): { value: number; prev: number } | null {
  const clean = values.filter((v) => Number.isFinite(v));
  if (clean.length < 1) return null;
  const value = clean[clean.length - 1];
  const prev = clean.length >= 2 ? clean[clean.length - 2] : value;
  return { value, prev };
}

async function withTimeout(url: string, headers?: Record<string, string>): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { cache: 'no-store', signal: controller.signal, headers });
  } finally {
    clearTimeout(timer);
  }
}

async function fromStooq(symbol: string): Promise<number[]> {
  const res = await withTimeout(`https://stooq.com/q/d/l/?s=${symbol}&i=d`);
  if (!res.ok) throw new Error(`Stooq ${symbol} HTTP ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split('\n');
  if (lines.length < 2 || !lines[0].toLowerCase().startsWith('date')) {
    throw new Error(`Stooq ${symbol}: onverwacht formaat`);
  }
  const closes: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = parseFloat(lines[i].split(',')[4]);
    if (!Number.isNaN(c)) closes.push(c);
  }
  if (closes.length < 1) throw new Error(`Stooq ${symbol}: leeg`);
  return closes;
}

async function fromYahoo(symbol: string): Promise<number[]> {
  const res = await withTimeout(
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=3mo&interval=1d`,
    { 'User-Agent': 'Mozilla/5.0' },
  );
  if (!res.ok) throw new Error(`Yahoo ${symbol} HTTP ${res.status}`);
  const json = await res.json();
  const closes: (number | null)[] = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
  const clean = closes.filter((c): c is number => c != null && !Number.isNaN(c));
  if (clean.length < 1) throw new Error(`Yahoo ${symbol}: leeg`);
  return clean;
}

// Probeert elke kandidaat (Stooq dan Yahoo) tot er één lukt. Null als alles faalt.
export async function fetchFearIndex(): Promise<FearIndex | null> {
  for (const c of CANDIDATES) {
    for (const loader of [() => fromStooq(c.stooq), () => fromYahoo(c.yahoo)]) {
      try {
        const pair = lastTwo(await loader());
        if (!pair) continue;
        const changePercent = pair.prev ? ((pair.value - pair.prev) / pair.prev) * 100 : 0;
        return {
          name: c.name,
          value: Number(pair.value.toFixed(2)),
          changePercent: Number(changePercent.toFixed(1)),
        };
      } catch (err) {
        console.error('Angstindex-bron mislukt:', err);
      }
    }
  }
  return null;
}
