/**
 * Canonical submit-URL case table. API business-rule tests execute Worker handlers
 * against these cases; they are the contract.
 *
 * Copy this file byte-for-byte to:
 *   website/cultpodcasts/src/app/submit-url-contract.ts
 * Do not invent a parallel API on the website. Playwright fake-api is a thin adapter.
 */
export const SUBMIT_URL_CONTRACT_COPY_FROM =
	"Api/tests/fixtures/submit-url-contract.ts" as const;

export const submitUrlIds = {
	pageId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
	otherId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
	pickId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
	episodeId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"
} as const;

export const submitUrlNames = {
	extractedShow: "Extracted Show",
	storedShow: "Stored Show",
	typedShow: "Typed Show",
	pageShow: "Page Show",
	otherShow: "Other Show",
	duplicateSeries: "Duplicate Series"
} as const;

export const submitUrlUrls = {
	general: "https://open.spotify.com/episode/0exampleepisode00",
	known: "https://open.spotify.com/episode/knownunique0001",
	netflix: "https://www.netflix.com/watch/80057281",
	vimeo: "https://vimeo.com/999000111"
} as const;

export type SubmitUrlActor = "anonymous" | "member-submit" | "curator";

export type SubmitUrlBackend = "none" | "d1" | "azure";

export type SubmitUrlWorkerRoute = "lookup" | "submit" | "podcast";

export type SubmitUrlHttpStep = {
	method: "GET" | "POST";
	path: string;
	requestBody: Record<string, unknown> | null;
	responseStatus: number;
	responseBody: unknown;
	backend: SubmitUrlBackend;
	workerRoute: SubmitUrlWorkerRoute;
	xOrigin?: "true";
};

export type SubmitUrlClientExpect = {
	shouldCallLookup: boolean;
	/** Lookup body Curator helpers receive (null when the actor never looks up). */
	lookup: Record<string, unknown> | null;
	seriesForm: string | null;
	pagePodcastId: string | null;
	pagePodcastName: string | null;
	pageDropPlanKind: "submit-to-page" | "confirm-other-series" | null;
	confirmAccepted: boolean | null;
	persistBodies: Array<{
		url: string;
		podcastId?: string;
		podcastName?: string;
	}>;
};

export type SubmitUrlCase = {
	id: 1 | 2 | 3 | 4 | 5 | 6 | 7;
	rule: string;
	actor: SubmitUrlActor;
	url: string;
	client: SubmitUrlClientExpect;
	http: SubmitUrlHttpStep[];
};

export const d1SubmitOk = { success: "Submitted" } as const;

export const lookupUnauthorised = { error: "Unauthorised" } as const;
export const lookupForbidden = { error: "Forbidden" } as const;

export function azureSubmitCreated(podcastId: string) {
	return {
		success: {
			episode: "Created",
			podcast: "Created",
			episodeId: submitUrlIds.episodeId,
			podcastId
		}
	};
}

export const lookupKnownUnique = {
	known: true,
	podcastId: submitUrlIds.pageId,
	podcastName: submitUrlNames.storedShow,
	kind: "podcast-service"
} as const;

export const lookupStreamingExtracted = {
	known: false,
	kind: "streaming",
	podcastName: submitUrlNames.extractedShow
} as const;

export const lookupOtherSeries = {
	known: true,
	podcastId: submitUrlIds.otherId,
	podcastName: submitUrlNames.otherShow,
	kind: "streaming"
} as const;

export const lookupUnknownPodcastService = {
	known: false,
	kind: "podcast-service"
} as const;

/** Fake-API lookup 200 bodies keyed by episode URL (Submitter/Curator). */
export const submitUrlLookupByUrl: Record<string, Record<string, unknown>> = {
	[submitUrlUrls.general]: lookupUnknownPodcastService,
	[submitUrlUrls.known]: lookupKnownUnique,
	[submitUrlUrls.netflix]: lookupStreamingExtracted,
	[submitUrlUrls.vimeo]: lookupOtherSeries
};

