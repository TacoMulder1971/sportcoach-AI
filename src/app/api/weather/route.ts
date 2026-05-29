import { NextResponse } from 'next/server';
import { RaceWeather } from '@/lib/types';

// WMO weather interpretation codes → NL omschrijving
const WMO_NL: Record<number, string> = {
  0: 'Helder', 1: 'Overwegend helder', 2: 'Half bewolkt', 3: 'Bewolkt',
  45: 'Mist', 48: 'IJzelmist',
  51: 'Lichte motregen', 53: 'Motregen', 55: 'Dichte motregen',
  56: 'Lichte ijzel', 57: 'IJzel',
  61: 'Lichte regen', 63: 'Regen', 65: 'Zware regen',
  66: 'Lichte ijsregen', 67: 'IJsregen',
  71: 'Lichte sneeuw', 73: 'Sneeuw', 75: 'Zware sneeuw', 77: 'Sneeuwkorrels',
  80: 'Lichte buien', 81: 'Buien', 82: 'Zware buien',
  85: 'Lichte sneeuwbuien', 86: 'Sneeuwbuien',
  95: 'Onweer', 96: 'Onweer met hagel', 99: 'Zwaar onweer met hagel',
};

function describe(code: number): string {
  return WMO_NL[code] ?? 'Onbekend';
}

export async function POST(request: Request) {
  try {
    const { location, date } = await request.json();
    if (!location || !date) {
      return NextResponse.json({ error: 'location en date vereist' }, { status: 400 });
    }

    // 1. Geocode de locatie → lat/lon
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=nl&format=json`;
    const geoResp = await fetch(geoUrl);
    const geo = await geoResp.json();
    const place = geo?.results?.[0];
    if (!place) {
      return NextResponse.json({ weather: null, reason: 'locatie niet gevonden' });
    }
    const { latitude, longitude } = place;

    // 2. Kies bron: verleden → archief, nabije toekomst → verwachting, ver weg → niets
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(date + 'T12:00:00');
    const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);

    let source: 'archief' | 'verwachting';
    let base: string;
    if (diffDays < 0) {
      source = 'archief';
      base = 'https://archive-api.open-meteo.com/v1/archive';
    } else if (diffDays <= 15) {
      source = 'verwachting';
      base = 'https://api.open-meteo.com/v1/forecast';
    } else {
      return NextResponse.json({ weather: null, reason: 'datum te ver in de toekomst' });
    }

    const daily = 'temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code';
    const wUrl = `${base}?latitude=${latitude}&longitude=${longitude}&start_date=${date}&end_date=${date}&daily=${daily}&timezone=Europe%2FAmsterdam`;
    const wResp = await fetch(wUrl);
    const w = await wResp.json();
    const d = w?.daily;
    if (!d || !Array.isArray(d.time) || d.time.length === 0) {
      return NextResponse.json({ weather: null, reason: 'geen weerdata' });
    }

    const code = Number(d.weather_code?.[0] ?? 0);
    const weather: RaceWeather = {
      date,
      tempMaxC: Math.round(Number(d.temperature_2m_max?.[0] ?? 0)),
      tempMinC: Math.round(Number(d.temperature_2m_min?.[0] ?? 0)),
      precipitationMm: Math.round(Number(d.precipitation_sum?.[0] ?? 0) * 10) / 10,
      windMaxKmh: Math.round(Number(d.wind_speed_10m_max?.[0] ?? 0)),
      weatherCode: code,
      description: describe(code),
      source,
    };

    return NextResponse.json({ weather });
  } catch (error) {
    console.error('Weather fetch error:', error);
    const message = error instanceof Error ? error.message : 'Onbekende fout';
    return NextResponse.json({ error: `Weer ophalen mislukt: ${message}` }, { status: 500 });
  }
}
