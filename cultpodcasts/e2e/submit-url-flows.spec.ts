import { test, expect } from "@playwright/test";
import {
	openHarness,
	persistPosts,
	preparePosts,
	PAGE_ID,
	OTHER_ID,
	PICK_ID,
	EXTRACTED_SHOW,
	type Captured
} from "./submit-url-flows/fake-api";
import {
	dropGeneral,
	dropToPage,
	expectHttpConversation,
	expectSingleDropMessage,
	fillSeries,
	fillUrl,
	openAddPodcast,
	saveAddPodcast,
	setPodcastPage,
	setRole,
	showDrop,
	URLS
} from "./submit-url-flows/actions";

test.describe("submit URL flows — faked API", () => {
	test("homepage general drop signed out persists POST /submit only without GET /submit/lookup", async ({ page }) => {
		const captured: Captured[] = [];
		await openHarness(page, captured);
		await dropGeneral(page, URLS.general);
		await expect.poll(() => persistPosts(captured)).toHaveLength(1);
		expect(captured.some((c) => c.path.includes("/submit/lookup"))).toBe(false);
		expect(persistPosts(captured)).toEqual([
			{
				method: "POST",
				path: "/submit",
				body: { url: URLS.general },
				status: 200
			}
		]);
		await expect(page.locator("#http-log")).toContainText('"Submitted"');
		await expect(page.locator("#http-log")).not.toContainText("X-Origin");
	});

	test("homepage general drop as Curator looks up, prepares, then persists extracted podcastName", async ({ page }) => {
		const captured: Captured[] = [];
		await openHarness(page, captured);
		await dropGeneral(page, URLS.netflix, "curator");
		await expect.poll(() => persistPosts(captured)).toHaveLength(1);
		expect(captured.some((c) => c.method === "GET" && c.path.includes("/submit/lookup"))).toBe(true);
		expect(preparePosts(captured)).toEqual([
			{
				method: "POST",
				path: "/submit/prepare",
				body: { url: URLS.netflix },
				status: 200
			}
		]);
		expect(persistPosts(captured)[0].body).toEqual({
			url: URLS.netflix,
			podcastName: EXTRACTED_SHOW
		});
		expect(persistPosts(captured)[0].status).toBe(200);
		await expect(page.locator("#http-log")).toContainText('"Created"');
		await expectHttpConversation(page, ["GET", "POST", "POST"]);
	});

	test("fake API matches Worker: unsigned lookup is 401, Submitter lookup is 200, signed-out POST has no Azure body", async ({
		page
	}) => {
		const captured: Captured[] = [];
		await openHarness(page, captured);
		await setRole(page, "signedOut");
		await page.evaluate(async () => {
			await fetch("https://api.example/submit/lookup?url=" + encodeURIComponent("https://open.spotify.com/episode/0exampleepisode00"), {
				headers: { "X-Tour-Role": "signedOut" }
			});
		});
		expect(captured.some((c) => c.path.includes("/submit/lookup") && c.status === 401)).toBe(true);
		captured.length = 0;
		await setRole(page, "member");
		await page.evaluate(async () => {
			await fetch("https://api.example/submit/lookup?url=" + encodeURIComponent("https://open.spotify.com/episode/knownunique0001"), {
				headers: { "X-Tour-Role": "member" }
			});
		});
		expect(captured.some((c) => c.path.includes("/submit/lookup") && c.status === 200)).toBe(true);
	});

	test("homepage drop overlay is a single message and never shows Submit to Page Show", async ({ page }) => {
		const captured: Captured[] = [];
		await openHarness(page, captured);
		await setRole(page, "signedOut");
		await showDrop(page, URLS.general);
		await expectSingleDropMessage(page);
	});

	test("podcast page without Curator uses the same single drop message", async ({ page }) => {
		const captured: Captured[] = [];
		await openHarness(page, captured);
		await setRole(page, "signedOut");
		await setPodcastPage(page);
		await showDrop(page, URLS.general);
		await expectSingleDropMessage(page);
	});

	test("Add Podcast known unique as Submitter looks up then persists URL-only to Azure", async ({
		page
	}) => {
		const captured: Captured[] = [];
		await openHarness(page, captured);
		await setRole(page, "member");
		await openAddPodcast(page);
		await fillUrl(page, URLS.known, false);
		await expect(page.locator("#known-series")).toBeHidden();
		await expect(page.locator("#series-panel")).toBeHidden();
		await saveAddPodcast(page);
		await expect.poll(() => persistPosts(captured)).toHaveLength(1);
		expect(captured.some((c) => c.path.includes("/submit/lookup"))).toBe(true);
		expect(persistPosts(captured)[0].body).toEqual({ url: URLS.known });
		await expect(page.locator("#http-log")).toContainText('"Created"');
		await expect(page.locator("#http-log")).toContainText("X-Origin");
		await expectHttpConversation(page, ["GET", "POST"]);
	});

	test("Add Podcast streaming plus name as Curator prepares then probes GET /podcast then persists podcastId", async ({
		page
	}) => {
		const captured: Captured[] = [];
		await openHarness(page, captured);
		await setRole(page, "curator");
		await openAddPodcast(page);
		await fillUrl(page, URLS.netflix, false);
		await fillSeries(page, "Typed Show", false);
		await saveAddPodcast(page);
		await expect.poll(() => persistPosts(captured)).toHaveLength(1);
		expect(preparePosts(captured).some((c) => (c.body as { url?: string })?.url === URLS.netflix)).toBe(true);
		expect(persistPosts(captured)[0].body).toEqual({
			url: URLS.netflix,
			podcastId: PAGE_ID,
			podcastName: "Typed Show"
		});
		await expectHttpConversation(page, ["GET", "POST", "GET", "POST"]);
	});

	test("page drop other series No does not persist", async ({ page }) => {
		const captured: Captured[] = [];
		await openHarness(page, captured);
		await dropToPage(page, URLS.vimeo);
		await expect(page.getByRole("dialog", { name: "Already on another series" })).toBeVisible();
		await page.getByRole("button", { name: "No" }).click();
		await expect.poll(() => captured.some((c) => c.path.includes("/submit/lookup"))).toBe(true);
		expect(persistPosts(captured)).toEqual([]);
	});

	test("page drop other series Yes persists the page podcastId", async ({ page }) => {
		const captured: Captured[] = [];
		await openHarness(page, captured);
		await dropToPage(page, URLS.vimeo);
		await page.getByRole("button", { name: "Yes" }).click();
		await expect.poll(() => persistPosts(captured)).toHaveLength(1);
		expect(persistPosts(captured)[0].body).toEqual({
			url: URLS.vimeo,
			podcastId: PAGE_ID,
			podcastName: "Page Show"
		});
		expect((persistPosts(captured)[0].body as { podcastId: string }).podcastId).not.toBe(OTHER_ID);
	});

	test("POST 409 then pick id persists a second POST with podcastId", async ({ page }) => {
		const captured: Captured[] = [];
		await openHarness(page, captured);
		await setRole(page, "curator");
		await openAddPodcast(page);
		await fillUrl(page, URLS.netflix, false);
		await fillSeries(page, "Duplicate Series", false);
		await saveAddPodcast(page);
		await expect(page.getByRole("dialog", { name: "Choose series" })).toBeVisible();
		await page.locator(".conflict-pick", { hasText: PICK_ID }).click();
		await expect.poll(() => persistPosts(captured)).toHaveLength(2);
		const posts = persistPosts(captured);
		expect(posts[0].body).toEqual({
			url: URLS.netflix,
			podcastName: "Duplicate Series"
		});
		expect(posts[1].body).toEqual({
			url: URLS.netflix,
			podcastId: PICK_ID,
			podcastName: "Duplicate Series"
		});
		await expectHttpConversation(page, ["GET", "POST", "GET", "POST", "GET", "GET", "POST"]);
	});
});
