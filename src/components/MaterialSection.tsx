'use client';

import { useState, useEffect, useMemo } from 'react';
import { Equipment, EquipmentType, MaintenanceItem, GarminActivity, ActivityAssignments, EQUIPMENT_DEFAULT_LIMITS, EQUIPMENT_TYPE_LABEL, Sport } from '@/lib/types';
import {
  getActiveEquipment,
  getRetiredEquipment,
  saveEquipment,
  updateEquipment,
  deleteEquipment,
  retireEquipment,
  setDefaultEquipment as setDefaultEq,
  markMaintenanceDone,
  buildDefaultMaintenance,
  getGarminData,
  getActivityAssignments,
  generateId,
} from '@/lib/storage';
import { calculateEquipmentKm, equipmentWearStatus, maintenanceStatus, WearStatus } from '@/lib/equipment';

const TYPE_ICON: Record<EquipmentType, string> = {
  racefiets: '🚴',
  mountainbike: '⛰️',
  stadsfiets: '🚲',
  hardloopschoenen: '👟',
  overig: '🛠️',
  fiets: '🚲', // legacy, gemigreerd bij volgende load
};

const TYPE_SPORT_DEFAULT: Record<EquipmentType, Sport> = {
  racefiets: 'fietsen',
  mountainbike: 'mountainbike',
  stadsfiets: 'fietsen',
  hardloopschoenen: 'hardlopen',
  overig: 'fietsen',
  fiets: 'fietsen', // legacy
};

const WEAR_COLORS: Record<WearStatus, { bar: string; text: string; pill: string }> = {
  ok: { bar: 'bg-green-500', text: 'text-green-700', pill: 'bg-green-100 text-green-700' },
  warning: { bar: 'bg-amber-500', text: 'text-amber-700', pill: 'bg-amber-100 text-amber-700' },
  overdue: { bar: 'bg-red-500', text: 'text-red-700', pill: 'bg-red-100 text-red-700' },
  na: { bar: 'bg-gray-300', text: 'text-gray-500', pill: 'bg-gray-100 text-gray-600' },
};

