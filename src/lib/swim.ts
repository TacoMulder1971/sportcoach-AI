// Helpers voor zwem-varianten (binnen/buiten/openwater).
import { SwimVariant, ActivitySwimVariants } from './types';

/**
 * Bepaalt de zwem-variant van een activiteit.
 * Volgorde: expliciete user-override > door Garmin afgeleide variant > 'zwembad_binnen'.
 */
export function swimVariantForActivity(
  activity: { id: string | number; swimVariant?: SwimVariant },
  variants: ActivitySwimVariants,
): SwimVariant {
  const override = variants[String(activity.id)];
  if (override) return override;
  return activity.swimVariant ?? 'zwembad_binnen';
}
