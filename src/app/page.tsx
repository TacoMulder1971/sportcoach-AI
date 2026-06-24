import type { Viewport } from 'next';
import HomeContent from '@/components/HomeContent';

export const viewport: Viewport = {
  themeColor: '#000000',
};

export default function Home() {
  return <HomeContent />;
}
