'use client';

import { useState } from 'react';
import { Equipment, EquipmentType, GarminActivity, ActivityAssignments } from '@/lib/types';
import { assignActivityToEquipment, clearActivityAssignment } from '@/lib/storage';
import { equipmentForActivity } from '@/lib/equipment';
import EquipmentIcon from '@/components/EquipmentIcon';

const TYPE_ICON: Record<EquipmentType, string> = {
  racefiets: '🚴',
  mountainbike: '⛰️',
  stadsfiets: '🚲',
  hardloopschoenen: '👟',
  overig: '🛠️',
  fiets: '🚲', // legacy fallback (wordt gemigreerd naar racefiets bij eerstvolgende load)
};

interface Props {
  activity: GarminActivity;
  equipment: Equipment[];
  assignments: ActivityAssignments;
  /** Roep dit aan na een wijziging zodat de bovenliggende component refresht. */
  onChange?: () => void;
}

/**
 * Klein chip-icoontje dat toont welk Equipment is toegewezen aan een Garmin-activiteit.
 * Tik = open kleine kiezer met actieve equipment van dezelfde sport.
 */
export default function EquipmentAssignChip({ activity, equipment, assignments, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const assigned = equipmentForActivity(activity, equipment, assignments);
  const hasOverride = !!assignments[activity.id];

  // Alleen actieve equipment van dezelfde sport tonen als opties
  const candidates = equipment.filter(e =>
    e.sport === activity.sport &&
    e.status === 'active' &&
    e.acquiredAt <= activity.date &&
    (!e.retiredAt || activity.date <= e.retiredAt)
  );

  // Geen equipment voor deze sport beschikbaar → geen chip tonen
  if (candidates.length === 0 && !assigned) return null;

  const label = assigned ? `${TYPE_ICON[assigned.type]} ${shorten(assigned.name)}` : '➕ Toewijzen';

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
          hasOverride
            ? 'bg-blue-100 text-blue-700'
            : assigned
              ? 'bg-gray-100 text-gray-600'
              : 'bg-amber-50 text-amber-600 border border-dashed border-amber-300'
        }`}
        title={assigned?.name || 'Geen materiaal toegewezen'}
      >
        {label}
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
              <p className="text-sm font-semibold text-gray-900">Welke {activity.sport === 'fietsen' ? 'fiets' : activity.sport === 'hardlopen' ? 'schoenen' : 'materiaal'}?</p>
              <p className="text-xs text-gray-500 truncate">{activity.activityName} · {activity.date}</p>
            </div>

            <div className="p-2 space-y-1 max-h-72 overflow-y-auto">
              {candidates.map(eq => {
                const selected = assigned?.id === eq.id;
                return (
                  <button
                    key={eq.id}
                    onClick={() => {
                      assignActivityToEquipment(activity.id, eq.id);
                      onChange?.();
                      setOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-3 ${
                      selected ? 'bg-blue-50 border border-blue-300' : 'hover:bg-gray-50'
                    }`}
                  >
                    <EquipmentIcon type={eq.type} size="sm" />
                    <span className="flex-1">{eq.name}</span>
                    {eq.isDefault && <span className="text-[10px] text-blue-600 font-semibold">DEFAULT</span>}
                    {selected && <span className="text-blue-600">✓</span>}
                  </button>
                );
              })}

              {hasOverride && (
                <button
                  onClick={() => {
                    clearActivityAssignment(activity.id);
                    onChange?.();
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-50 border-t border-gray-100 mt-1 pt-3"
                >
                  ↺ Terug naar default
                </button>
              )}
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

function shorten(name: string, max = 14): string {
  if (name.length <= max) return name;
  return name.slice(0, max - 1) + '…';
}
