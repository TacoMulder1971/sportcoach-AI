import { NextRequest, NextResponse } from 'next/server';

/**
 * Toegangsslot voor de API-routes (kostenbescherming).
 *
 * Alle /api/*-aanroepen gebruiken jouw Anthropic-key (of doen Garmin-werk).
 * Zonder slot kan iedereen die de URL kent op jouw kosten Claude aanroepen.
 * Deze middleware eist daarom een geldige toegangscode-cookie vóór elke API-call.
 *
 * Veilige uitrol: is `APP_ACCESS_CODE` niet ingesteld (zoals nu), dan staat
 * het slot open en verandert er niets. Zet je de env var op Vercel, dan gaat
 * het slot aan voor iedereen zonder geldige cookie.
 */
export function middleware(request: NextRequest) {
  const code = process.env.APP_ACCESS_CODE;

  // Geen code ingesteld → geen slot (huidige situatie blijft ongewijzigd).
  if (!code) return NextResponse.next();

  const { pathname } = request.nextUrl;

  // De toegangs-route zelf moet altijd bereikbaar zijn, anders kun je nooit ontgrendelen.
  if (pathname === '/api/access') return NextResponse.next();

  const cookie = request.cookies.get('sc_access')?.value;
  if (cookie === code) return NextResponse.next();

  return NextResponse.json(
    { error: 'Geen toegang. Voer eerst de toegangscode in.' },
    { status: 401 },
  );
}

export const config = {
  // Alleen API-routes afschermen; gewone pagina's laden altijd (de voordeur
  // regelt de layout zelf).
  matcher: '/api/:path*',
};
