/**
 * Canonical streaming-submit orchestration contract (CF Worker / Azure / website).
 *
 * Ownership: Api publishes; website + RedditPodcastPoster consume copies.
 *
 * Copy this TypeScript file byte-for-byte to:
 *   website/cultpodcasts/src/app/streaming-submit-contract.ts
 *
 * Copy the sibling JSON (same payload) byte-for-byte to:
 *   RedditPodcastPoster/docs/contracts/streaming-submit-contract.json
 *
 * Assert:
 *   website:  pwsh ./scripts/assert-streaming-submit-contract-copy.ps1
 *   RPP:      pwsh ./scripts/assert-streaming-submit-contract-copy.ps1
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
	"tvnzPlus",
	"itvx",
	"channel4",
	"fawesome",
	"disneyPlus",
	"discoveryPlus"
] as const;

export type StreamingServiceKey = (typeof streamingServiceKeys)[number];

export const membershipKinds = ["podcast-service", "streaming", "unrecognised"] as const;
export type MembershipKind = (typeof membershipKinds)[number];

/**
 * How prepare fetches catalogue HTML for a streaming service.
 * CF Worker env `BROWSER_RENDERING_SERVICES` lists keys that use browserRendering.
 */
export const htmlFetchModes = ["directHttp", "browserRendering"] as const;
export type HtmlFetchMode = (typeof htmlFetchModes)[number];

/** Default allowlist — ops may expand via Worker env without SPA changes. */
export const defaultBrowserRenderingServices: readonly StreamingServiceKey[] = ["itvx"];

export function htmlFetchModeForService(
	service: StreamingServiceKey,
	browserRenderingServices: readonly string[] = defaultBrowserRenderingServices
): HtmlFetchMode {
	return browserRenderingServices.includes(service) ? "browserRendering" : "directHttp";
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
	tvnzPlus: "https://www.tvnz.co.nz/shows/example-slug",
	itvx: "https://www.itv.com/watch/example-slug/1a2345/1a2345a0001",
	channel4: "https://www.channel4.com/programmes/example-slug",
	fawesome: "https://fawesome.tv/movies/1/example-slug",
	disneyPlus: "https://www.disneyplus.com/series/example-slug",
	discoveryPlus: "https://www.discoveryplus.com/show/example-slug"
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
		streamingSpecimenUrls: { ...streamingSpecimenUrls },
		streamingMembershipShapeCaseIds: streamingMembershipShapeCases.map((c) => c.id),
		streamingOrchestrationCaseIds: streamingOrchestrationCases.map((c) => c.id),
		rules: {
			podcastServicesOutOfScope: true,
			membershipReturnsService: true,
			membershipDoesNotScrape: true,
			prepareFetchesHtml: true,
			prepareFetchModeFromEnvAllowlist: true,
			submitUsesPrefetchedMetaWhenCached: true,
			azureDoesNotCallCloudflare: true
		}
	};
}
