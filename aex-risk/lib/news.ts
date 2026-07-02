// Haalt financieel nieuws op uit publieke RSS-feeds (geen API-key) en parse't
// de XML met een lichte string-parser. Per-feed graceful failure: een kapotte
// of trage feed mag de rest niet breken.

import { NewsCategory, NewsItem } from './types';

interface FeedConfig {
  url: string;
  source: string;
  category: NewsCategory;
}

// Makkelijk uit te breiden / aan te passen. Werkt een URL niet meer,
// dan wordt die feed simpelweg overgeslagen (allSettled).
export const FEEDS: FeedConfig[] = [
  // --- AEX / Damrak specifiek ---
  { url: 'https://www.beursduivel.be/rss/Nieuws-AEX.aspx', source: 'Beursduivel AEX', category: 'aex' },
  { url: 'https://www.iex.nl/rss/beurs.aspx', source: 'IEX Beurs', category: 'aex' },
  // --- NL financieel / economie ---
  { url: 'https://feeds.nos.nl/nosnieuwseconomie', source: 'NOS Economie', category: 'nl' },
  { url: 'https://www.nu.nl/rss/economie', source: 'NU.nl Economie', category: 'nl' },
  { url: 'https://www.rtlnieuws.nl/economie/rss.xml', source: 'RTL Economie', category: 'nl' },
  // --- Internationaal ---
  { url: 'https://feeds.marketwatch.com/marketwatch/topstories/', source: 'MarketWatch', category: 'intl' },
  { url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html', source: 'CNBC Markets', category: 'intl' },
  { url: 'https://www.investing.com/rss/news_25.rss', source: 'Investing.com', category: 'intl' },
];

const FEED_TIMEOUT_MS = 7000;
const MAX_PER_FEED = 6;
const MAX_TOTAL = 25;

// Strip CDATA + HTML-entities + tags uit een RSS-tekst.
function cleanText(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTag(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? cleanText(m[1]) : '';
}

// Parse RSS 2.0 (<item>) of Atom (<entry>) naar NewsItem[].
function parseFeed(xml: string, feed: FeedConfig): NewsItem[] {
  const items: NewsItem[] = [];
  const blocks = xml.match(/<(item|entry)[\s\S]*?<\/(item|entry)>/gi) || [];
  for (const block of blocks.slice(0, MAX_PER_FEED)) {
    const title = extractTag(block, 'title');
    if (!title) continue;
    // Atom gebruikt <link href="..."/>, RSS <link>...</link>.
    let link = extractTag(block, 'link');
    if (!link) {
      const hrefMatch = block.match(/<link[^>]*href=["']([^"']+)["']/i);
      link = hrefMatch ? hrefMatch[1] : '';
    }
    const rawDate = extractTag(block, 'pubDate') || extractTag(block, 'published') || extractTag(block, 'updated');
    const parsed = rawDate ? new Date(rawDate) : null;
    const pubDate = parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : '';
    items.push({ title, link, source: feed.source, category: feed.category, pubDate });
  }
  return items;
}

async function fetchOneFeed(feed: FeedConfig): Promise<NewsItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FEED_TIMEOUT_MS);
  try {
    const res = await fetch(feed.url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AexRiskBot/1.0)' },
    });
    if (!res.ok) throw new Error(`${feed.source} HTTP ${res.status}`);
    const xml = await res.text();
    return parseFeed(xml, feed);
  } finally {
    clearTimeout(timer);
  }
}

// Haalt alle feeds parallel op, dedupe op titel, sorteer op datum (nieuwste eerst).
export async function fetchNews(): Promise<NewsItem[]> {
  const results = await Promise.allSettled(FEEDS.map(fetchOneFeed));
  const all: NewsItem[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
    else console.error('Feed mislukt:', r.reason);
  }

  // Dedupe op genormaliseerde titel.
  const seen = new Set<string>();
  const unique = all.filter((item) => {
    const key = item.title.toLowerCase().slice(0, 80);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  unique.sort((a, b) => {
    const ta = a.pubDate ? Date.parse(a.pubDate) : 0;
    const tb = b.pubDate ? Date.parse(b.pubDate) : 0;
    return tb - ta;
  });

  return unique.slice(0, MAX_TOTAL);
}
