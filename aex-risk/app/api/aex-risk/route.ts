import { NextResponse } from 'next/server';
import { fetchAexHistory } from '@/lib/fetch-aex';
import { fetchFearIndex } from '@/lib/fetch-fear';
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
    // Koers, angstindex en nieuws parallel; alleen de koers is hard vereist.
    const [priceRes, fearRes, newsRes] = await Promise.allSettled([
      fetchAexHistory(),
      fetchFearIndex(),
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
