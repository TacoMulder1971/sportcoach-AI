// Praktische wedstrijdvoorbereiding: wat moet er vóór de race geregeld zijn?
// Nu: apparaten opladen (horloge, fietscomputer, elektronische schakeling).
//
// Bewust pure logica — gebruikt door:
// - RacePrepCard (Home + Races-tab)
// - daily-message route (coach herinnert eraan in de aanloop)

import { Goal, GOAL_TYPES, TrainingSport, UserProfile } from './types';

/** Vanaf hoeveel dagen vóór de wedstrijd tonen we de oplaad-herinnering? */
export const RACE_PREP_WINDOW_DAYS = 3;

/**
 * Welke sporten horen bij deze wedstrijd? Een triatlon geeft zwem/fiets/loop,
 * een marathon alleen hardlopen. `null` = onbekend (eigen doel) → de caller valt
 * terug op de sporten uit het profiel.
 */
export function sportsForGoal(goal: Goal | null): TrainingSport[] | null {
  if (!goal) return null;
  const info = GOAL_TYPES.find((t) => t.type === goal.type);
  if (info?.multiSport && info.disciplines) return [...new Set<TrainingSport>(info.disciplines)];
  switch (goal.type) {
    case 'fietstocht': return ['fietsen'];
    case 'zwemtocht': return ['zwemmen'];
    case 'eigen': return null; // onbekende sport → profielsporten
    default: return ['hardlopen']; // loopafstanden (5k t/m marathon)
  }
}

export interface ChargeDevice {
  id: string;
  label: string;
  hint?: string;
}

const DEVICE_WATCH: ChargeDevice = {
  id: 'horloge',
  label: 'Sporthorloge',
  hint: 'Vol opladen — een lange wedstrijd met gps trekt de accu leeg.',
};
const DEVICE_BIKE_COMPUTER: ChargeDevice = {
  id: 'fietscomputer',
  label: 'Fietscomputer',
  hint: 'Bijv. Garmin Edge 530 — zet meteen je route of workout klaar.',
};
const DEVICE_DI2: ChargeDevice = {
  id: 'di2',
  label: 'Elektronische schakeling (Di2)',
  hint: 'Check het accuniveau in de app; bij twijfel de avond ervoor aan de lader.',
};

function slugify(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'apparaat';
}

/**
 * De apparaten die vóór deze wedstrijd opgeladen moeten zijn.
 * Een eigen lijst in het profiel (`chargeDevices`) wint altijd; anders leiden we
 * 'm af uit de disciplines van de wedstrijd.
 */
export function chargeDevicesForGoal(goal: Goal | null, profile?: UserProfile | null): ChargeDevice[] {
  const custom = (profile?.chargeDevices ?? []).map((d) => d.trim()).filter(Boolean);
  if (custom.length > 0) {
    return custom.map((label) => ({ id: slugify(label), label }));
  }

  const sports = sportsForGoal(goal) ?? profile?.sports ?? [];
  const devices: ChargeDevice[] = [DEVICE_WATCH];
  if (sports.includes('fietsen') || sports.includes('mountainbike')) {
    devices.push(DEVICE_BIKE_COMPUTER, DEVICE_DI2);
  }
  return devices;
}

export interface RacePrepAdvice {
  goalId: string;
  raceName: string;
  daysUntil: number;
  devices: ChargeDevice[];
  /** Korte tijdsinstructie, afhankelijk van hoe dichtbij de wedstrijd is. */
  timing: string;
  /** Vanaf de dag vóór de wedstrijd: nu écht doen. */
  urgent: boolean;
}

/**
 * Oplaad-advies voor de eerstvolgende wedstrijd, of null als die er niet is of
 * nog te ver weg (> RACE_PREP_WINDOW_DAYS).
 */
export function buildRacePrepAdvice(
  goal: Goal | null,
  daysUntil: number | null,
  profile?: UserProfile | null,
): RacePrepAdvice | null {
  if (!goal || daysUntil === null) return null;
  if (daysUntil < 0 || daysUntil > RACE_PREP_WINDOW_DAYS) return null;

  const timing =
    daysUntil === 0
      ? 'Vandaag is het zover — check of alles vol is voor je vertrekt.'
      : daysUntil === 1
        ? 'De wedstrijd is morgen: hang alles vanavond aan de lader.'
        : `Nog ${daysUntil} dagen. Laad uiterlijk de avond vóór de wedstrijd op, dan is er tijd over als er iets tegenzit.`;

  return {
    goalId: goal.id,
    raceName: goal.name,
    daysUntil,
    devices: chargeDevicesForGoal(goal, profile),
    timing,
    urgent: daysUntil <= 1,
  };
}

/** Eén regel context voor de AI-coach, zodat het dagbericht eraan herinnert. */
export function buildRacePrepCoachText(advice: RacePrepAdvice | null): string | null {
  if (!advice) return null;
  const wanneer =
    advice.daysUntil === 0 ? 'vandaag' : advice.daysUntil === 1 ? 'morgen' : `over ${advice.daysUntil} dagen`;
  return `WEDSTRIJDVOORBEREIDING: ${advice.raceName} is ${wanneer}. Herinner de atleet er kort (één zin, praktisch) aan om zijn apparatuur op te laden: ${advice.devices.map((d) => d.label).join(', ')}. ${advice.timing}`;
}
