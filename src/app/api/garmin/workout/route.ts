/**
 * Stuurt een gestructureerde workout naar Garmin Connect.
 *
 * Auth volgt exact hetzelfde patroon als /api/garmin/sync: sessie herstellen uit
 * de bewaarde tokens (geen wachtwoord-login, dus geen "aanmelding vanaf nieuwe
 * locatie"-mail), met de credentials als terugval. De ververste tokens gaan mee
 * terug zodat de client ze kan opslaan.
 *
 * De workout-DTO wordt client-side opgebouwd door src/lib/garmin-workout.ts;
 * deze route doet alleen auth + de POST naar /workout-service/workout.
 */
import { NextRequest, NextResponse } from 'next/server';
import { GarminConnect } from 'garmin-connect';
import { GarminTokens } from '@/lib/types';

// Eén POST naar Garmin; in het slechtste geval met een login ervoor.
export const maxDuration = 30;

const TOKEN_PROBE_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label}: timeout`)), ms)),
  ]);
}

/** Toetst een bewaard oauth2-token buiten de library om (zie sync-route). */
async function probeAccessToken(accessToken: string): Promise<boolean> {
  const res = await fetch('https://connectapi.garmin.com/userprofile-service/socialProfile', {
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  });
  return res.ok;
}

export async function POST(request: NextRequest) {
  try {
    let email: string | undefined;
    let password: string | undefined;
    let tokens: GarminTokens | undefined;
    let workout: Record<string, unknown> | undefined;
    try {
      const body = await request.json();
      email = body.email;
      password = body.password;
      tokens = body.tokens || undefined;
      workout = body.workout;
    } catch {
      // hieronder afgevangen
    }

    if (!workout || !workout.workoutSegments) {
      return NextResponse.json({ error: 'Geen geldige workout meegestuurd' }, { status: 400 });
    }
    if (!tokens && (!email || !password)) {
      return NextResponse.json(
        { error: 'Garmin niet gekoppeld — koppel je Garmin-account op de Data-tab.' },
        { status: 400 }
      );
    }

    const GC = new GarminConnect({ username: email || '', password: password || '' });

    let restored = false;
    if (tokens?.oauth1?.oauth_token && tokens?.oauth2?.access_token) {
      const expiresAt = Number(tokens.oauth2.expires_at) || 0;
      const stillValid = expiresAt * 1000 > Date.now() + 60_000;
      try {
        GC.loadToken(tokens.oauth1 as never, tokens.oauth2 as never);
        if (stillValid) {
          const ok = await withTimeout(
            probeAccessToken(tokens.oauth2.access_token),
            TOKEN_PROBE_TIMEOUT_MS,
            'sessie-check'
          );
          if (!ok) throw new Error('token geweigerd door Garmin');
        } else {
          // Verlopen oauth2 wordt via het oauth1-token ingewisseld — geen aanmelding.
          await withTimeout(
            (GC as unknown as { getUserProfile: () => Promise<unknown> }).getUserProfile(),
            TOKEN_PROBE_TIMEOUT_MS,
            'token vernieuwen'
          );
        }
        restored = true;
      } catch (e) {
        console.warn(
          '[garmin-workout] tokens onbruikbaar, val terug op wachtwoord-login:',
          e instanceof Error ? e.message : e
        );
      }
    }

    if (!restored) {
      if (!email || !password) {
        return NextResponse.json(
          { error: 'Garmin-sessie verlopen — koppel je Garmin-account opnieuw op de Data-tab.' },
          { status: 401 }
        );
      }
      await GC.login();
    }

    const created = await (GC as unknown as {
      addWorkout: (w: unknown) => Promise<{ workoutId?: number | string; workoutName?: string }>;
    }).addWorkout(workout);

    if (!created?.workoutId) {
      return NextResponse.json({ error: 'Garmin gaf geen workout-id terug' }, { status: 502 });
    }

    let freshTokens: GarminTokens | undefined;
    try {
      freshTokens = GC.exportToken() as unknown as GarminTokens;
    } catch (e) {
      console.warn('[garmin-workout] exportToken() mislukt:', e instanceof Error ? e.message : e);
    }

    return NextResponse.json({
      workoutId: created.workoutId,
      workoutName: created.workoutName,
      tokens: freshTokens,
    });
  } catch (error) {
    console.error('Garmin workout error:', error);
    const message = error instanceof Error ? error.message : 'Onbekende fout';
    return NextResponse.json({ error: `Naar Garmin sturen mislukt: ${message}` }, { status: 500 });
  }
}
