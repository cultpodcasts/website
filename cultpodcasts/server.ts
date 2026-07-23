import { renderApplication } from "@angular/platform-server";
import { KVNamespace, R2Bucket } from '@cloudflare/workers-types';
import bootstrap from "./src/main.server";
import { HOMEPAGE_SSR_DATA } from "./src/app/homepage-ssr.token";
import { PreProcessedHomepage } from "./src/app/preprocessed-homepage.interface";

interface Env {
	ASSETS: { fetch: typeof fetch };
	redirects: KVNamespace;
	Content?: R2Bucket;
}

async function loadHomepageSsr(env: Env): Promise<PreProcessedHomepage | null> {
	if (!env.Content) {
		return null;
	}
	try {
		const object = await env.Content.get("homepage-ssr");
		if (!object) {
			return null;
		}
		return await object.json<PreProcessedHomepage>();
	} catch (error) {
		console.error("Failed to read R2 homepage-ssr", error);
		return null;
	}
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

	const homepageSsr =
		url.pathname === "/" || url.pathname === ""
			? await loadHomepageSsr(env)
			: null;

	const content = await renderApplication(bootstrap, {
		document,
		url: url.pathname,
		platformProviders: [
			{ provide: 'url', useValue: url },
			{ provide: HOMEPAGE_SSR_DATA, useValue: homepageSsr }
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
