import type { Viewport } from 'next';
import CoachContent from '@/components/CoachContent';

// Donker thema (zoals Home/Schema) → statusbalk/notch zwart op deze route.
export const viewport: Viewport = {
  themeColor: '#000000',
};

export default function CoachPage() {
  return <CoachContent />;
}
