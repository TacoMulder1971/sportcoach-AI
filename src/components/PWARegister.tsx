'use client';

import { useEffect } from 'react';

export default function PWARegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let refreshing = false;
    // Bestond er al een actieve service worker bij het laden? Zo ja, dan is een
    // latere controllerchange een échte update → eenmalig herladen zodat de app
    // meteen de nieuwe code draait. Bij de allereerste installatie (geen
    // controller) niet herladen, anders ververst het eerste bezoek onnodig.
    const hadController = !!navigator.serviceWorker.controller;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing || !hadController) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Direct én telkens als de app weer op de voorgrond komt op updates checken,
        // zodat een nieuwe deploy snel wordt opgepikt (iOS PWA start vaak "resumed").
        registration.update().catch(() => {});
        const onVisible = () => {
          if (document.visibilityState === 'visible') registration.update().catch(() => {});
        };
        document.addEventListener('visibilitychange', onVisible);
      })
      .catch(() => {
        // Service worker registration failed - not critical
      });
  }, []);

  return null;
}
