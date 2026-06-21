// Gedeelde, key-loze fetch-helpers voor slotkoersen van een willekeurig symbool.
// Stooq (CSV) met Yahoo (JSON) als fallback.

const TIMEOUT_MS = 7000;

export async function withTimeout(
  url: string,
  headers?: Record<string, string>,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { cache: 'no-store', signal: controller.signal, headers });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchStooqCloses(symbol: string): Promise<number[]> {
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

export async function fetchYahooCloses(symbol: string, range = '1y'): Promise<number[]> {
  const res = await withTimeout(
    `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=1d`,
    { 'User-Agent': 'Mozilla/5.0' },
  );
  if (!res.ok) throw new Error(`Yahoo ${symbol} HTTP ${res.status}`);
  const json = await res.json();
  const closes: (number | null)[] = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
  const clean = closes.filter((c): c is number => c != null && !Number.isNaN(c));
  if (clean.length < 1) throw new Error(`Yahoo ${symbol}: leeg`);
  return clean;
}

// Probeer Stooq, val terug op Yahoo. Gooit als beide falen.
export async function fetchCloses(stooqSym: string, yahooSym: string, range = '1y'): Promise<number[]> {
  try {
    return await fetchStooqCloses(stooqSym);
  } catch (err) {
    console.error(`Stooq ${stooqSym} mislukt, val terug op Yahoo:`, err);
    return await fetchYahooCloses(yahooSym, range);
  }
}
