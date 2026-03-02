import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `Je bent TriCoach AI, een persoonlijke trainingscoach voor triatlon. Je spreekt Nederlands.

ATLEET PROFIEL:
- Traint voor een 1/4 triatlon op 13 juni 2026
- Doel: onder de 3 uur finishen
- Max hartslag: 172 bpm
- Hartslagzones: Z1 (103-120), Z2 (121-137), Z3 (138-151), Z4 (152-163)

TRAININGSSCHEMA (2-weekse cyclus):
Week 1:
- Ma: Zwemmen techniek (45min Z2) + Fietsen herstel (45min Z1)
- Di: Hardlopen interval (50min Z3) - 6x 800m met 2 min rust
- Wo: Rust
- Do: Hardlopen duur (60min Z2)
- Vr: Zwemmen tempo/techniek (45min Z3)
- Za: Hardlopen rustig (45min Z1)
- Zo: Fietsen lang (90-120min Z2) + Brick run (20-30min Z2)

Week 2:
- Ma: Zwemmen techniek (45min Z2) + Fietsen herstel (45min Z1)
- Di: Hardlopen tempo (50min Z3)
- Wo: Rust
- Do: Hardlopen duur (65min Z2)
- Vr: Zwemmen duur (50min Z2)
- Za: Mountainbike (60min Z2)
- Zo: Zwemmen (40min Z2) + Hardlopen duur (50min Z2)

JE TAKEN:
1. Geef concreet, praktisch trainingsadvies
2. Pas het schema aan als de atleet moe is, slecht slaapt, of zich niet goed voelt
3. Stel verdiepende vragen als informatie onduidelijk is
4. Geef motiverende berichten afgestemd op de fase in de training
5. Herken brick-sessies (fietsen direct gevolgd door lopen)
6. Let op periodisering: opbouw-, piek- en taperfase
7. Wees kort en to-the-point, maar warm en motiverend
8. Als de atleet check-in data deelt, gebruik die om je advies aan te passen

STIJL:
- Spreek de atleet informeel aan (je/jij)
- Gebruik concrete tijden, afstanden en zones
- Geef maximaal 1-2 alinea's antwoord tenzij meer detail gevraagd wordt
- Gebruik geen emojis in lopende tekst, alleen aan het begin van een bericht als het past`;

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY niet geconfigureerd' },
        { status: 500 }
      );
    }

    const { messages, checkIns } = await request.json();

    // Add current date/time context
    const now = new Date();
    const days = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];
    const dateStr = now.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
    const dayName = days[now.getDay()];

    // Determine current week in cycle
    const startDate = new Date('2026-02-23');
    const diffDays = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const weekNum = Math.floor(diffDays / 7) % 2 === 0 ? 1 : 2;

    const daysUntilRace = Math.ceil((new Date('2026-06-13').getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    let contextMessage = `\n\nHUIDIGE CONTEXT:\n- Datum: ${dayName} ${dateStr}\n- Tijd: ${timeStr}\n- Week in cyclus: Week ${weekNum}\n- Dagen tot wedstrijd: ${daysUntilRace}\n`;

    // Build context with check-in data
    if (checkIns && checkIns.length > 0) {
      contextMessage += '\nRECENTE CHECK-INS VAN DE ATLEET:\n';
      for (const ci of checkIns) {
        contextMessage += `- ${ci.date} (${ci.trainingDay}): Gevoel ${ci.feeling}/5`;
        if (ci.note) contextMessage += ` - "${ci.note}"`;
        contextMessage += '\n';
      }
    }

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT + contextMessage,
      messages: messages.slice(-20), // Keep last 20 messages for context
    });

    const content =
      response.content[0].type === 'text' ? response.content[0].text : '';

    return NextResponse.json({ content });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Er ging iets mis met de AI coach' },
      { status: 500 }
    );
  }
}
