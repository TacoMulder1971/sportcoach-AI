'use client';

import { RaceWeather } from '@/lib/types';

// Eenvoudig weericoon op basis van WMO-code-groep
function WeatherGlyph({ code }: { code: number }) {
  let glyph = '☀️';
  if (code === 0 || code === 1) glyph = '☀️';
  else if (code === 2) glyph = '⛅';
  else if (code === 3) glyph = '☁️';
  else if (code === 45 || code === 48) glyph = '🌫️';
  else if (code >= 51 && code <= 67) glyph = '🌧️';
  else if (code >= 71 && code <= 77) glyph = '❄️';
  else if (code >= 80 && code <= 86) glyph = '🌦️';
  else if (code >= 95) glyph = '⛈️';
  return <span className="text-4xl leading-none">{glyph}</span>;
}

interface WeatherCardProps {
  weather: RaceWeather | null;
  loading?: boolean;
}

export default function WeatherCard({ weather, loading }: WeatherCardProps) {
  if (loading) {
    return (
      <div className="bg-[#0d0d0f] rounded-3xl p-4 border border-white/5 animate-pulse">
        <div className="h-12 bg-white/5 rounded" />
      </div>
    );
  }

  if (!weather) {
    return (
      <div className="bg-[#0d0d0f] rounded-3xl p-4 border border-white/5 text-center">
        <p className="text-sm text-gray-500">Geen weergegevens beschikbaar voor deze datum.</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0d0d0f] rounded-3xl p-4 border border-white/5">
      <div className="flex items-center gap-4">
        <WeatherGlyph code={weather.weatherCode} />
        <div className="flex-1">
          <p className="text-lg font-bold text-gray-100">{weather.description}</p>
          <p className="text-xs text-gray-500">
            {weather.source === 'verwachting' ? 'Verwachting' : 'Historisch'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-white">{weather.tempMaxC}°</p>
          <p className="text-xs text-gray-500">{weather.tempMinC}° min</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-white/5 text-center">
        <div>
          <p className="text-lg font-bold text-sky-400">{weather.windMaxKmh}</p>
          <p className="text-xs text-gray-500">km/h wind</p>
        </div>
        <div>
          <p className="text-lg font-bold text-blue-400">{weather.precipitationMm}</p>
          <p className="text-xs text-gray-500">mm neerslag</p>
        </div>
      </div>
    </div>
  );
}
