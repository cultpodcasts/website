/**
 * Canonical streaming-submit orchestration contract (CF Worker / Azure / website).
 *
 * Ownership: Api publishes.
 *
 * Preferred distribution: GitHub Packages `@cultpodcasts/streaming-submit-contract`
 * (staging + production) via Workers Builds — see `docs/contract-publish.md`.
 *
 * Legacy byte-copies (until consumers switch to the package):
 *   website/cultpodcasts/src/app/streaming-submit-contract.ts
 *   RedditPodcastPoster/docs/contracts/streaming-submit-contract.json
 *   Assert: pwsh ./scripts/assert-streaming-submit-contract-copy.ps1
 *
 * Podcast-service platforms (Spotify / Apple / YouTube) are out of scope — APIs, not scrapers.
 * This contract covers streaming ServiceKeys only.
 */
export const STREAMING_SUBMIT_CONTRACT_COPY_FROM =
	"Api/tests/fixtures/streaming-submit-contract.ts" as const;

export const STREAMING_SUBMIT_CONTRACT_JSON_COPY_FROM =
	"Api/tests/fixtures/streaming-submit-contract.json" as const;

/** Wire values — must match RedditPodcastPoster ServiceKeys for streaming hosts. */
export const streamingServiceKeys = [
	"bbcSounds",
	"bbcIplayer",
	"internetArchive",
	"vimeo",
	"netflix",
	"amazonPrime",
	"paramountPlus",
	"hboMax",
	"playSuisse",
	"playRts",
	"tvnzPlus",
	"itvx",
	"channel4",
	"fawesome",
	"disneyPlus",
	"bitchute",
	"tubi",
	"discoveryPlus",
	"franceTv",
	"arte",
	"hulu",
	"peacock",
	"appleTvPlus",
	"zdf",
	"ard",
	"canalPlus"
] as const;

export type StreamingServiceKey = (typeof streamingServiceKeys)[number];

export const membershipKinds = ["podcast-service", "streaming", "unrecognised"] as const;
export type MembershipKind = (typeof membershipKinds)[number];

/**
 * How prepare fetches catalogue HTML for a streaming service.
 * Worker secret `browserRenderingServices` is a CSV of keys that use browserRendering
 * (callers split before htmlFetchModeForService). Prefer {@link scrapeProfiles} for
 * both mode and geo region; the secret remains a legacy overlay that can force BR.
 */
export const htmlFetchModes = ["directHttp", "browserRendering"] as const;
export type HtmlFetchMode = (typeof htmlFetchModes)[number];

/**
 * Logical scrape geo for prepare HTML fetch.
 * `default` = run on the edge Api Worker (no regional service binding).
 * `us` / `uk` / `de` = dispatch to a placed scrape Worker (Phase 1: `us` only; further regions only if soft-wall proven).
 */
export const scrapeRegions = ["default", "us", "uk", "de"] as const;
export type ScrapeRegion = (typeof scrapeRegions)[number];

export type ScrapeProfile = {
	mode: HtmlFetchMode;
	region: ScrapeRegion;
};

/**
 * Canonical mode + region per service. Missing key → {@link resolveScrapeProfile}
 * uses `region: default` and the BR allowlist for mode.
 */
export const scrapeProfiles: Readonly<Partial<Record<StreamingServiceKey, ScrapeProfile>>> = {
	/** US geo soft-wall: placed Worker fetch (not BR — BR is not region-pinnable). */
	hulu: { mode: "directHttp", region: "us" },
	peacock: { mode: "directHttp", region: "us" }
};

/**
 * Rewrite signed-in / soft-wall catalogue paths to public SEO twins before
 * regional scrape (`SCRAPE_US`). Applied once in Api `scrapeViaRegionalWorker`
 * (prepare + survey). Playback / app shells are not rewritten.
 */
export type PrepareUrlRewriteSpec = {
	/** Absolute-path prefix of the soft-wall / signed-in catalogue URL. */
	fromPathPrefix: string;
	/** Absolute-path prefix of the public SEO twin. */
	toPathPrefix: string;
	/** Optional first catalogue-kind segment remaps (e.g. movie → movies). */
	segmentRemaps?: Readonly<Record<string, string>>;
	/** Host must be this registrable domain or a subdomain of it. */
	hostSuffix: string;
};

export const prepareUrlRewrites: Readonly<
	Partial<Record<StreamingServiceKey, PrepareUrlRewriteSpec>>
> = {
	peacock: {
		fromPathPrefix: "/watch/asset/",
		toPathPrefix: "/watch-online/",
		segmentRemaps: { movie: "movies" },
		hostSuffix: "peacocktv.com"
	}
};

export type PrepareFetchUrlResolution = {
	requestUrl: string;
	/** Non-null when a {@link prepareUrlRewrites} rule changed the fetch URL. */
	rewrittenTo: string | null;
};

