import { NextResponse } from 'next/server';
import { fetchAexHistory } from '@/lib/fetch-aex';
import { computeRisk, scoreToLevel } from '@/lib/risk';
import { fetchNews } from '@/lib/news';
import { analyzeNews } from '@/lib/news-sentiment';
import { NewsItem, RiskSignal } from '@/lib/types';

// Externe fetches (koers + meerdere RSS-feeds) + een Haiku-call kunnen >10s duren.
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Koers en nieuws parallel; nieuws mag falen zonder de koers te blokkeren.
    const [priceRes, newsRes] = await Promise.allSettled([fetchAexHistory(), fetchNews()]);

    if (priceRes.status !== 'fulfilled') {
      throw priceRes.reason;
    }
    const { points, source } = priceRes.value;
    const newsItems: NewsItem[] = newsRes.status === 'fulfilled' ? newsRes.value : [];

    // AI-sentiment alleen als er een key is én er koppen zijn; anders price-only.
    let newsSignal: RiskSignal | undefined;
    let newsSummary: string | undefined;
    let newsEnabled = false;
    if (newsItems.length > 0) {
      const sentiment = await analyzeNews(newsItems);
      if (sentiment) {
        newsSignal = {
          key: 'news',
          label: 'Nieuws-sentiment (AI)',
          value: sentiment.label,
          score: sentiment.score,
          level: scoreToLevel(sentiment.score),
          explanation: sentiment.summary || 'Sentiment uit recente koppen.',
        };
        newsSummary = sentiment.summary;
        newsEnabled = true;
      }
    }

    const risk = computeRisk(points, source, newsSignal);
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
