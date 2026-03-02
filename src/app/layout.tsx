import type { Metadata, Viewport } from 'next';
import './globals.css';
import Navigation from '@/components/Navigation';
import PWARegister from '@/components/PWARegister';

export const metadata: Metadata = {
  title: 'TriCoach AI',
  description: 'Jouw persoonlijke AI-trainingscoach voor triatlon',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'TriCoach AI',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#2563eb',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="antialiased">
        <main className="max-w-lg mx-auto min-h-screen pb-safe">
          {children}
        </main>
        <Navigation />
        <PWARegister />
      </body>
    </html>
  );
}