/**
 * Resolve the URL to fetch for prepare / regional scrape.
 * Missing rewrite spec → return input unchanged.
 */
export function resolvePrepareFetchUrl(
	service: string,
	url: string
): PrepareFetchUrlResolution {
	const spec = prepareUrlRewrites[service.trim() as StreamingServiceKey];
	if (!spec) {
		return { requestUrl: url, rewrittenTo: null };
	}
	const rewritten = applyPathPrefixRewrite(url, spec);
	if (!rewritten) {
		return { requestUrl: url, rewrittenTo: null };
	}
	return { requestUrl: rewritten, rewrittenTo: rewritten };
}

const PREPARE_REWRITE_UUID =
	/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const PREPARE_REWRITE_NUMERIC_ID = /^\d{6,}$/;

function prepareRewriteHostOk(hostname: string, hostSuffix: string): boolean {
	const h = hostname.toLowerCase();
	const suffix = hostSuffix.toLowerCase();
	return h === suffix || h.endsWith(`.${suffix}`);
}

function prepareRewriteAssetId(segment: string): boolean {
	return PREPARE_REWRITE_NUMERIC_ID.test(segment) || PREPARE_REWRITE_UUID.test(segment);
}

function prepareRewriteCatalogueSegment(segment: string): boolean {
	return segment.length > 0 && !segment.includes(".");
}

/** Peacock (and similar): `/from/...` → `/to/...` with tv|movies catalogue shape. */
function applyPathPrefixRewrite(url: string, spec: PrepareUrlRewriteSpec): string | null {
	let u: URL;
	try {
		u = new URL(url);
	} catch {
		return null;
	}
	if (!prepareRewriteHostOk(u.hostname, spec.hostSuffix)) {
		return null;
	}

	const fromParts = spec.fromPathPrefix.split("/").filter(Boolean);
	const toParts = spec.toPathPrefix.split("/").filter(Boolean);
	const parts = u.pathname.split("/").filter(Boolean);
	if (parts.length < fromParts.length + 2) {
		return null;
	}
	for (let i = 0; i < fromParts.length; i++) {
		if (parts[i].toLowerCase() !== fromParts[i].toLowerCase()) {
			return null;
		}
	}

	const after = parts.slice(fromParts.length);
	// after: {kind}/{slug}/{id}[ /seasons/n/episodes/ep-slug/ep-id ]
	if (
		after.length < 3 ||
		!prepareRewriteCatalogueSegment(after[1]) ||
		!prepareRewriteAssetId(after[2])
	) {
		return null;
	}

	const remaps = spec.segmentRemaps ?? {};
	const rawKind = after[0].toLowerCase();
	const kind = (remaps[rawKind] ?? rawKind).toLowerCase();
	if (kind !== "tv" && kind !== "movies") {
		return null;
	}

	const seoAfter = [kind, ...after.slice(1)];
	if (kind === "movies") {
		if (seoAfter.length !== 3) {
			return null;
		}
	} else if (seoAfter.length === 3) {
		// series hub
	} else if (
		!(
			seoAfter.length >= 8 &&
			seoAfter[3].toLowerCase() === "seasons" &&
			prepareRewriteCatalogueSegment(seoAfter[4]) &&
			seoAfter[5].toLowerCase() === "episodes" &&
			prepareRewriteCatalogueSegment(seoAfter[6]) &&
			prepareRewriteAssetId(seoAfter[7])
		)
	) {
		return null;
	}

	const out = new URL(u.href);
	out.pathname = `/${[...toParts, ...seoAfter].join("/")}`;
	out.search = "";
	out.hash = "";
	return out.toString();
}

/** @deprecated Prefer {@link resolvePrepareFetchUrl}; kept for Peacock-focused callers/tests. */
export function toPeacockWatchOnlineUrl(url: string): string | null {
	return resolvePrepareFetchUrl("peacock", url).rewrittenTo;
}

/** Default allowlist — ops may expand via Worker env without SPA changes. */
export const defaultBrowserRenderingServices: readonly StreamingServiceKey[] = ["itvx"];

/**
 * Resolve prepare scrape mode and geo. Profile wins for region; mode is profile
 * mode, or BR allowlist / secret overlay when no profile (or when secret forces BR).
 */
export function resolveScrapeProfile(
	service: string,
	browserRenderingServices: readonly string[] = defaultBrowserRenderingServices
): ScrapeProfile {
	const profile = scrapeProfiles[service as StreamingServiceKey];
	const forceBr = browserRenderingServices.includes(service);
	if (profile) {
		return {
			mode: forceBr || profile.mode === "browserRendering" ? "browserRendering" : profile.mode,
			region: profile.region
		};
	}
	return {
		mode: forceBr ? "browserRendering" : "directHttp",
		region: "default"
	};
}

