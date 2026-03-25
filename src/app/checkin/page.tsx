'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
export default function CheckInPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/coach'); }, [router]);
  return null;
}
