import type { Viewport } from 'next';
import { Suspense } from 'react';
import SchemaContent from '@/components/SchemaContent';

// Donker thema (zoals de Home-tab) → statusbalk/notch zwart op deze route.
export const viewport: Viewport = {
  themeColor: '#000000',
};

export default function SchemaPage() {
  return (
    <Suspense fallback={null}>
      <SchemaContent />
    </Suspense>
  );
}
