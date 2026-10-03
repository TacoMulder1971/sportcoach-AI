import Anthropic from '@anthropic-ai/sdk';
import type {
  BetaMessage,
  MessageCreateParamsNonStreaming,
} from '@anthropic-ai/sdk/resources/beta/messages/messages';

/**
 * Centrale plek voor de Claude-modellen die de app gebruikt. Een modelupgrade is
 * hierdoor één regel: alle API-routes lezen hun model hier.
 *
 * - opus:   diepe redenering — coach-chat, schema-/seizoensstrategie, race-evaluatie, voedingsrapport
 * - sonnet: snel maar slim — dag aanpassen, sessie-uitsplitsing, krachtoefeningen
 * - haiku:  snel en goedkoop — dagbericht, weekrapport, voedingsfeedback, JSON-formattering
 */
export const CLAUDE_MODELS = {
  opus: 'claude-opus-5-5',
  sonnet: 'claude-sonnet-5-5',
  haiku: 'claude-haiku-4-5',
} as const;

/** Server-side fallback: bij een weigering door een veiligheidsfilter probeert de API het zelf opnieuw op een ander model. */
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

type ClaudeParams = Omit<MessageCreateParamsNonStreaming, 'betas' | 'fallbacks'>;

/**
 * Doet één Claude-call met de vangnetten die de nieuwe modellen nodig hebben:
 * - Opus/Sonnet krijgen `fallbacks: 'default'` mee, zodat een (zeldzame) foutieve
 *   weigering van een veiligheidsfilter niet als lege respons eindigt.
 * - Een weigering (`stop_reason: 'refusal'`) wordt een fout, zodat de route z'n
 *   eigen nette foutmelding geeft i.p.v. een lege tekst.
 * - Een afgekapt antwoord (`max_tokens`) wordt gelogd — thinking telt mee in dat budget.
 */
export async function createClaudeMessage(
  client: Anthropic,
  params: ClaudeParams,
): Promise<BetaMessage> {
  const withFallback = params.model !== CLAUDE_MODELS.haiku;
  const response = await client.beta.messages.create(
    withFallback ? { ...params, betas: [FALLBACK_BETA], fallbacks: 'default' } : params,
  );

  if (response.stop_reason === 'refusal') {
    const category = response.stop_details?.category ?? 'onbekend';
    throw new Error(`Claude weigerde het verzoek (categorie: ${category})`);
  }
  if (response.stop_reason === 'max_tokens') {
    console.warn(`[claude] antwoord afgekapt op max_tokens (${params.max_tokens}) — model ${response.model}`);
  }
  return response;
}

/**
 * Alle tekst uit een antwoord. Op Opus 5.5 / Sonnet 5.5 staat thinking aan en begint
 * `content` met (lege) thinking-blokken — dus nooit `content[0]` lezen.
 */
export function extractText(response: BetaMessage): string {
  return response.content
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('')
    .trim();
}
