/**
 * Leest een API-antwoord veilig als JSON.
 *
 * Vercel geeft bij een time-out (504) of crash een platte tekst-/HTML-pagina
 * terug i.p.v. JSON. `res.json()` gooit dan een parse-fout die Safari toont als
 * "The string did not match the expected pattern." — onbegrijpelijk voor de
 * gebruiker. Deze helper vertaalt dat naar een Nederlandse melding.
 */
export async function readApiJson<T = Record<string, unknown>>(
  res: Response,
  fallbackError: string,
): Promise<T> {
  const text = await res.text();
  let data: (T & { error?: string }) | null = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!data) {
    if (res.status === 504 || /timeout|timed out/i.test(text)) {
      throw new Error('Het duurde te lang (time-out van de server). Probeer het nog een keer.');
    }
    if (res.status === 413) {
      throw new Error('Er werd te veel data meegestuurd. Probeer het nog een keer.');
    }
    throw new Error(`${fallbackError} (serverfout ${res.status}). Probeer het nog een keer.`);
  }

  if (!res.ok) throw new Error(data.error || fallbackError);
  return data;
}
