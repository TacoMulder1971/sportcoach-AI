import { NextResponse } from 'next/server';
import { fetchAexHistory } from '@/lib/fetch-aex';
import { fetchFearIndex } from '@/lib/fetch-fear';
import { fetchYieldSpread, fetchGlobalIndices } from '@/lib/fetch-extra';
import { computeRisk, scoreToLevel } from '@/lib/risk';
import { fetchNews } from '@/lib/news';
import { analyzeNews } from '@/lib/news-sentiment';
import { NewsItem, RiskSignal } from '@/lib/types';

// Externe fetches (koers + angstindex + meerdere RSS-feeds) + een Haiku-call
// kunnen >10s duren.
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export async function GET() {
  try {
    // Koers, angstindex, rentecurve, indices en nieuws parallel;
    // alleen de koers is hard vereist.
    const [priceRes, fearRes, yieldRes, indicesRes, newsRes] = await Promise.allSettled([
      fetchAexHistory(),
      fetchFearIndex(),
      fetchYieldSpread(),
      fetchGlobalIndices(),
      fetchNews(),
    ]);

    if (priceRes.status !== 'fulfilled') {
      throw priceRes.reason;
    }
    const { points, source } = priceRes.value;
    const newsItems: NewsItem[] = newsRes.status === 'fulfilled' ? newsRes.value : [];

    const extraSignals: RiskSignal[] = [];

    // Angst-signaal (VIX/VSTOXX): rustig <15, paniek >40.
    if (fearRes.status === 'fulfilled' && fearRes.value) {
      const f = fearRes.value;
      const score = clamp01((f.value - 15) / (40 - 15));
      extraSignals.push({
        key: 'fear',
        label: `Angstindex (${f.name})`,
        value: `${f.value} (${f.changePercent > 0 ? '+' : ''}${f.changePercent}%)`,
        score,
        level: scoreToLevel(score),
        explanation:
          score < 0.33
            ? 'Lage volatiliteitsverwachting — markt is rustig.'
            : score < 0.66
              ? 'Verhoogde volatiliteitsverwachting — onrust neemt toe.'
              : 'Hoge angstindex — markt prijst paniek/sterke daling in.',
      });
    }

    // Rentecurve (10j-2j): +0,5 of meer = gezond, -0,5 of lager = sterk omgekeerd.
    if (yieldRes.status === 'fulfilled' && yieldRes.value !== null) {
      const spread = yieldRes.value;
      const score = clamp01((0.5 - spread) / 1.0);
      extraSignals.push({
        key: 'yield',
        label: 'Rentecurve (10j–2j)',
        value: `${spread > 0 ? '+' : ''}${spread.toFixed(2)}%`,
        score,
        level: scoreToLevel(score),
        explanation:
          spread < 0
            ? 'Rentecurve omgekeerd — klassiek recessiesignaal.'
            : spread < 0.5
              ? 'Rentecurve vlak — voorzichtigheid geboden.'
              : 'Rentecurve normaal/positief — gezond.',
      });
    }

    // Breadth: gemiddelde stress van S&P 500 + Euro Stoxx 50.
    if (indicesRes.status === 'fulfilled' && indicesRes.value.length > 0) {
      const idx = indicesRes.value;
      const stresses = idx.map((s) => {
        const ddScore = clamp01(-Math.min(0, s.drawdownPercent) / 20);
        const weekScore = clamp01(-Math.min(0, s.weekChangePercent) / 8);
        return 0.5 * ddScore + 0.5 * weekScore;
      });
      const score = stresses.reduce((a, b) => a + b, 0) / stresses.length;
      const avgWeek = idx.reduce((a, s) => a + s.weekChangePercent, 0) / idx.length;
      extraSignals.push({
        key: 'breadth',
        label: 'Wereldindices',
        value: `${idx.map((s) => s.name.split(' ')[0]).join('/')} ${avgWeek > 0 ? '+' : ''}${avgWeek.toFixed(1)}%/wk`,
        score,
        level: scoreToLevel(score),
        explanation:
          score < 0.33
            ? 'Wereldwijde beurzen stabiel — geen brede stress.'
            : score < 0.66
              ? 'Ook elders druk op de beurzen — breed signaal.'
              : 'Wereldwijde uitverkoop — brede risk-off.',
      });
    }

    // AI-sentiment alleen met key én koppen; anders price-only.
    let newsSummary: string | undefined;
    let newsEnabled = false;
    if (newsItems.length > 0) {
      const sentiment = await analyzeNews(newsItems);
      if (sentiment) {
        extraSignals.push({
          key: 'news',
          label: 'Nieuws-sentiment (AI)',
          value: sentiment.label,
          score: sentiment.score,
          level: scoreToLevel(sentiment.score),
          explanation: sentiment.summary || 'Sentiment uit recente koppen.',
        });
        newsSummary = sentiment.summary;
        newsEnabled = true;
      }
    }

    const risk = computeRisk(points, source, extraSignals);
    risk.newsItems = newsItems;
    risk.newsSummary = newsSummary;
    risk.newsEnabled = newsEnabled;

    return NextResponse.json({ risk });
  } catch (error) {
    console.error('aex-risk route error:', error);
    return NextResponse.json(
      { error: 'Kon de AEX-marktdata nu niet ophalen. Probeer het later opnieuw.' },
      { status: 502 },
    );
  }
}
