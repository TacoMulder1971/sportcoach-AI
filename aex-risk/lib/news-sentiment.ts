// Laat Claude (Haiku) recente koppen beoordelen op markt-stress voor de AEX
// en geeft een sentiment-score 0..1 terug (hoger = meer stress/angst).
// Bij ontbrekende key of fouten -> null, zodat de app price-only doordraait.

import Anthropic from '@anthropic-ai/sdk';
import { NewsItem } from './types';

export interface NewsSentiment {
  score: number; // 0..1, hoger = meer markt-stress
  label: string; // korte NL kwalificatie
  summary: string; // 1 NL zin
}

const MODEL = 'claude-haiku-4-5-20251001';

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export async function analyzeNews(items: NewsItem[]): Promise<NewsSentiment | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || items.length === 0) return null;

  const headlines = items
    .slice(0, 25)
    .map((it, i) => `${i + 1}. [${it.source}] ${it.title}`)
    .join('\n');

  const prompt = `Je bent een beursanalist. Hieronder staan recente financiële nieuwskoppen (NL en internationaal).
Beoordeel hoeveel markt-STRESS / angst voor een koersdaling van de AEX hieruit spreekt.

Koppen:
${headlines}

Geef UITSLUITEND geldige JSON terug, exact dit formaat:
{"score": <getal 0..1>, "label": "<2-4 woorden NL>", "summary": "<1 korte NL zin>"}

- score 0 = zeer rustig/positief, 1 = paniek/crash-vrees.
- Weeg recessie, rente, geopolitiek, winstwaarschuwingen, beurspaniek zwaar; gewone bedrijfsnieuwtjes licht.
- Geen tekst buiten de JSON.`;

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as Partial<NewsSentiment>;
    if (typeof parsed.score !== 'number') return null;

    return {
      score: clamp01(parsed.score),
      label: parsed.label || 'Nieuws-sentiment',
      summary: parsed.summary || '',
    };
  } catch (err) {
    console.error('analyzeNews mislukt:', err);
    return null;
  }
}
