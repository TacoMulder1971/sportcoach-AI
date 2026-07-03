'use client';

import { useState } from 'react';
import { GarminActivity, SwimVariant, ActivitySwimVariants, SWIM_VARIANT_LABEL } from '@/lib/types';
import { setActivitySwimVariant, setLastSwimVariant } from '@/lib/storage';
import { swimVariantForActivity } from '@/lib/swim';
import SwimVariantIcon from '@/components/SwimVariantIcon';

const VARIANTS: SwimVariant[] = ['zwembad_binnen', 'zwembad_buiten', 'openwater'];

interface Props {
  activity: GarminActivity;
  variants: ActivitySwimVariants;
  onChange?: () => void;
}

/**
 * Chip naast een zwem-activiteit die de variant (binnen/buiten/openwater) toont.
 * Tik om te wisselen. Onthoudt de keuze ook als laatste-default voor check-out.
 */
export default function SwimVariantChip({ activity, variants, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const current = swimVariantForActivity(activity, variants);

  const shortLabel: Record<SwimVariant, string> = {
    zwembad_binnen: 'Binnen',
    zwembad_buiten: 'Buiten',
    openwater: 'Openwater',
  };

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 bg-white/10 text-gray-300"
        title={SWIM_VARIANT_LABEL[current]}
      >
        🌊 {shortLabel[current]}
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-sm overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900">Waar gezwommen?</p>
              <p className="text-xs text-gray-500 truncate">{activity.activityName} · {activity.date}</p>
            </div>

            <div className="p-2 space-y-1">
              {VARIANTS.map(v => {
                const selected = current === v;
                return (
                  <button
                    key={v}
                    onClick={() => {
                      setActivitySwimVariant(activity.id, v);
                      setLastSwimVariant(v);
                      onChange?.();
                      setOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-3 ${
                      selected ? 'bg-blue-50 border border-blue-300' : 'hover:bg-gray-50'
                    }`}
                  >
                    <SwimVariantIcon variant={v} size="sm" />
                    <span className="flex-1">{SWIM_VARIANT_LABEL[v]}</span>
                    {selected && <span className="text-blue-600">✓</span>}
                  </button>
                );
              })}
            </div>

            <div className="px-4 py-3 border-t border-gray-100" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
              <button
                onClick={() => setOpen(false)}
                className="w-full py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700"
              >
                Sluiten
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
