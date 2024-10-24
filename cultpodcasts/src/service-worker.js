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
    const clickedNotification = event.notification;
    clickedNotification.close();
    if (!event.action) {
        event.respondWith(Response.redirect('/'));
        return;
    }
    switch (event.action) {
        case 'discover':
            event.respondWith(Response.redirect('/discovery'));
            break;
        default:
            event.respondWith(Response.redirect('/'));
            break;
    }
});


importScripts('./ngsw-worker-dist.js');
