importScripts('./ngsw-worker.js');

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    if (event.request.method === 'POST' && url.pathname === '/share') {
        event.respondWith((async () => {
            const formData = await event.request.formData();
            const link = formData.get('link') || '';

            if (!event.clientId) return Response.redirect("/no-client-id", 500);

            // Get the client.
            const client = await self.clients.get(event.clientId);
            // Exit early if we don't get the client.
            // Eg, if it closed.
            if (!client) return Response.redirect("/no-client", 500);

            // Send a message to the client.
            client.postMessage({
                msg: "podcast-share",
                url: link,
            });

            return Response.redirect("/", 303);
        })());
    }
});
