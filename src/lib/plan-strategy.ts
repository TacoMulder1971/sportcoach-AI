// Helpers rond de coachstrategie ("Waarom dit schema") die bij een
// gegenereerd 2-weeks schema hoort. Gedeeld door de generatie-pagina
// (/schema/nieuw) en de Schema-tab.

// Strip markdown-symbolen zodat de coachnotitie als nette platte tekst toont
export function cleanStrategyText(text: string): string {
  return text
    .replace(/^#{1,6}\s*/gm, '')   // kopjes: ## Titel → Titel
    .replace(/\*\*(.+?)\*\*/g, '$1') // **vet** → vet
    .replace(/^\s*[-*]\s+/gm, '• ')  // lijst-bullets uniform maken
    .replace(/^---+$/gm, '')         // horizontale lijnen weg
    .replace(/\n{3,}/g, '\n\n')      // overtollige lege regels
    .trim();
}

// Strategie + eventuele verfijnings-verzoeken samenvoegen tot één tekstblok
// voor AI-context (chat, adjust-day, volgende schema-generatie).
export function combineStrategyText(strategy?: string, refinements?: string[]): string {
  if (!strategy) return '';
  let text = cleanStrategyText(strategy);
  if (refinements && refinements.length > 0) {
    text += '\n\nDoor de atleet gevraagde aanpassingen op dit schema:\n';
    text += refinements.map((r) => `- ${r}`).join('\n');
  }
  return text;
}
