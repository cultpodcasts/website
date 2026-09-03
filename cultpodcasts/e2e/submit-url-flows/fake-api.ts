import type { Page } from "@playwright/test";
import { submitUrlFlowsDocument } from "./harness";
import {
	azureSubmitCreated,
	d1SubmitOk,
	lookupDenialForActor,
	submitUrlIds,
	submitUrlLookupByUrl,
	submitUrlNames,
	submitUrlPodcastByKey,
	submitUrlUrls,
	type SubmitUrlActor
} from "../../src/app/submit-url-contract";

/** Re-export contract constants so e2e specs stay on the API case table. */
export const PAGE_ID = submitUrlIds.pageId;
export const OTHER_ID = submitUrlIds.otherId;
export const PICK_ID = submitUrlIds.pickId;
export const EXTRACTED_SHOW = submitUrlNames.extractedShow;
export const EPISODE_ID = submitUrlIds.episodeId;
export const D1_SUBMIT_OK = d1SubmitOk;
export { azureSubmitCreated, submitUrlUrls };

export type Captured = { method: string; path: string; body?: unknown; status?: number };
export type FakeApiOptions = { delayMs?: number };

function actorFromHeaders(headers: Record<string, string>): SubmitUrlActor {
	const role = (headers["x-tour-role"] ?? "").toLowerCase();
	if (role === "curator") {
		return "curator";
	}
	if (role === "member") {
		return "member-submit";
	}
	return "anonymous";
}

export async function installFakeApi(page: Page, captured: Captured[], options: FakeApiOptions = {}) {
	const delayMs = options.delayMs ?? 0;
	await page.route("https://api.example/**", async (route) => {
		if (delayMs > 0) {
			await new Promise((resolve) => setTimeout(resolve, delayMs));
		}
		const req = route.request();
		const url = new URL(req.url());
		const path = url.pathname + url.search;
		const method = req.method();
		const body = method === "POST" ? req.postDataJSON() : undefined;
		const actor = actorFromHeaders(req.headers());
		const push = (status: number) => {
			captured.push({ method, path, body, status });
		};

		if (method === "GET" && url.pathname === "/submit/lookup") {
			const denied = lookupDenialForActor(actor);
			if (denied) {
				push(denied.status);
				await route.fulfill({
					status: denied.status,
					contentType: "application/json",
					body: JSON.stringify(denied.body)
				});
				return;
			}
			const episodeUrl = url.searchParams.get("url") ?? "";
			const lookupBody = submitUrlLookupByUrl[episodeUrl] ?? { known: false, kind: "podcast-service" };
			push(200);
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(lookupBody)
			});
			return;
		}

		if (method === "GET" && url.pathname.startsWith("/podcast/")) {
			const denied = lookupDenialForActor(actor);
			if (denied) {
				push(denied.status);
				await route.fulfill({
					status: denied.status,
					contentType: "application/json",
					body: JSON.stringify(denied.body)
				});
				return;
			}
			const key = decodeURIComponent(url.pathname.slice("/podcast/".length));
			const row = submitUrlPodcastByKey[key];
			if (row) {
				push(row.status);
				await route.fulfill({
					status: row.status,
					contentType: "application/json",
					body: JSON.stringify(row.body)
				});
				return;
			}
			push(404);
			await route.fulfill({ status: 404, contentType: "application/json", body: "{}" });
			return;
		}

		if (method === "POST" && url.pathname === "/submit") {
			if (actor === "anonymous") {
				push(200);
				await route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify(d1SubmitOk)
				});
				return;
			}
			const payload = body as { podcastId?: string; podcastName?: string };
			if (!payload.podcastId && payload.podcastName === submitUrlNames.duplicateSeries) {
				push(409);
				await route.fulfill({
					status: 409,
					contentType: "application/json",
					body: JSON.stringify([submitUrlIds.pageId, submitUrlIds.pickId])
				});
				return;
			}
			push(200);
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				headers: { "X-Origin": "true" },
				body: JSON.stringify(azureSubmitCreated(payload.podcastId ?? submitUrlIds.pageId))
			});
			return;
		}

		push(404);
		await route.fulfill({ status: 404, body: "unmocked" });
	});
}

export async function openHarness(page: Page, captured: Captured[], options: FakeApiOptions = {}) {
	await installFakeApi(page, captured, options);
	await page.goto("https://example.com/");
	await page.setContent(submitUrlFlowsDocument(), { waitUntil: "domcontentloaded" });
}

export function persistPosts(captured: Captured[]) {
	return captured.filter((c) => c.method === "POST" && c.path === "/submit");
}
