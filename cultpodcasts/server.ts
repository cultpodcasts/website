import { renderApplication } from "@angular/platform-server";
import { KVNamespace, R2Bucket } from '@cloudflare/workers-types';
import bootstrap from "./src/main.server";

interface Env {
	ASSETS: { fetch: typeof fetch };
	redirects: KVNamespace;
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

	// Bootstrap SSR from the empty CSR shell — NOT prerendered `/` index.html.
	// Fetching `/` returns SSG homepage HTML + ng-state; renderApplication would
	// append a second ng-state and wrong ngh indices, aborting hydration on
	// /content/* (NG0500: expected div, found section) and leaving chrome dead.
	const indexUrl = new URL("/index.csr.html", url);
	const indexResponse = await env.ASSETS.fetch(new Request(indexUrl));
	const document = await indexResponse.text();

	// Auth-gated curator/user pages cannot SSR meaningfully (FakeAuth has no
	// session). Rendering a shell and hydrating it crashes the client
	// (nextSibling/hasAttribute on null) and leaves the page forever loading.
	// Serve the empty app shell and let the browser do CSR after Auth0 restores.
	// Privacy/terms are prerendered (SSG) and excluded in _routes.json so CF Pages
	// serves static HTML — this Worker path must not re-render those URLs.
	if (isAuthClientOnlyPath(url.pathname)) {
		console.log("CSR shell (skip SSR)", url.pathname);
		return new Response(document, indexResponse);
	}

	const content = await renderApplication(bootstrap, {
		document,
		url: url.pathname,
		platformProviders: [
			{ provide: 'url', useValue: url }
		]
	});

	console.log("rendered SSR");
	return new Response(content, indexResponse);
}

/** Routes that must boot on the client after Auth0 — never SSR with FakeAuth. */
function isAuthClientOnlyPath(pathname: string): boolean {
	return pathname === "/discovery"
		|| pathname === "/outgoingEpisodes"
		|| pathname === "/bookmarks"
		|| pathname === "/unauthorised"
		|| pathname.startsWith("/episodes/");
}

export default {
	fetch: (request: Request, env: Env) => workerFetchHandler(request, env)
};