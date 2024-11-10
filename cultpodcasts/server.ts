import { renderApplication } from "@angular/platform-server";
import { KVNamespace, R2Bucket } from '@cloudflare/workers-types';
import bootstrap from "./src/main.server";

interface Env {
	ASSETS: { fetch: typeof fetch };
	kv: KVNamespace;
	content: R2Bucket;
}

// We attach the Cloudflare `fetch()` handler to the global scope
// so that we can export it when we process the Angular output.
// See tools/bundle.mjs
async function workerFetchHandler(request: Request, env: Env) {
	const url = new URL(request.url);

	const chunkPattern= /(search|podcast|subject)(\/chunk-[A-Z0-9]{8}\.js)/;
	if (chunkPattern.test(url.pathname)) {
		return new Response("Chunk detected: "+JSON.stringify(chunkPattern.exec(url.pathname)));
		//return Response.redirect(chunkPattern.exec(url.pathname)![2], 302)
	}

	console.log("render SSR", url.href);

	// Get the root `index.html` content.
	const indexUrl = new URL("/", url);
	const indexResponse = await env.ASSETS.fetch(new Request(indexUrl));
	const document = await indexResponse.text();

	const content = await renderApplication(bootstrap, {
		document,
		url: url.pathname,
		platformProviders: [
			{ provide: 'url', useValue: url },
			{ provide: 'kv', useValue: env.kv },
			{ provide: 'content', useValue: env.content }
		]
	});

	console.log("rendered SSR");
	return new Response(content, indexResponse);
}

export default {
	fetch: (request: Request, env: Env) => {
		return (globalThis as any)["__zone_symbol__Promise"].resolve(
			workerFetchHandler(request, env)
		)
	}
};