export function htmlFetchModeForService(
	service: string,
	browserRenderingServices: readonly string[] = defaultBrowserRenderingServices
): HtmlFetchMode {
	return resolveScrapeProfile(service, browserRenderingServices).mode;
}

/** Stable specimen ids for contract / fake-api (not production brands). */
export const streamingSubmitIds = {
	podcastId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
	otherPodcastId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
	episodeId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
} as const;

export const streamingSubmitNames = {
	extractedShow: "Extracted Show",
	storedShow: "Stored Show"
} as const;

/** One specimen URL per streaming ServiceKey (matcher-shaped, not live catalogue). */
export const streamingSpecimenUrls: Record<StreamingServiceKey, string> = {
	bbcSounds: "https://www.bbc.co.uk/sounds/play/p0examplesound",
	bbcIplayer: "https://www.bbc.co.uk/iplayer/episode/m001example/example-slug",
	internetArchive: "https://archive.org/details/example-item",
	vimeo: "https://vimeo.com/999000111",
	netflix: "https://www.netflix.com/watch/80057281",
	amazonPrime: "https://www.primevideo.com/detail/0EXAMPLEID00",
	paramountPlus: "https://www.paramountplus.com/shows/example-slug/",
	hboMax: "https://www.max.com/shows/example-slug",
	playSuisse: "https://www.playsuisse.ch/watch/2261604",
	playRts: "https://www.rts.ch/play/tv/example-show/video/example-episode",
	tvnzPlus: "https://www.tvnz.co.nz/shows/example-slug",
	itvx: "https://www.itv.com/watch/example-slug/1a2345/1a2345a0001",
	channel4: "https://www.channel4.com/programmes/example-slug",
	fawesome: "https://fawesome.tv/movies/1/example-slug",
	disneyPlus: "https://www.disneyplus.com/series/example-slug",
	bitchute: "https://www.bitchute.com/video/exampleVideoId",
	tubi: "https://tubitv.com/movies/1/example-slug",
	discoveryPlus: "https://www.discoveryplus.com/show/example-slug",
	franceTv: "https://www.france.tv/slash/example-show/8847336-example-episode.html",
	arte: "https://www.arte.tv/en/videos/000000-001-A/example-slug/",
	hulu: "https://www.hulu.com/series/example-slug",
	peacock: "https://www.peacocktv.com/watch-online/movies/example-slug/f45c2853-4230-3910-aa53-51ac37f5a788",
	appleTvPlus: "https://tv.apple.com/us/show/example-slug/umc.cmc.exampleid000000000000",
	zdf: "https://www.zdf.de/serien/example-slug",
	ard: "https://www.ardmediathek.de/video/Y3JpZDovL2V4YW1wbGUvaWQ",
	canalPlus: "https://www.canalplus.com/series/example-slug/h/12345_67890"
};

export type StreamingMembershipKnown = {
	known: true;
	podcastId: string;
	podcastName: string;
	kind: "streaming";
	service: StreamingServiceKey;
};

export type StreamingMembershipUnknown = {
	known: false;
	kind: "streaming";
	service: StreamingServiceKey;
	/** Present only after prepare/extract — lookup membership alone omits it. */
	podcastName?: string | null;
	ambiguous?: false;
};

export type StreamingMembershipAmbiguous = {
	known: false;
	ambiguous: true;
	kind: "streaming";
	service: StreamingServiceKey;
	podcastIds: string[];
};

export type StreamingMembershipResponse =
	| StreamingMembershipKnown
	| StreamingMembershipUnknown
	| StreamingMembershipAmbiguous;

export type StreamingPrepareResponse = {
	service: StreamingServiceKey;
	htmlFetchMode: HtmlFetchMode;
	podcastName: string | null;
	title: string | null;
};

export type StreamingOrchestrationStep =
	| {
			name: "lookup";
			method: "GET";
			path: "/submit/lookup";
			response: StreamingMembershipResponse;
	  }
	| {
			name: "prepare";
			method: "POST";
			path: "/submit/prepare";
			htmlFetchMode: HtmlFetchMode;
			response: StreamingPrepareResponse;
	  }
	| {
			name: "submit";
			method: "POST";
			path: "/submit";
			usesPrefetchedMeta: boolean;
			responseStatus: 200;
	  };

export type StreamingOrchestrationCase = {
	id: string;
	rule: string;
	service: StreamingServiceKey;
	url: string;
	htmlFetchMode: HtmlFetchMode;
	steps: StreamingOrchestrationStep[];
};

function unknownMembership(service: StreamingServiceKey): StreamingMembershipUnknown {
	return { known: false, kind: "streaming", service };
}

