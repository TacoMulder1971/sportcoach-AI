import { Suspense } from 'react';
import SchemaContent from '@/components/SchemaContent';

export default function SchemaPage() {
  return (
    <Suspense fallback={null}>
      <SchemaContent />
    </Suspense>
  );
}
