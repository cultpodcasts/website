import { describe, expect, it } from "vitest";
import {
	STREAMING_SUBMIT_CONTRACT_COPY_FROM,
	defaultBrowserRenderingServices,
	htmlFetchModeForService,
	streamingLookupByUrl,
	streamingMembershipShapeCases,
	streamingOrchestrationCases,
	streamingServiceKeys,
	streamingSpecimenUrls
} from "./streaming-submit-contract";

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
