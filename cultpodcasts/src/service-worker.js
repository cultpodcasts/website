self.addEventListener('fetch', event => {
    // const url = new URL(event.request.url);
    // if (event.request.method === 'POST' && url.pathname === '/share') {
    //     event.respondWith((async () => {
    //         const formData = await event.request.formData();
    //         const link = formData.get('link') || '';

    //         if (!event.clientId) return Response.redirect("/no-client-id", 510);

    //         // Get the client.
    //         const client = await self.clients.get(event.clientId);
    //         // Exit early if we don't get the client.
    //         // Eg, if it closed.
    //         if (!client) return Response.redirect("/no-client", 511);

    //         // Send a message to the client.
    //         client.postMessage({
    //             msg: "podcast-share",
    //             url: link,
    //         });

    //         return Response.redirect("/", 303);
    //     })());
    // } else {
    //     return Response.redirect("/", 512)
    // }

    if ((e.request.url.endsWith('/share')) && (e.request.method === 'POST')) {
        return e.respondWith((async () => {
            // This function is async.
            const formData = await fetchEvent.request.formData();
            // Do something with the URL…
            const url = formData.get('url');
            // Store the URL, process it, communicate it to the clients…
            // You need to redirect the user somewhere, since the path
            // /receive-shares does not actually exist.
            return Response.redirect('/', 303);
        })())
    }
});

importScripts('./ngsw-worker.js');
