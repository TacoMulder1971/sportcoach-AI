// Centrale types voor de AEX-risico-indicator.

export type RiskLevel = 'laag' | 'verhoogd' | 'hoog';

// Eén dagkoers (slotkoers) uit de databron.
export interface PricePoint {
  date: string; // YYYY-MM-DD
  close: number;
}

// Eén berekend deelsignaal, met een score 0..1 (hoger = meer stress).
export interface RiskSignal {
  key: 'drawdown' | 'trend' | 'volatility' | 'momentum' | 'fear' | 'news';
  label: string; // NL label, bijv. "Koersdaling t.o.v. top"
  value: string; // leesbare waarde, bijv. "-8,4%"
  score: number; // 0..1
  level: RiskLevel;
  explanation: string; // korte NL uitleg
}

// Eén nieuwsbericht uit een RSS-feed.
export type NewsCategory = 'aex' | 'nl' | 'intl';

export interface NewsItem {
  title: string;
  link: string;
  source: string; // bron-naam, bijv. "NOS Economie"
  category: NewsCategory;
  pubDate: string; // ISO timestamp (of '' als onbekend)
}

// Volledig risico-resultaat dat de API teruggeeft en de UI toont.
export interface AexRisk {
  date: string; // datum van de laatste koers (YYYY-MM-DD)
  aexClose: number; // laatste slotkoers
  changeDayPercent: number; // % t.o.v. vorige dag
  changeWeekPercent: number; // % t.o.v. 5 handelsdagen terug
  riskLevel: RiskLevel; // composiet niveau
  riskScore: number; // composiet 0..100
  signals: RiskSignal[]; // deelsignalen
  message: string; // dagbericht-regel (rule-based)
  history: PricePoint[]; // recente slotkoersen voor de grafiek
  sma200: (number | null)[]; // SMA200 per history-punt (null als te weinig data)
  source: 'stooq' | 'yahoo'; // welke bron leverde de data
  newsItems: NewsItem[]; // recente koppen (context, ook zonder AI)
  newsSummary?: string; // AI-samenvatting van het nieuws-sentiment (1 zin)
  newsEnabled: boolean; // false = price-only (geen API-key of nieuws-fout)
  fetchedAt: string; // ISO timestamp
}

// Cache-wrapper voor localStorage (1x per dag).
export interface CachedRisk {
  key: string; // Amsterdam-datum YYYY-MM-DD
  risk: AexRisk;
}

export const RISK_META: Record<RiskLevel, { label: string; color: string; ring: string; text: string }> = {
  laag: { label: 'Laag risico', color: 'bg-green-500', ring: 'ring-green-500', text: 'text-green-700' },
  verhoogd: { label: 'Verhoogd risico', color: 'bg-amber-500', ring: 'ring-amber-500', text: 'text-amber-700' },
  hoog: { label: 'Hoog risico', color: 'bg-red-500', ring: 'ring-red-500', text: 'text-red-700' },
};
