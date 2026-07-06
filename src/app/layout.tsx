import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import './globals.css';
import Navigation from '@/components/Navigation';
import PWARegister from '@/components/PWARegister';
import LockScreen from '@/components/LockScreen';
import OnboardingWizard from '@/components/OnboardingWizard';

export const metadata: Metadata = {
  title: 'My Sport Coach AI',
  description: 'Jouw persoonlijke AI-trainingscoach voor triatlon',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'My Sport Coach AI',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#000000',
  viewportFit: 'cover',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Toegangsslot (voordeur). Is er geen code ingesteld, dan is de app altijd
  // ontgrendeld; het echte kostenslot zit in middleware.ts op de API-routes.
  const code = process.env.APP_ACCESS_CODE;
  const unlocked = !code || (await cookies()).get('sc_access')?.value === code;

  return (
    <html lang="nl">
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icons/icon-512.png" />
      </head>
      <body className="antialiased">
        {unlocked ? (
          <>
            <main className="max-w-lg mx-auto min-h-screen pt-safe pb-safe">
              {children}
            </main>
            <Navigation />
            <PWARegister />
            <OnboardingWizard />
          </>
        ) : (
          <LockScreen />
        )}
      </body>
    </html>
  );
}
