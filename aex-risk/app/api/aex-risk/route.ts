import { NextResponse } from 'next/server';
import { fetchAexHistory } from '@/lib/fetch-aex';
import { computeRisk } from '@/lib/risk';

// Externe fetch + berekening kan iets duren; ruime marge.
export const maxDuration = 15;
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { points, source } = await fetchAexHistory();
    const risk = computeRisk(points, source);
    return NextResponse.json({ risk });
  } catch (error) {
    console.error('aex-risk route error:', error);
    return NextResponse.json(
      { error: 'Kon de AEX-marktdata nu niet ophalen. Probeer het later opnieuw.' },
      { status: 502 },
    );
  }
}
