import { NextResponse } from 'next/server';
import { Yazio } from 'yazio';
import { NutritionLog } from '@/lib/types';

// Yazio-voeding-sync. Credentials komen per-gebruiker uit het request body
// (localStorage), met env-vars als server-fallback — zelfde patroon als Garmin.
// De (onofficiële) Yazio-API werkt alleen met e-mail + wachtwoord: accounts die
// via "Doorgaan met Google/Apple" zijn aangemaakt hebben geen wachtwoord en
// kunnen dus niet koppelen.
export const runtime = 'nodejs';
export const maxDuration = 30;

// De dagsamenvatting splitst per maaltijd; wij tellen ze op tot dagtotalen.
type MealNutrients = {
  'energy.energy': number;
  'nutrient.carb': number;
  'nutrient.fat': number;
  'nutrient.protein': number;
};

function ymd(d: Date): string {
  return d.toISOString().split('T')[0];
}

export async function POST(request: Request) {
  let email: string | undefined;
  let password: string | undefined;
  let days = 14;
  try {
    const body = await request.json();
    email = body.email || process.env.YAZIO_EMAIL;
    password = body.password || process.env.YAZIO_PASSWORD;
    if (typeof body.days === 'number' && body.days > 0 && body.days <= 60) days = body.days;
  } catch {
    email = process.env.YAZIO_EMAIL;
    password = process.env.YAZIO_PASSWORD;
  }

  if (!email || !password) {
    return NextResponse.json(
      { error: 'Yazio-inloggegevens ontbreken' },
      { status: 400 }
    );
  }

  const yazio = new Yazio({ credentials: { username: email, password } });

  // Login-check: haal eerst de gebruiker op zodat we een nette foutmelding kunnen
  // geven (Google-account/fout wachtwoord → Yazio geeft 400 op /oauth/token).
  try {
    await yazio.user.get();
  } catch {
    return NextResponse.json(
      {
        error:
          'Inloggen bij Yazio mislukt. Controleer je e-mail en wachtwoord. Let op: ' +
          'een account dat met Google of Apple is aangemaakt heeft geen wachtwoord en werkt niet.',
      },
      { status: 401 }
    );
  }

  // Haal per dag de samenvatting op; één mislukte dag mag de rest niet slopen.
  const dates: Date[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d);
  }

  const results = await Promise.allSettled(
    dates.map(async (date) => {
      const summary = await yazio.user.getDailySummary({ date });
      const meals = Object.values(summary.meals) as { nutrients: MealNutrients }[];
      const sum = (key: keyof MealNutrients) =>
        meals.reduce((acc, m) => acc + (m.nutrients[key] || 0), 0);

      const log: NutritionLog = {
        date: ymd(date),
        calories: Math.round(sum('energy.energy')),
        carbsG: Math.round(sum('nutrient.carb')),
        proteinG: Math.round(sum('nutrient.protein')),
        fatG: Math.round(sum('nutrient.fat')),
        fiberG: 0, // Yazio geeft vezels niet in de dagsamenvatting mee
      };
      return log;
    })
  );

  // Alleen dagen met daadwerkelijk gelogde voeding bewaren (0 kcal = niets gelogd).
  const logs = results
    .filter((r): r is PromiseFulfilledResult<NutritionLog> => r.status === 'fulfilled')
    .map((r) => r.value)
    .filter((log) => log.calories > 0)
    .sort((a, b) => b.date.localeCompare(a.date));

  return NextResponse.json({ logs, syncedDays: days });
}
