'use client';

import { useCallback, useEffect, useState } from 'react';
import { AexRisk, RISK_META } from '@/lib/types';
import { getCachedRisk, saveRisk } from '@/lib/storage';
import RiskCard from '@/components/RiskCard';
import RiskChart from '@/components/RiskChart';
import NewsPanel from '@/components/NewsPanel';
import Disclaimer from '@/components/Disclaimer';

export default function Home() {
  const [risk, setRisk] = useState<AexRisk | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRisk = useCallback(async (force: boolean) => {
    if (force) setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/aex-risk', { cache: 'no-store' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Ophalen mislukt');
      }
      const data = await res.json();
      setRisk(data.risk);
      saveRisk(data.risk);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Er ging iets mis');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // Toon eerst de dag-cache (snel), ververs daarna als die er niet is.
    const cached = getCachedRisk();
    if (cached) {
      setRisk(cached);
      setLoading(false);
    } else {
      fetchRisk(false);
    }
  }, [fetchRisk]);

  const meta = risk ? RISK_META[risk.riskLevel] : null;

  return (
    <main className="mx-auto max-w-lg px-4 pb-12 pt-8">
      <header className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">AEX Risico-indicator</h1>
        <p className="text-sm text-gray-500">
          Dagelijkse inschatting van beurs-stress op de AEX.
        </p>
      </header>

      {/* Dagbericht */}
      {risk && (
        <div
          className={`mb-4 rounded-xl border-l-4 bg-white p-4 ${meta?.ring ? `border-l-current ${meta.text}` : ''}`}
        >
          <p className="text-sm font-medium text-gray-800">{risk.message}</p>
        </div>
      )}

      {/* Call-to-action bij hoog risico */}
      {risk?.riskLevel === 'hoog' && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-700">Verkoopoptie checken?</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-red-600">
            <li>Bekijk je AEX-trackers en je gewenste verkoopniveau.</li>
            <li>Overweeg een stop-loss / verkoopoptie via je broker.</li>
            <li>Beslis bewust — dit is een seintje, geen advies.</li>
          </ul>
        </div>
      )}

      <div className="space-y-4">
        <RiskCard risk={risk} loading={loading} error={error} />
        {risk && <RiskChart history={risk.history} sma200={risk.sma200} />}
        {risk && (
          <NewsPanel items={risk.newsItems} summary={risk.newsSummary} newsEnabled={risk.newsEnabled} />
        )}
        <Disclaimer />
      </div>

      <button
        onClick={() => fetchRisk(true)}
        disabled={refreshing}
        className="mt-5 w-full rounded-xl bg-gray-900 py-3 text-sm font-medium text-white disabled:opacity-50"
      >
        {refreshing ? 'Verversen…' : 'Ververs nu'}
      </button>

      {risk && (
        <p className="mt-3 text-center text-[10px] text-gray-300">
          Laatst opgehaald: {new Date(risk.fetchedAt).toLocaleString('nl-NL')}
        </p>
      )}
    </main>
  );
}
