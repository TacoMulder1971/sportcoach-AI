import { NextRequest, NextResponse } from 'next/server';

/**
 * Toegangscontrole voor de voordeur.
 *
 * POST { code }  → controleert de code tegen APP_ACCESS_CODE en zet bij een
 *                  match een httpOnly-cookie zodat de gebruiker ontgrendeld
 *                  blijft (1 jaar). Geen code ingesteld = altijd toegestaan.
 */
export async function POST(request: NextRequest) {
  const code = process.env.APP_ACCESS_CODE;

  // Geen slot ingesteld → altijd toegang (huidige single-user situatie).
  if (!code) {
    return NextResponse.json({ ok: true });
  }

  let body: { code?: string } = {};
  try {
    body = await request.json();
  } catch {
    // lege body → onjuist
  }

  if (typeof body.code !== 'string' || body.code !== code) {
    return NextResponse.json({ ok: false, error: 'Onjuiste toegangscode' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('sc_access', code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 jaar
  });
  return res;
}