export const submitUrlPodcastByKey: Record<
	string,
	{ status: number; body: unknown }
> = {
	[submitUrlNames.typedShow]: {
		status: 200,
		body: { id: submitUrlIds.pageId, name: submitUrlNames.typedShow }
	},
	[submitUrlNames.pageShow]: {
		status: 200,
		body: { id: submitUrlIds.pageId, name: submitUrlNames.pageShow }
	},
	[submitUrlIds.pageId]: {
		status: 200,
		body: {
			id: submitUrlIds.pageId,
			name: submitUrlNames.duplicateSeries,
			spotifyId: "sp-page-row"
		}
	},
	[submitUrlIds.pickId]: {
		status: 200,
		body: {
			id: submitUrlIds.pickId,
			name: submitUrlNames.duplicateSeries,
			spotifyId: "sp-picked-row"
		}
	}
};

export function actorIsCurator(actor: SubmitUrlActor): boolean {
	return actor === "curator";
}

export function lookupDenialForActor(
	actor: SubmitUrlActor
): { status: number; body: object } | null {
	if (actor === "anonymous") {
		return { status: 401, body: lookupUnauthorised };
	}
	return null;
}

function lookupPath(url: string): string {
	return `/submit/lookup?url=${encodeURIComponent(url)}`;
}

function podcastPath(key: string): string {
	return `/podcast/${encodeURIComponent(key)}`;
}

