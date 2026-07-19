import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { AthleteProfilePayload, buildAthleteProfileText } from '@/lib/athlete';

// Sonnet redeneert op dagniveau (zoals adjust-day) — trainingsinhoud, geen pure opmaak.
export const maxDuration = 30;

interface SessionInput {
  sport: string;
  type: string;
  durationMinutes?: number;
  zone?: string;
  description: string;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY niet geconfigureerd' }, { status: 500 });
    }

    const { sessions, hrZoneText, athleteProfile } = (await request.json()) as {
      sessions: SessionInput[];
      hrZoneText?: string;
      athleteProfile?: AthleteProfilePayload;
    };
    const profileText = buildAthleteProfileText(athleteProfile ?? null);

    if (!sessions || !Array.isArray(sessions) || sessions.length === 0) {
      return NextResponse.json({ error: 'Geen sessies opgegeven' }, { status: 400 });
    }

    const sessionList = sessions
      .map(
        (s, i) =>
          `Sessie ${i + 1}: sport=${s.sport}, type=${s.type}, duur=${s.durationMinutes ?? '?'}min, hoofdzone=${s.zone ?? '?'}, omschrijving="${s.description}"`
      )
      .join('\n');

    const prompt = `Je bent een ervaren duursport-coach. Werk voor ELKE onderstaande trainingssessie een gedetailleerd uitvoeringsplan uit dat de atleet direct kan overnemen (bijv. in een Garmin-horloge).

${profileText ? `${profileText}\n\n` : ''}${hrZoneText ? `HARTSLAGZONES (gebruik uitsluitend deze zone-codes Z1–Z5):\n${hrZoneText}\n\n` : ''}SESSIES VAN VANDAAG:
${sessionList}

Splits elke sessie op in opeenvolgende segmenten:
1. Een warming-up (kind "warmup").
2. Eén of meer hoofdblokken (kind "block"). Bij intervaltraining: één segment per type blok, met het aantal herhalingen in "detail" (bijv. "6× 3min Z4 / 2min Z1 dribbelen").
3. Een cooldown (kind "cooldown").

REGELS:
- De som van de minuten per sessie moet ongeveer gelijk zijn aan de opgegeven duur.
- BRICK: is een loopsessie een brick (type/omschrijving "brick", direct na een fietssessie op dezelfde dag)? Dan GEEN warming-up-segment — de atleet komt warm van de fiets en start direct in de doelzone. Benoem in het eerste hoofdblok dat de benen de eerste minuten zwaar aanvoelen en dat de pas kort en snel moet blijven.
- Kies per segment een passende hartslagzone (Z1–Z5). Warming-up/cooldown meestal Z1–Z2; hoofdblokken volgens het sessietype en de opgegeven hoofdzone.
- "detail": concreet en kort, in het Nederlands (wat doe je, intensiteit, eventuele herhalingen).
- "technique": één korte techniekfocus passend bij de sport (optioneel — laat weg als niet relevant). Bijv. hardlopen: cadans/landing; zwemmen: catch/rotatie; fietsen: souplesse/trapfrequentie.
- Verzin GEEN exacte bpm-, watt- of tempowaarden. Gebruik alleen de zone-codes (Z1–Z5).
- Alles in het Nederlands.

Antwoord met UITSLUITEND geldige JSON, exact dit formaat (de array "breakdowns" is uitgelijnd op de sessievolgorde):
{
  "breakdowns": [
    {
      "segments": [
        { "kind": "warmup", "label": "Warming-up", "minutes": 10, "zone": "Z2", "detail": "Rustig inlopen, opbouwend.", "technique": "Hoge cadans, lichte landing." }
      ]
    }
  ]
}`;

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) throw new Error('Geen JSON in antwoord');
    const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1));

    if (!parsed.breakdowns || !Array.isArray(parsed.breakdowns)) {
      throw new Error('Ongeldig JSON-formaat');
    }

    return NextResponse.json({ breakdowns: parsed.breakdowns });
  } catch (error) {
    console.error('Session breakdown API error:', error);
    return NextResponse.json({ error: 'Kon trainingsdetails niet genereren' }, { status: 500 });
  }
}
