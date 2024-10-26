self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    if (event.request.method === 'POST' && url.pathname === '/share') {
        event.respondWith(Response.redirect('/'))
        event.waitUntil(async function () {
            const formData = await event.request.formData();
            const text = formData.get('text') || '';
            const clientId = event.resultingClientId || event.clientId;
            setTimeout(async () => {
                const client = await self.clients.get(clientId);
                client.postMessage({
                    msg: "podcast-share",
                    url: text,
                });
            }, 2000)
        }())
    } else {
        return;
    }
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    if (clients.openWindow) {
        if (event.notification && event.notification.data && event.notification.data.url) {
            event.waitUntil(clients.openWindow(event.notification.data.url));
        } else {
            event.waitUntil(clients.openWindow("/"));
        }
    }
});

importScripts('./ngsw-worker-dist.js');