export default function MaterialSection() {
  const [active, setActive] = useState<Equipment[]>([]);
  const [retired, setRetired] = useState<Equipment[]>([]);
  const [activities, setActivities] = useState<GarminActivity[]>([]);
  const [assignments, setAssignments] = useState<ActivityAssignments>({});
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [showForm, setShowForm] = useState<{ mode: 'new' | 'edit'; eq?: Equipment } | null>(null);

  const refresh = () => {
    setActive(getActiveEquipment());
    setRetired(getRetiredEquipment());
    const garmin = getGarminData();
    setActivities(garmin?.activities || []);
    setAssignments(getActivityAssignments());
  };

  useEffect(() => { refresh(); }, []);

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900">Materiaal</h2>
        <button
          onClick={() => setShowForm({ mode: 'new' })}
          className="text-sm text-blue-600 font-medium flex items-center gap-1"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          Nieuw
        </button>
      </div>

      {active.length === 0 && retired.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center text-sm text-gray-500">
          Nog geen materiaal. Voeg je fiets of hardloopschoenen toe om km te tellen.
        </div>
      ) : (
        <div className="space-y-3">
          {active.map(eq => (
            <EquipmentCard
              key={eq.id}
              eq={eq}
              activities={activities}
              allEquipment={active.concat(retired)}
              assignments={assignments}
              onEdit={() => setShowForm({ mode: 'edit', eq })}
              onRetire={() => {
                if (confirm(`"${eq.name}" pensioneren? Vanaf vandaag worden er geen nieuwe km meer aan toegevoegd.`)) {
                  retireEquipment(eq.id);
                  refresh();
                }
              }}
              onDelete={() => {
                if (confirm(`"${eq.name}" definitief verwijderen?`)) {
                  deleteEquipment(eq.id);
                  refresh();
                }
              }}
              onSetDefault={() => { setDefaultEq(eq.id); refresh(); }}
              onMaintenanceDone={(itemId, currentKm) => {
                markMaintenanceDone(eq.id, itemId, currentKm);
                refresh();
              }}
            />
          ))}

          {retired.length > 0 && (
            <div className="pt-2">
              <button
                onClick={() => setArchiveOpen(o => !o)}
                className="w-full text-sm text-gray-500 flex items-center justify-between py-2"
              >
                <span>{retired.length} gepensioneerd</span>
                <svg className={`w-4 h-4 transition-transform ${archiveOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              {archiveOpen && (
                <div className="space-y-2">
                  {retired.map(eq => (
                    <EquipmentCard
                      key={eq.id}
                      eq={eq}
                      activities={activities}
                      allEquipment={active.concat(retired)}
                      assignments={assignments}
                      onEdit={() => setShowForm({ mode: 'edit', eq })}
                      onDelete={() => {
                        if (confirm(`"${eq.name}" definitief verwijderen?`)) {
                          deleteEquipment(eq.id);
                          refresh();
                        }
                      }}
                      onReactivate={() => {
                        updateEquipment(eq.id, { status: 'active', retiredAt: undefined });
                        refresh();
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showForm && (
        <EquipmentFormModal
          mode={showForm.mode}
          eq={showForm.eq}
          activities={activities}
          allEquipment={active.concat(retired)}
          assignments={assignments}
          onSave={(eq) => {
            if (showForm.mode === 'new') saveEquipment(eq);
            else updateEquipment(eq.id, eq);
            // Default-flag: zorg dat als deze default is, andere het niet meer zijn
            if (eq.isDefault) setDefaultEq(eq.id);
            setShowForm(null);
            refresh();
          }}
          onClose={() => setShowForm(null)}
        />
      )}
    </section>
  );
}

// ─── Equipment Card ──────────────────────────────────────────────

function EquipmentCard({
  eq, activities, allEquipment, assignments,
  onEdit, onRetire, onDelete, onSetDefault, onMaintenanceDone, onReactivate,
}: {
  eq: Equipment;
  activities: GarminActivity[];
  allEquipment: Equipment[];
  assignments: ActivityAssignments;
  onEdit: () => void;
  onRetire?: () => void;
  onDelete: () => void;
  onSetDefault?: () => void;
  onMaintenanceDone?: (itemId: string, currentKm: number) => void;
  onReactivate?: () => void;
}) {
  const km = useMemo(
    () => calculateEquipmentKm(eq, activities, allEquipment, assignments),
    [eq, activities, allEquipment, assignments]
  );
  const wear = equipmentWearStatus(km, eq.kmLimit);
  const isRetired = eq.status === 'retired';

  return (
    <div className={`bg-white rounded-xl border ${isRetired ? 'border-gray-200 opacity-70' : 'border-gray-200'} p-4`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xl">{TYPE_ICON[eq.type]}</span>
            <span className="font-semibold text-gray-900">{eq.name}</span>
            {eq.isDefault && !isRetired && (
              <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">DEFAULT</span>
            )}
            {isRetired && (
              <span className="text-[10px] bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-medium">GEPENSIONEERD</span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {EQUIPMENT_TYPE_LABEL[eq.type]} · sinds {formatDate(eq.acquiredAt)}
            {isRetired && eq.retiredAt && ` · gepensioneerd ${formatDate(eq.retiredAt)}`}
          </p>
        </div>
      </div>

      {/* Km-teller / slijtage-balk */}
      {eq.kmLimit ? (
        <div className="mb-3">
          <div className="flex items-baseline justify-between mb-1">
            <span className={`text-sm font-semibold ${WEAR_COLORS[wear].text}`}>
              {Math.round(km)} / {eq.kmLimit} km
            </span>
            <span className="text-xs text-gray-500">{Math.round((km / eq.kmLimit) * 100)}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${WEAR_COLORS[wear].bar} transition-all`}
              style={{ width: `${Math.min(100, (km / eq.kmLimit) * 100)}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="mb-3 text-sm text-gray-700">
          <span className="font-semibold">{Math.round(km)} km</span> <span className="text-gray-500">gereden</span>
        </div>
      )}

      {/* Onderhouds-items */}
      {eq.maintenance && eq.maintenance.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {eq.maintenance.map(m => {
            const s = maintenanceStatus(m, km);
            const colors = WEAR_COLORS[s.status === 'ok' ? 'ok' : s.status === 'warning' ? 'warning' : 'overdue'];
            return (
              <div key={m.id} className="flex items-center justify-between text-xs">
                <div className="flex-1 min-w-0">
                  <span className={`inline-block px-2 py-0.5 rounded-full font-medium ${colors.pill} mr-2`}>
                    {m.name}
                  </span>
                  <span className="text-gray-600">
                    {m.intervalKm ? `${Math.round(s.kmSince)}/${m.intervalKm}km` : ''}
                    {m.intervalKm && m.intervalDays ? ' · ' : ''}
                    {m.intervalDays ? `${s.daysAgo}/${m.intervalDays}d` : ''}
                    {s.reason && ` · ${s.reason}`}
                  </span>
                </div>
                {!isRetired && onMaintenanceDone && (
                  <button
                    onClick={() => onMaintenanceDone(m.id, km)}
                    className="text-blue-600 text-xs font-medium ml-2 flex-shrink-0"
                  >
                    ✓ Gedaan
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {eq.note && (
        <p className="text-xs text-gray-500 italic mt-1 mb-2">{eq.note}</p>
      )}

      {/* Actie-knoppen */}
      <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
        {!isRetired && !eq.isDefault && onSetDefault && (
          <button onClick={onSetDefault} className="text-xs text-blue-600 font-medium">
            ⭐ Default
          </button>
        )}
        <button onClick={onEdit} className="text-xs text-gray-600 font-medium ml-auto">
          ✏️ Bewerken
        </button>
        {!isRetired && onRetire && (
          <button onClick={onRetire} className="text-xs text-gray-600 font-medium">
            📦 Pensioneren
          </button>
        )}
        {isRetired && onReactivate && (
          <button onClick={onReactivate} className="text-xs text-blue-600 font-medium">
            ↺ Heractiveren
          </button>
        )}
        <button onClick={onDelete} className="text-xs text-red-500 font-medium">
          🗑
        </button>
      </div>
    </div>
  );
}

// ─── Form Modal ─────────────────────────────────────────────────

function EquipmentFormModal({
  mode, eq, activities, allEquipment, assignments,
  onSave, onClose,
}: {
  mode: 'new' | 'edit';
  eq?: Equipment;
  activities: GarminActivity[];
  allEquipment: Equipment[];
  assignments: ActivityAssignments;
  onSave: (eq: Equipment) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(eq?.name || '');
  const [type, setType] = useState<EquipmentType>(eq?.type === 'fiets' ? 'racefiets' : (eq?.type || 'racefiets'));
  const [sport, setSport] = useState<Sport>(eq?.sport || TYPE_SPORT_DEFAULT[eq?.type || 'fiets']);
  const [acquiredAt, setAcquiredAt] = useState(eq?.acquiredAt || new Date().toISOString().split('T')[0]);
  const [startKm, setStartKm] = useState(eq?.startKm?.toString() || '0');
  const [kmLimit, setKmLimit] = useState(eq?.kmLimit?.toString() || (EQUIPMENT_DEFAULT_LIMITS[eq?.type || 'fiets']?.toString() || ''));
  const [isDefault, setIsDefault] = useState(eq?.isDefault || false);
  const [note, setNote] = useState(eq?.note || '');
  const [maintenance, setMaintenance] = useState<MaintenanceItem[]>(
    eq?.maintenance || (mode === 'new' ? buildDefaultMaintenance(type) : [])
  );

  // Wanneer type wijzigt bij NIEUW item: stel sport + defaults bij
  useEffect(() => {
    if (mode === 'new') {
      setSport(TYPE_SPORT_DEFAULT[type]);
      const lim = EQUIPMENT_DEFAULT_LIMITS[type];
      setKmLimit(lim ? lim.toString() : '');
      setMaintenance(buildDefaultMaintenance(type));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const currentKm = useMemo(() => {
    if (!eq) return 0;
    return calculateEquipmentKm(eq, activities, allEquipment, assignments);
  }, [eq, activities, allEquipment, assignments]);

  const handleSave = () => {
    if (!name.trim()) {
      alert('Naam is verplicht');
      return;
    }
    const result: Equipment = {
      id: eq?.id || generateId(),
      type,
      name: name.trim(),
      sport,
      isDefault,
      acquiredAt,
      startKm: parseFloat(startKm) || 0,
      kmLimit: kmLimit ? parseFloat(kmLimit) : undefined,
      status: eq?.status || 'active',
      retiredAt: eq?.retiredAt,
      maintenance: maintenance.length > 0 ? maintenance : undefined,
      note: note.trim() || undefined,
      createdAt: eq?.createdAt || new Date().toISOString(),
    };
    onSave(result);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">{mode === 'new' ? 'Nieuw materiaal' : 'Bewerk materiaal'}</h3>
          <button onClick={onClose} className="text-gray-400 text-xl leading-none">×</button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as EquipmentType)}
              className="w-full border border-gray-300 rounded-lg p-2 text-sm"
            >
              <option value="racefiets">🚴 Racefiets</option>
              <option value="mountainbike">⛰️ Mountainbike</option>
              <option value="stadsfiets">🚲 Stadsfiets</option>
              <option value="hardloopschoenen">👟 Hardloopschoenen</option>
              <option value="overig">🛠️ Overig</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Naam</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={
                type === 'racefiets' ? 'BMC racefiets' :
                type === 'mountainbike' ? 'Mountainbike' :
                type === 'stadsfiets' ? 'Stadsfiets' :
                type === 'hardloopschoenen' ? 'Brooks 25' :
                'Materiaal-naam'
              }
              className="w-full border border-gray-300 rounded-lg p-2 text-sm"
            />
          </div>

          {type === 'overig' && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Sport (km telt voor)</label>
              <select
                value={sport}
                onChange={e => setSport(e.target.value as Sport)}
                className="w-full border border-gray-300 rounded-lg p-2 text-sm"
              >
                <option value="fietsen">Fietsen</option>
                <option value="hardlopen">Hardlopen</option>
                <option value="mountainbike">Mountainbike</option>
                <option value="zwemmen">Zwemmen</option>
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Aanschafdatum</label>
              <input
                type="date"
                value={acquiredAt}
                onChange={e => setAcquiredAt(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Start km</label>
              <input
                type="number"
                value={startKm}
                onChange={e => setStartKm(e.target.value)}
                placeholder="0"
                className="w-full border border-gray-300 rounded-lg p-2 text-sm"
              />
            </div>
          </div>

          {(type === 'hardloopschoenen' || type === 'overig') && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Vervang-limiet (km, optioneel)</label>
              <input
                type="number"
                value={kmLimit}
                onChange={e => setKmLimit(e.target.value)}
                placeholder={type === 'hardloopschoenen' ? '700' : '1000'}
                className="w-full border border-gray-300 rounded-lg p-2 text-sm"
              />
            </div>
          )}

          <label className="flex items-center gap-2 text-sm py-1">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={e => setIsDefault(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-gray-700">Standaard voor {sport} (km gaan hier automatisch heen)</span>
          </label>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Notitie (optioneel)</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg p-2 text-sm resize-none"
            />
          </div>

          {/* Onderhouds-items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-gray-500">Onderhoud</label>
              <button
                onClick={() => setMaintenance(prev => [...prev, {
                  id: generateId(),
                  name: '',
                  lastDoneAt: new Date().toISOString().split('T')[0],
                  lastDoneKm: 0,
                }])}
                className="text-xs text-blue-600 font-medium"
              >
                + item
              </button>
            </div>
            <div className="space-y-2">
              {maintenance.map((m, i) => (
                <div key={m.id} className="bg-gray-50 rounded-lg p-2 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={m.name}
                      onChange={e => {
                        const copy = [...maintenance];
                        copy[i] = { ...m, name: e.target.value };
                        setMaintenance(copy);
                      }}
                      placeholder="bv. Ketting smeren"
                      className="flex-1 border border-gray-300 rounded p-1.5 text-xs"
                    />
                    <button
                      onClick={() => setMaintenance(maintenance.filter((_, idx) => idx !== i))}
                      className="text-red-500 text-sm"
                      title="Verwijderen"
                    >
                      ×
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <input
                      type="number"
                      value={m.intervalKm ?? ''}
                      onChange={e => {
                        const copy = [...maintenance];
                        copy[i] = { ...m, intervalKm: e.target.value ? parseInt(e.target.value) : undefined };
                        setMaintenance(copy);
                      }}
                      placeholder="km"
                      className="border border-gray-300 rounded p-1.5 text-xs"
                    />
                    <input
                      type="number"
                      value={m.intervalDays ?? ''}
                      onChange={e => {
                        const copy = [...maintenance];
                        copy[i] = { ...m, intervalDays: e.target.value ? parseInt(e.target.value) : undefined };
                        setMaintenance(copy);
                      }}
                      placeholder="dagen"
                      className="border border-gray-300 rounded p-1.5 text-xs"
                    />
                    <input
                      type="date"
                      value={m.lastDoneAt}
                      onChange={e => {
                        const copy = [...maintenance];
                        copy[i] = { ...m, lastDoneAt: e.target.value };
                        setMaintenance(copy);
                      }}
                      className="border border-gray-300 rounded p-1.5 text-xs"
                    />
                  </div>
                </div>
              ))}
              {maintenance.length === 0 && (
                <p className="text-xs text-gray-400 italic">Geen onderhouds-items.</p>
              )}
            </div>
          </div>

          {eq && (
            <div className="text-xs text-gray-500 bg-blue-50 rounded p-2">
              Huidige km-stand (op basis van Garmin-toewijzingen): <strong>{Math.round(currentKm)} km</strong>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-3 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700"
          >
            Annuleren
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-blue-600 text-white"
          >
            Opslaan
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}
