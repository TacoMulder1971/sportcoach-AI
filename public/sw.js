// KILL SWITCH — deze service worker cachet niets meer. Hij verwijdert alle oude
// caches én zichzelf en herlaadt open vensters, zodat de app voortaan altijd
// rechtstreeks van het netwerk (Vercel) de nieuwste versie laadt.
//
// Reden: de vorige, cachende service worker liet de iOS-PWA hardnekkig op een
// oude JS-bundel hangen (nieuwe deploys werden niet opgepikt). Voor deze
// online-first app (Garmin/AI vereisen internet) is offline-cache niet nodig,
// dus verwijderen we de service worker helemaal. Belangrijk: de herlaad-actie
// wordt door de service worker zelf gedaan (client.navigate), niet door de
// pagina-code — zo bereikt hij ook een toestel dat nog de oude bundel draait.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 1. Alle caches wissen
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch {
        // caches niet beschikbaar — negeren
      }
      // 2. Deze service worker uitschrijven
      try {
        await self.registration.unregister();
      } catch {
        // negeren
      }
      // 3. Open vensters forceren te herladen → laden fris van het netwerk
      const clients = await self.clients.matchAll({ type: 'window' });
      for (const client of clients) {
        client.navigate(client.url);
      }
    })()
  );
});

// Geen fetch-handler meer: verzoeken gaan direct naar het netwerk.
