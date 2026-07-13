'use client';

import { useCallback, useRef, useState, ReactNode } from 'react';

const PULL_THRESHOLD = 65;

interface Props {
  onRefresh: () => void;
  refreshing: boolean;
  /** Tekst in de indicator tijdens het verversen, bv. "Yazio syncen..." */
  refreshingLabel?: string;
  /** Kleurklasse van het pijl/spinner-icoon, bv. "text-green-400" */
  accentClassName?: string;
  /** Extra klassen voor de wrapper, bv. "min-h-screen" zodat trekken op het
   * lege vlak onder korte inhoud ook werkt */
  className?: string;
  children: ReactNode;
}

// Herbruikbare pull-to-refresh, zelfde idioom als de Garmin-variant die al op
// de Data-tab zit (React touch-handlers + zwevende pil-indicator). Alleen
// actief als de pagina op scrollpositie 0 staat; gewoon scrollen blijft
// onaangetast.
export default function PullToRefresh({
  onRefresh,
  refreshing,
  refreshingLabel = 'Synchroniseren...',
  accentClassName = 'text-blue-400',
  className,
  children,
}: Props) {
  const [pullDistance, setPullDistance] = useState(0);
  const [pulling, setPulling] = useState(false);
  const touchStartY = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      touchStartY.current = e.touches[0].clientY;
      setPulling(true);
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling) return;
    const dist = Math.max(0, e.touches[0].clientY - touchStartY.current);
    setPullDistance(Math.min(dist, PULL_THRESHOLD * 1.5));
  }, [pulling]);

  const handleTouchEnd = useCallback(() => {
    if (pullDistance >= PULL_THRESHOLD && !refreshing) {
      onRefresh();
    }
    setPullDistance(0);
    setPulling(false);
  }, [pullDistance, refreshing, onRefresh]);

  return (
    <div className={className} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      {(pullDistance > 10 || refreshing) && (
        <div
          className="fixed top-0 left-0 right-0 flex justify-center items-center z-50 pointer-events-none"
          style={{ height: refreshing ? 56 : Math.min(pullDistance, 56) }}
        >
          <div className="bg-[#1c1c1e] border border-white/10 rounded-full shadow-lg px-4 py-2 flex items-center gap-2">
            <svg
              className={`w-4 h-4 ${accentClassName} ${refreshing ? 'animate-spin' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
              style={{ transform: refreshing ? undefined : `rotate(${Math.min(pullDistance / PULL_THRESHOLD, 1) * 180}deg)` }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-xs font-medium text-gray-300">
              {refreshing ? refreshingLabel : pullDistance >= PULL_THRESHOLD ? 'Loslaten om te syncen' : 'Trek omlaag om te syncen'}
            </span>
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
