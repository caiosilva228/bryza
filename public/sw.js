self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request));
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  event.waitUntil((async () => {
    let payload;
    try {
      payload = event.data.json();
    } catch {
      payload = {
        title: 'Nova notificação Bryza',
        body: event.data.text(),
        url: '/embaixador/dashboard',
      };
    }

    const windows = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });
    const visibleWindow = windows.find((client) => client.visibilityState === 'visible');

    if (visibleWindow) {
      visibleWindow.postMessage({
        source: 'bryza-push',
        payload,
      });
      return;
    }

    await self.registration.showNotification(
      payload.title || 'Nova comissão liberada!',
      {
        body: payload.body || 'Você recebeu uma nova comissão.',
        icon: '/app-icon-192.png',
        badge: '/app-icon-192.png',
        tag: payload.id ? `commission-${payload.id}` : 'bryza-commission',
        renotify: true,
        requireInteraction: false,
        vibrate: [180, 80, 180, 80, 260],
        data: {
          id: payload.id,
          url: payload.url || '/embaixador/comissoes',
        },
      },
    );
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(
    event.notification.data?.url || '/embaixador/comissoes',
    self.location.origin,
  ).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });
    const appWindow = windows.find((client) =>
      new URL(client.url).origin === self.location.origin
    );

    if (appWindow) {
      await appWindow.focus();
      if ('navigate' in appWindow) await appWindow.navigate(targetUrl);
      return;
    }

    await self.clients.openWindow(targetUrl);
  })());
});
