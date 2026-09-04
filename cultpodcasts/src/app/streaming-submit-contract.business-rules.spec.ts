import { describe, expect, it } from "vitest";
import {
	STREAMING_SUBMIT_CONTRACT_COPY_FROM,
	defaultBrowserRenderingServices,
	htmlFetchModeForService,
	streamingLookupByUrl,
	streamingMembershipShapeCases,
	streamingOrchestrationCases,
	streamingServiceKeys,
	streamingSpecimenUrls,
	type StreamingMembershipResponse
} from "./streaming-submit-contract";
import { submitUrlLookupByUrl } from "./submit-url-contract";
import type { SubmitUrlLookupResponse } from "./submit-url-lookup.interface";

/**
 * Website consumer: business rules bind to the Api-published contract copy.
 * Do not invent parallel streamer enums here — extend Api fixture and re-copy.
 */
describe("streaming-submit-contract (website consumer)", () => {
	it("is copied from the Api publisher path", () => {
		expect(STREAMING_SUBMIT_CONTRACT_COPY_FROM).toBe(
			"Api/tests/fixtures/streaming-submit-contract.ts"
		);
	});

	it("exposes lookup fakes for every specimen streaming URL", () => {
		expect(Object.keys(streamingLookupByUrl).sort()).toEqual(
			Object.values(streamingSpecimenUrls).sort()
		);
		for (const service of streamingServiceKeys) {
			const url = streamingSpecimenUrls[service];
			expect(streamingLookupByUrl[url].service).toBe(service);
			expect(streamingLookupByUrl[url].kind).toBe("streaming");
			expect(streamingLookupByUrl[url].known).toBe(false);
		}
	});

	it("requires membership shape coverage for every service × arm", () => {
		expect(streamingMembershipShapeCases.length).toBe(streamingServiceKeys.length * 3);
	});

	/**
	 * Compile-time + runtime bridge: contract membership bodies must satisfy
	 * SPA SubmitUrlLookupResponse with required service on streaming arms.
	 */
	it("bridges every membership shape body to SubmitUrlLookupResponse with required service", () => {
		const acceptLookup = (body: SubmitUrlLookupResponse): SubmitUrlLookupResponse => body;
		for (const c of streamingMembershipShapeCases) {
			const asWire: StreamingMembershipResponse = c.body;
			const asLookup = acceptLookup(asWire);
			expect(asLookup).toMatchObject({ kind: "streaming", service: c.service });
			if (asLookup.kind !== "streaming") {
				throw new Error(`expected streaming kind for ${c.id}`);
			}
			expect(asLookup.service).toBe(c.service);
		}
	});

	/**
	 * Fake-api merge smoke: specimen URLs only in streamingLookupByUrl must resolve
	 * when submitUrlLookupByUrl misses (same order as e2e/submit-url-flows/fake-api.ts).
	 */
	it("resolves itvx via streamingLookupByUrl when submitUrlLookupByUrl has no entry", () => {
		const itvxUrl = streamingSpecimenUrls.itvx;
		expect(submitUrlLookupByUrl[itvxUrl]).toBeUndefined();
		expect(streamingLookupByUrl[itvxUrl]?.service).toBe("itvx");
		const merged =
			submitUrlLookupByUrl[itvxUrl] ??
			streamingLookupByUrl[itvxUrl] ??
			{ known: false, kind: "podcast-service" };
		expect(merged).toEqual(streamingLookupByUrl[itvxUrl]);
		expect(merged).toMatchObject({ known: false, kind: "streaming", service: "itvx" });
	});

	it("requires orchestration lookup → prepare → submit for every service", () => {
		for (const c of streamingOrchestrationCases) {
			expect(c.steps[0]?.name).toBe("lookup");
			expect(c.steps[1]?.name).toBe("prepare");
			expect(c.steps[2]?.name).toBe("submit");
			expect(htmlFetchModeForService(c.service, defaultBrowserRenderingServices)).toBe(
				c.htmlFetchMode
			);
		}
	});

	it("treats only defaultBrowserRenderingServices as browserRendering", () => {
		expect(defaultBrowserRenderingServices).toContain("itvx");
		expect(htmlFetchModeForService("itvx")).toBe("browserRendering");
		expect(htmlFetchModeForService("discoveryPlus")).toBe("directHttp");
	});
});
