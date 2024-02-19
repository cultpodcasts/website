self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    if (event.request.method === 'POST' && url.pathname === '/share') {
        event.respondWith((async () => {
            const formData = await event.request.formData();
            const link = formData.get('url') || '';

            // Get the client.
            const client = await self.clients.get(event.clientId);
            // Exit early if we don't get the client.
            // Eg, if it closed.
            if (!client) return Response.redirect("/?no-client", 511);

            // Send a message to the client.
            client.postMessage({
                msg: "podcast-share",
                url: link,
            });

            return Response.redirect("/", 303);
        })());
    } else {
        return Response.redirect("/", 512)
    }


});

importScripts('./ngsw-worker.js');
