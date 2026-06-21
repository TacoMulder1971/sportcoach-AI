'use client';

import { NewsItem, NewsCategory } from '@/lib/types';

interface NewsPanelProps {
  items: NewsItem[];
  summary?: string;
  newsEnabled: boolean;
}

const CAT_LABEL: Record<NewsCategory, string> = {
  aex: 'AEX',
  nl: 'NL',
  intl: 'Intl',
};

const CAT_COLOR: Record<NewsCategory, string> = {
  aex: 'bg-blue-100 text-blue-700',
  nl: 'bg-emerald-100 text-emerald-700',
  intl: 'bg-purple-100 text-purple-700',
};

function relativeTime(iso: string): string {
  if (!iso) return '';
  const diffMs = Date.now() - Date.parse(iso);
  if (Number.isNaN(diffMs)) return '';
  const mins = Math.round(diffMs / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min geleden`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} uur geleden`;
  const days = Math.round(hrs / 24);
  return `${days} d geleden`;
}

export default function NewsPanel({ items, summary, newsEnabled }: NewsPanelProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 text-center text-sm text-gray-400">
        Geen nieuws beschikbaar.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Nieuws</h2>
        {!newsEnabled && (
          <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] text-gray-500">
            sentiment uit (geen API-key)
          </span>
        )}
      </div>

      {summary && newsEnabled && (
        <p className="mb-3 rounded-lg bg-gray-50 p-2 text-xs italic text-gray-600">
          AI-samenvatting: {summary}
        </p>
      )}

      <ul className="space-y-2.5">
        {items.slice(0, 12).map((item, i) => (
          <li key={`${item.link}-${i}`} className="border-b border-gray-100 pb-2.5 last:border-0 last:pb-0">
            <a
              href={item.link || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-gray-800 hover:text-blue-600"
            >
              {item.title}
            </a>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-400">
              <span className={`rounded px-1.5 py-0.5 ${CAT_COLOR[item.category]}`}>
                {CAT_LABEL[item.category]}
              </span>
              <span>{item.source}</span>
              {item.pubDate && <span>· {relativeTime(item.pubDate)}</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
