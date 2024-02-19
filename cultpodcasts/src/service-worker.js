self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    if (event.request.method === 'POST' && url.pathname === '/share') {
        event.respondWith((async () => {
            const formData =  await event.request.formData();
            const link = formData.get('url') || '';
            const title = formData.get('title') || '';
            const text = formData.get('text') || '';
            const clientId= event.clientId;

            const client = await self.clients.get(clientId);
            if (!client) return Response.redirect("/?no-client", 511);

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