export const submitUrlCases: SubmitUrlCase[] = [
	{
		id: 1,
		rule: "Case 1 of 7 — signed out: homepage general drop POSTs /submit only (D1), never GET /submit/lookup",
		actor: "anonymous",
		url: submitUrlUrls.general,
		client: {
			shouldCallLookup: false,
			lookup: null,
			seriesForm: null,
			pagePodcastId: null,
			pagePodcastName: null,
			pageDropPlanKind: null,
			confirmAccepted: null,
			persistBodies: [{ url: submitUrlUrls.general }]
		},
		http: [
			{
				method: "POST",
				path: "/submit",
				requestBody: { url: submitUrlUrls.general },
				responseStatus: 200,
				responseBody: d1SubmitOk,
				backend: "d1",
				workerRoute: "submit"
			}
		]
	},
	{
		id: 2,
		rule: "Case 2 of 7 — Curator: homepage drop looks up then POSTs extracted podcastName",
		actor: "curator",
		url: submitUrlUrls.netflix,
		client: {
			shouldCallLookup: true,
			lookup: lookupStreamingExtracted,
			seriesForm: null,
			pagePodcastId: null,
			pagePodcastName: null,
			pageDropPlanKind: null,
			confirmAccepted: null,
			persistBodies: [
				{ url: submitUrlUrls.netflix, podcastName: submitUrlNames.extractedShow }
			]
		},
		http: [
			{
				method: "GET",
				path: lookupPath(submitUrlUrls.netflix),
				requestBody: null,
				responseStatus: 200,
				responseBody: lookupStreamingExtracted,
				backend: "azure",
				workerRoute: "lookup"
			},
			{
				method: "POST",
				path: "/submit",
				requestBody: {
					url: submitUrlUrls.netflix,
					podcastName: submitUrlNames.extractedShow
				},
				responseStatus: 200,
				responseBody: azureSubmitCreated(submitUrlIds.pageId),
				backend: "azure",
				workerRoute: "submit",
				xOrigin: "true"
			}
		]
	},
	{
		id: 3,
		rule: "Case 3 of 7 — Submitter: Add Podcast looks up then POSTs URL-only to Azure (known unique)",
		actor: "member-submit",
		url: submitUrlUrls.known,
		client: {
			shouldCallLookup: true,
			lookup: lookupKnownUnique,
			seriesForm: null,
			pagePodcastId: null,
			pagePodcastName: null,
			pageDropPlanKind: null,
			confirmAccepted: null,
			persistBodies: [{ url: submitUrlUrls.known }]
		},
		http: [
			{
				method: "GET",
				path: lookupPath(submitUrlUrls.known),
				requestBody: null,
				responseStatus: 200,
				responseBody: lookupKnownUnique,
				backend: "azure",
				workerRoute: "lookup"
			},
			{
				method: "POST",
				path: "/submit",
				requestBody: { url: submitUrlUrls.known },
				responseStatus: 200,
				responseBody: azureSubmitCreated(submitUrlIds.pageId),
				backend: "azure",
				workerRoute: "submit",
				xOrigin: "true"
			}
		]
	},
	{
		id: 4,
		rule: "Case 4 of 7 — Curator: Add Podcast streaming URL plus a series name POSTs url + podcastId + podcastName",
		actor: "curator",
		url: submitUrlUrls.netflix,
		client: {
			shouldCallLookup: true,
			lookup: lookupStreamingExtracted,
			seriesForm: submitUrlNames.typedShow,
			pagePodcastId: submitUrlIds.pageId,
			pagePodcastName: submitUrlNames.typedShow,
			pageDropPlanKind: null,
			confirmAccepted: null,
			persistBodies: [
				{
					url: submitUrlUrls.netflix,
					podcastId: submitUrlIds.pageId,
					podcastName: submitUrlNames.typedShow
				}
			]
		},
		http: [
			{
				method: "GET",
				path: lookupPath(submitUrlUrls.netflix),
				requestBody: null,
				responseStatus: 200,
				responseBody: lookupStreamingExtracted,
				backend: "azure",
				workerRoute: "lookup"
			},
			{
				method: "GET",
				path: podcastPath(submitUrlNames.typedShow),
				requestBody: null,
				responseStatus: 200,
				responseBody: {
					id: submitUrlIds.pageId,
					name: submitUrlNames.typedShow
				},
				backend: "azure",
				workerRoute: "podcast"
			},
			{
				method: "POST",
				path: "/submit",
				requestBody: {
					url: submitUrlUrls.netflix,
					podcastId: submitUrlIds.pageId,
					podcastName: submitUrlNames.typedShow
				},
				responseStatus: 200,
				responseBody: azureSubmitCreated(submitUrlIds.pageId),
				backend: "azure",
				workerRoute: "submit",
				xOrigin: "true"
			}
		]
	},
	{
		id: 5,
		rule: "Case 5 of 7 — Curator: submit to this page already on another series — No does not POST /submit",
		actor: "curator",
		url: submitUrlUrls.vimeo,
		client: {
			shouldCallLookup: true,
			lookup: lookupOtherSeries,
			seriesForm: null,
			pagePodcastId: submitUrlIds.pageId,
			pagePodcastName: submitUrlNames.pageShow,
			pageDropPlanKind: "confirm-other-series",
			confirmAccepted: false,
			persistBodies: []
		},
		http: [
			{
				method: "GET",
				path: podcastPath(submitUrlNames.pageShow),
				requestBody: null,
				responseStatus: 200,
				responseBody: {
					id: submitUrlIds.pageId,
					name: submitUrlNames.pageShow
				},
				backend: "azure",
				workerRoute: "podcast"
			},
			{
				method: "GET",
				path: lookupPath(submitUrlUrls.vimeo),
				requestBody: null,
				responseStatus: 200,
				responseBody: lookupOtherSeries,
				backend: "azure",
				workerRoute: "lookup"
			}
		]
	},
	{
		id: 6,
		rule: "Case 6 of 7 — Curator: submit to this page already on another series — Yes POSTs the page podcastId",
		actor: "curator",
		url: submitUrlUrls.vimeo,
		client: {
			shouldCallLookup: true,
			lookup: lookupOtherSeries,
			seriesForm: null,
			pagePodcastId: submitUrlIds.pageId,
			pagePodcastName: submitUrlNames.pageShow,
			pageDropPlanKind: "confirm-other-series",
			confirmAccepted: true,
			persistBodies: [
				{
					url: submitUrlUrls.vimeo,
					podcastId: submitUrlIds.pageId,
					podcastName: submitUrlNames.pageShow
				}
			]
		},
		http: [
			{
				method: "GET",
				path: podcastPath(submitUrlNames.pageShow),
				requestBody: null,
				responseStatus: 200,
				responseBody: {
					id: submitUrlIds.pageId,
					name: submitUrlNames.pageShow
				},
				backend: "azure",
				workerRoute: "podcast"
			},
			{
				method: "GET",
				path: lookupPath(submitUrlUrls.vimeo),
				requestBody: null,
				responseStatus: 200,
				responseBody: lookupOtherSeries,
				backend: "azure",
				workerRoute: "lookup"
			},
			{
				method: "POST",
				path: "/submit",
				requestBody: {
					url: submitUrlUrls.vimeo,
					podcastId: submitUrlIds.pageId,
					podcastName: submitUrlNames.pageShow
				},
				responseStatus: 200,
				responseBody: azureSubmitCreated(submitUrlIds.pageId),
				backend: "azure",
				workerRoute: "submit",
				xOrigin: "true"
			}
		]
	},
	{
		id: 7,
		rule: "Case 7 of 7 — Curator: name collision POST 409 then pick persists a second POST with podcastId",
		actor: "curator",
		url: submitUrlUrls.netflix,
		client: {
			shouldCallLookup: true,
			lookup: lookupStreamingExtracted,
			seriesForm: submitUrlNames.duplicateSeries,
			pagePodcastId: null,
			pagePodcastName: null,
			pageDropPlanKind: null,
			confirmAccepted: null,
			persistBodies: [
				{
					url: submitUrlUrls.netflix,
					podcastName: submitUrlNames.duplicateSeries
				},
				{
					url: submitUrlUrls.netflix,
					podcastId: submitUrlIds.pickId,
					podcastName: submitUrlNames.duplicateSeries
				}
			]
		},
		http: [
			{
				method: "GET",
				path: lookupPath(submitUrlUrls.netflix),
				requestBody: null,
				responseStatus: 200,
				responseBody: lookupStreamingExtracted,
				backend: "azure",
				workerRoute: "lookup"
			},
			{
				method: "GET",
				path: podcastPath(submitUrlNames.duplicateSeries),
				requestBody: null,
				responseStatus: 404,
				responseBody: {},
				backend: "azure",
				workerRoute: "podcast"
			},
			{
				method: "POST",
				path: "/submit",
				requestBody: {
					url: submitUrlUrls.netflix,
					podcastName: submitUrlNames.duplicateSeries
				},
				responseStatus: 409,
				responseBody: [submitUrlIds.pageId, submitUrlIds.pickId],
				backend: "azure",
				workerRoute: "submit"
			},
			{
				method: "GET",
				path: podcastPath(submitUrlIds.pageId),
				requestBody: null,
				responseStatus: 200,
				responseBody: submitUrlPodcastByKey[submitUrlIds.pageId].body,
				backend: "azure",
				workerRoute: "podcast"
			},
			{
				method: "GET",
				path: podcastPath(submitUrlIds.pickId),
				requestBody: null,
				responseStatus: 200,
				responseBody: submitUrlPodcastByKey[submitUrlIds.pickId].body,
				backend: "azure",
				workerRoute: "podcast"
			},
			{
				method: "POST",
				path: "/submit",
				requestBody: {
					url: submitUrlUrls.netflix,
					podcastId: submitUrlIds.pickId,
					podcastName: submitUrlNames.duplicateSeries
				},
				responseStatus: 200,
				responseBody: azureSubmitCreated(submitUrlIds.pickId),
				backend: "azure",
				workerRoute: "submit",
				xOrigin: "true"
			}
		]
	}
];
