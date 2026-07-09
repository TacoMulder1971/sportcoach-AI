'use client';

import { useEffect } from 'react';

export default function PWARegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // We registreren geen service worker meer: de vorige, cachende SW liet de
    // PWA op oude code hangen. Ruim een eventueel nog geregistreerde SW + caches
    // op zodat de app voortaan altijd de nieuwste versie van het netwerk laadt.
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => regs.forEach((r) => r.unregister()))
      .catch(() => {});

    if ('caches' in window) {
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .catch(() => {});
    }
  }, []);

  return null;
}
