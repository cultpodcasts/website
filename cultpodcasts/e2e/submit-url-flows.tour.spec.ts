import { test, expect } from "@playwright/test";
import { openHarness, persistPosts, PICK_ID, EXTRACTED_SHOW, type Captured } from "./submit-url-flows/fake-api";
import {
	clearHttp,
	expectHttpConversation,
	expectCuratorPodcastDropTargets,
	expectSingleDropMessage,
	fillSeries,
	fillUrl,
	openAddPodcast,
	saveAddPodcast,
	setHome,
	setPodcastPage,
	setRole,
	showDrop,
	showIntro,
	URLS
} from "./submit-url-flows/actions";

test.use({
	video: { mode: "on", size: { width: 1280, height: 720 } },
	viewport: { width: 1280, height: 720 }
});

test.setTimeout(180_000);

const INTRO_MS = 6_400;
const UI_HOLD_MS = 2_000;
const AFTER_HTTP_MS = 2_600;

test("submit URL flows video tour — GET probes and POST persist are on screen", async ({ page }) => {
	const captured: Captured[] = [];
	await openHarness(page, captured, { delayMs: 1_100 });

	await showIntro(page, {
		kicker: "Case 1 of 7 — signed out (not logged in)",
		title: "Homepage general drop: POST /submit only (D1)",
		lede: "You are signed out. On the homepage you drop a Spotify episode URL. The lookup backend is not called. Persist is POST /submit to the Worker D1 queue.",
		points: [
			"Signed-out homepage: one drop message only — Drop episode link to submit. No Submit episode link / Submit to Page Show cards.",
			"GET /submit/lookup is API-protected and requires Curator. Signed-out never calls it.",
			"POST /submit with { url } only. No Series picker when signed out."
		],
		persist: "HTTP overlay (right): POST /submit { url } only — D1. No GET /submit/lookup."
	}, INTRO_MS);
	await clearHttp(page);
	await setRole(page, "signedOut");
	await setHome(page);
	await showDrop(page, URLS.general);
	await expectSingleDropMessage(page);
	await expect(page.locator("#drop-overlay")).toContainText("Drop episode link to submit");
	await expect(page.locator("#drop-overlay")).not.toContainText("Submit to Page Show");
	await page.waitForTimeout(UI_HOLD_MS);
	await page.locator("#drop-home").click();
	await expect.poll(() => persistPosts(captured)).toHaveLength(1);
	await expect(page.locator("#http-log")).not.toContainText("GET /submit/lookup");
	await expect(page.locator("#http-log")).toContainText("POST /submit");
	await expectHttpConversation(page, ["POST"]);
	await page.waitForTimeout(AFTER_HTTP_MS);

	await showIntro(page, {
		kicker: "Case 2 of 7 — Curator",
		title: "Homepage drop: Curator lookup, then POST",
		lede: "Now you are signed in as a Curator. Homepage drop still shows one message, but lookup runs first so streaming metadata can attach a series name.",
		points: [
			"GET /submit/lookup (Azure Isolated GET SubmitUrl) returns known: false, kind: streaming, plus extracted podcastName.",
			"Homepage overlay stays a single message — not the two podcast-page cards.",
			"Then POST /submit with url + that podcastName."
		],
		persist: `HTTP overlay: GET /submit/lookup, then POST /submit with url + podcastName \"${EXTRACTED_SHOW}\".`
	}, INTRO_MS);
	await clearHttp(page);
	await setRole(page, "curator");
	await setHome(page);
	await showDrop(page, URLS.netflix);
	await expectSingleDropMessage(page);
	await page.waitForTimeout(UI_HOLD_MS);
	await page.locator("#drop-home").click();
	await expect.poll(() => persistPosts(captured)).toHaveLength(2);
	await expect(page.locator("#http-log")).toContainText("GET /submit/lookup");
	await expect(page.locator("#http-log")).toContainText(EXTRACTED_SHOW);
	await expectHttpConversation(page, ["GET", "POST"]);
	await page.waitForTimeout(AFTER_HTTP_MS);

	await showIntro(page, {
		kicker: "Case 3 of 7 — Submitter",
		title: "Add Podcast — lookup then URL-only Azure POST",
		lede: "You are signed in with the Submitter role (submit permission, not Curator). Add Podcast calls GET /submit/lookup, then POST /submit URL-only to Azure.",
		points: [
			"Valid URL → GET /submit/lookup returns known unique membership.",
			"The Series field stays Curator-only. Submitter never sees it.",
			"Save posts { url } only — Azure persist with X-Origin, not Worker D1."
		],
		persist: "Overlay: GET /submit/lookup, then POST /submit { url } with Azure Created."
	}, INTRO_MS);
	await clearHttp(page);
	await setRole(page, "member");
	await openAddPodcast(page);
	await page.waitForTimeout(800);
	await fillUrl(page, URLS.known, true);
	await expect(page.locator("#series-panel")).toBeHidden();
	await page.waitForTimeout(UI_HOLD_MS);
	await saveAddPodcast(page);
	await expect.poll(() => persistPosts(captured)).toHaveLength(3);
	await expect(page.locator("#http-log")).toContainText("GET /submit/lookup");
	await expectHttpConversation(page, ["GET", "POST"]);
	await page.waitForTimeout(AFTER_HTTP_MS);

	await showIntro(page, {
		kicker: "Case 4 of 7 — Curator",
		title: "Add Podcast — streaming URL plus a series name",
		lede: "Now you are signed in as a Curator. Lookup says unknown streaming, so the Series field is offered.",
		points: [
			"GET /submit/lookup returns known: false, kind: streaming (and may include an extracted name).",
			"You type an existing series name. Save probes GET /podcast/{name}.",
			"Unique name → persist with that catalogue id so the episode attaches to the right show."
		],
		persist: "Overlay: lookup GET, name GET, then POST /submit with url + podcastId + podcastName."
	}, INTRO_MS);
	await clearHttp(page);
	await setRole(page, "curator");
	await openAddPodcast(page);
	await fillUrl(page, URLS.netflix, true);
	await fillSeries(page, "Typed Show", true);
	await page.waitForTimeout(UI_HOLD_MS);
	await saveAddPodcast(page);
	await expect.poll(() => persistPosts(captured)).toHaveLength(4);
	await expectHttpConversation(page, ["GET", "GET", "POST"]);
	await page.waitForTimeout(AFTER_HTTP_MS);

	await showIntro(page, {
		kicker: "Case 5 of 7 — Curator",
		title: "Submit to this page — already on another series — No",
		lede: "Curator only. You are viewing Page Show. The URL is already stored on Other Show. Attach is dangerous, so we ask first.",
		points: [
			"Two drop targets: general submit, or submit to the page you are on.",
			"Submit-to-page resolves the page series, then looks up the URL.",
			"No / dismiss / backdrop must not persist. Only explicit Yes continues."
		],
		persist: "Overlay: GET /podcast/Page Show and GET /submit/lookup. No POST /submit."
	}, INTRO_MS);
	await clearHttp(page);
	const postsBeforeNo = persistPosts(captured).length;
	await setRole(page, "curator");
	await setPodcastPage(page);
	await showDrop(page, URLS.vimeo);
	await expectCuratorPodcastDropTargets(page);
	await page.waitForTimeout(UI_HOLD_MS);
	await page.locator("#drop-page").click();
	await expect(page.getByRole("dialog", { name: "Already on another series" })).toBeVisible();
	await page.waitForTimeout(UI_HOLD_MS);
	await page.getByRole("button", { name: "No" }).click();
	await expect.poll(() => persistPosts(captured).length).toBe(postsBeforeNo);
	await expectHttpConversation(page, ["GET", "GET"]);
	await page.waitForTimeout(AFTER_HTTP_MS);

	await showIntro(page, {
		kicker: "Case 6 of 7 — Curator",
		title: "Submit to this page — already on another series — Yes",
		lede: "Same drop, but the Curator confirms they really want this episode on the page series.",
		points: [
			"The confirm copy names both shows: already on Other Show, submit to Page Show anyway?",
			"We still persist the page podcastId, not the other series id from lookup.",
			"That is the attach exception: the command carries the page identity."
		],
		persist: "Overlay: the same GETs, then POST /submit with the Page Show id."
	}, INTRO_MS);
	await clearHttp(page);
	await setRole(page, "curator");
	await setPodcastPage(page);
	await showDrop(page, URLS.vimeo);
	await page.waitForTimeout(UI_HOLD_MS);
	await page.locator("#drop-page").click();
	await expect(page.getByRole("dialog", { name: "Already on another series" })).toBeVisible();
	await page.waitForTimeout(UI_HOLD_MS);
	await page.getByRole("button", { name: "Yes" }).click();
	await expect.poll(() => persistPosts(captured)).toHaveLength(postsBeforeNo + 1);
	await expectHttpConversation(page, ["GET", "GET", "POST"]);
	await page.waitForTimeout(AFTER_HTTP_MS);

	await showIntro(page, {
		kicker: "Case 7 of 7 — Curator",
		title: "Name collision — POST 409, then pick the row",
		lede: "Curator attach: a streaming URL plus a series name that several catalogue rows share. The first persist cannot choose for you.",
		points: [
			"Save probes the name (404 here means “not a unique row”), then POST /submit with podcastName only.",
			"The API returns 409 and a list of UUIDs. That is a shared name, not URL membership.",
			"Choose series loads each id, you pick by platform ids, then we POST again with podcastId."
		],
		persist: "Overlay: two POST /submit calls. The gold one with podcastId is the successful persist."
	}, INTRO_MS);
	await clearHttp(page);
	await setRole(page, "curator");
	await openAddPodcast(page);
	await fillUrl(page, URLS.netflix, true);
	await fillSeries(page, "Duplicate Series", true);
	await page.waitForTimeout(UI_HOLD_MS);
	await saveAddPodcast(page);
	await expect(page.getByRole("dialog", { name: "Choose series" })).toBeVisible();
	await page.waitForTimeout(UI_HOLD_MS);
	await page.locator(".conflict-pick", { hasText: PICK_ID }).click();
	await expect.poll(() => persistPosts(captured).length).toBeGreaterThanOrEqual(postsBeforeNo + 3);
	await expect(page.locator("#http-log")).toContainText("409");
	await expectHttpConversation(page, ["GET", "GET", "POST", "GET", "GET", "POST"]);
	await page.waitForTimeout(AFTER_HTTP_MS + 800);
});