function prepareResponse(
	service: StreamingServiceKey,
	mode: HtmlFetchMode
): StreamingPrepareResponse {
	return {
		service,
		htmlFetchMode: mode,
		podcastName: streamingSubmitNames.extractedShow,
		title: streamingSubmitNames.extractedShow
	};
}

/**
 * Full permutation matrix: every streaming ServiceKey × unknown membership →
 * prepare (fetch mode from default BR allowlist) → submit with prefetched meta.
 */
export const streamingOrchestrationCases: StreamingOrchestrationCase[] =
	streamingServiceKeys.map((service) => {
		const mode = htmlFetchModeForService(service);
		const url = streamingSpecimenUrls[service];
		return {
			id: `stream-${service}-unknown-prepare-submit`,
			rule: `When unknown streaming URL for ${service}, lookup returns service without scrape; prepare uses ${mode}; submit consumes prefetched meta.`,
			service,
			url,
			htmlFetchMode: mode,
			steps: [
				{
					name: "lookup",
					method: "GET",
					path: "/submit/lookup",
					response: unknownMembership(service)
				},
				{
					name: "prepare",
					method: "POST",
					path: "/submit/prepare",
					htmlFetchMode: mode,
					response: prepareResponse(service, mode)
				},
				{
					name: "submit",
					method: "POST",
					path: "/submit",
					usesPrefetchedMeta: true,
					responseStatus: 200
				}
			]
		};
	});

/** Membership shape arms every streaming service must support (wire contract). */
export const streamingMembershipShapeArms = ["known", "unknown", "ambiguous"] as const;
export type StreamingMembershipShapeArm = (typeof streamingMembershipShapeArms)[number];

export function streamingMembershipShape(
	arm: StreamingMembershipShapeArm,
	service: StreamingServiceKey
): StreamingMembershipResponse {
	switch (arm) {
		case "known":
			return {
				known: true,
				podcastId: streamingSubmitIds.podcastId,
				podcastName: streamingSubmitNames.storedShow,
				kind: "streaming",
				service
			};
		case "unknown":
			return unknownMembership(service);
		case "ambiguous":
			return {
				known: false,
				ambiguous: true,
				kind: "streaming",
				service,
				podcastIds: [streamingSubmitIds.podcastId, streamingSubmitIds.otherPodcastId]
			};
	}
}

/** Cartesian product: every service × every membership arm (for business-rule / fake coverage). */
export const streamingMembershipShapeCases: Array<{
	id: string;
	arm: StreamingMembershipShapeArm;
	service: StreamingServiceKey;
	body: StreamingMembershipResponse;
}> = streamingServiceKeys.flatMap((service) =>
	streamingMembershipShapeArms.map((arm) => ({
		id: `membership-${service}-${arm}`,
		arm,
		service,
		body: streamingMembershipShape(arm, service)
	}))
);

/** Fake-API: lookup 200 by specimen URL (unknown streaming + service). */
export const streamingLookupByUrl: Record<string, StreamingMembershipUnknown> =
	Object.fromEntries(
		streamingServiceKeys.map((service) => [
			streamingSpecimenUrls[service],
			unknownMembership(service)
		])
	) as Record<string, StreamingMembershipUnknown>;

/**
 * JSON-serialisable snapshot for RedditPodcastPoster (and tooling).
 * Keep in sync with streaming-submit-contract.json via Api business-rule test.
 */
export function streamingSubmitContractJsonPayload() {
	return {
		version: 1,
		copyFromTs: STREAMING_SUBMIT_CONTRACT_COPY_FROM,
		copyFromJson: STREAMING_SUBMIT_CONTRACT_JSON_COPY_FROM,
		streamingServiceKeys: [...streamingServiceKeys],
		membershipKinds: [...membershipKinds],
		htmlFetchModes: [...htmlFetchModes],
		defaultBrowserRenderingServices: [...defaultBrowserRenderingServices],
		scrapeRegions: [...scrapeRegions],
		scrapeProfiles: { ...scrapeProfiles },
		prepareUrlRewrites: { ...prepareUrlRewrites },
		streamingSpecimenUrls: { ...streamingSpecimenUrls },
		streamingMembershipShapeCaseIds: streamingMembershipShapeCases.map((c) => c.id),
		streamingOrchestrationCaseIds: streamingOrchestrationCases.map((c) => c.id),
		rules: {
			podcastServicesOutOfScope: true,
			membershipReturnsService: true,
			membershipDoesNotScrape: true,
			prepareFetchesHtml: true,
			prepareFetchModeFromEnvAllowlist: true,
			prepareUrlRewriteBeforeRegionalScrape: true,
			submitUsesPrefetchedMetaWhenCached: true,
			azureDoesNotCallCloudflare: true
		}
	};
}
