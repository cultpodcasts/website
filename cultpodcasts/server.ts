import { renderApplication } from "@angular/platform-server";
import { KVNamespace } from '@cloudflare/workers-types';
import bootstrap from "./src/main.server";

interface Env {
	ASSETS: { fetch: typeof fetch };
	redirects: KVNamespace;
	ssrSecret: string;
}

// We attach the Cloudflare `fetch()` handler to the global scope
// so that we can export it when we process the Angular output.
// See tools/bundle.mjs
async function workerFetchHandler(request: Request, env: Env) {
	const url = new URL(request.url);

	console.log("render SSR", url.href);
	const podcastPrefix = "/podcast/";
	if (url.pathname.startsWith(podcastPrefix)) {
		const podcast = url.pathname.split("/")[2];
		const newPodcastName = await env.redirects.get(decodeURIComponent(podcast));
		if (newPodcastName) {
			const targetPath =
				podcastPrefix +
				newPodcastName +
				url.pathname.substring(podcast.length + podcastPrefix.length);
			const target = new URL(
				targetPath,
				new URL("/", url))
			console.log("redirect", url, target);
			return Response.redirect(target, 301);
		}
	}

	// Get the root `index.html` content.
	const indexUrl = new URL("/", url);
	const indexResponse = await env.ASSETS.fetch(new Request(indexUrl));
	const document = await indexResponse.text();

	const content = await renderApplication(bootstrap, {
		document,
		url: url.pathname,
		platformProviders: [
			{ provide: 'url', useValue: url },
			{ provide: 'ssrSecret', useValue: env.ssrSecret }
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
