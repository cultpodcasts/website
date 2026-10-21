import { expect, Page, Route, test } from "@playwright/test";
import { GuidService } from "../src/app/guid.service";
import { catalogueE2eOrigin as appOrigin } from "./catalogue-origin";

/**
 * News report / TV episode curator edit against real routes with a faked API (synthetic data only):
 * hub submit → snackbar Review + Edit, the news report page Edit, and the TV episode page Edit.
 * Set CATALOGUE_EDIT_SCREENSHOTS=dir to save PR screenshots.
 */
const guids = new GuidService();
const reportId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const episodeId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const outletId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const showId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const screenshotDir = process.env["CATALOGUE_EDIT_SCREENSHOTS"];

function searchDoc(id: string, kind: string, title: string, parent: string) {
	return { id, title, seriesName: parent, description: "Synthetic description", contentKind: kind, release: "2026-01-02T00:00:00.000Z", duration: "00:06:30" };
}

const playable = {
	description: "A synthetic report about nothing in particular.",
	release: "2026-01-02",
	duration: "0:06:30",
	explicit: false,
	ignored: false,
	removed: false,
	posted: false,
	tweeted: true,
	blueskyPosted: true,
	subjects: ["Politics"],
	searchTerms: null,
	hashTag: "#desk",
	language: null,
	guests: ["Ann Example"]
};
const report = { ...playable, id: reportId, title: "Bulletin", newsOrganisationId: outletId, newsOrganisationName: "Desk" };
const tvEpisode = {
	...playable,
	id: episodeId,
	title: "Part",
	tvShowId: showId,
	tvShowName: "Nightly",
	imdb: "https://www.imdb.com/title/tt0000001/",
	tvdb: null
};

const json = (route: Route, body: unknown, status = 200, headers: Record<string, string> = {}) =>
	route.fulfill({ status, contentType: "application/json", headers, body: JSON.stringify(body) });

test.beforeEach(async ({ page }) => {
	await page.route("**/*", async (route) => {
		const url = route.request().url();
		if (url.startsWith(appOrigin) || (screenshotDir && /fonts\.(googleapis|gstatic)\.com/.test(url))) {
			await route.continue();
			return;
		}
		if (route.request().method() === "POST" && url.includes("/search")) {
			const filter = String(route.request().postDataJSON()?.filter ?? "");
			const value = filter.includes("'Desk'") || filter.includes(reportId)
				? [searchDoc(reportId, "NewsReport", "Bulletin", "Desk")]
				: filter.includes("'Nightly'") || filter.includes(episodeId)
					? [searchDoc(episodeId, "TvShowEpisode", "Part", "Nightly")]
					: [];
			await json(route, { value });
			return;
		}
		await json(route, {});
	});
	await page.addInitScript(() => {
		(globalThis as { __E2E_CURATOR__?: boolean }).__E2E_CURATOR__ = true;
		(globalThis as { __E2E_ROLES__?: string[] }).__E2E_ROLES__ = ["Curator"];
	});
});

/** The `/subjects`, `/people`, `/languages` lookups shared with the podcast Edit Episode dialog. */
async function fakeLookups(page: Page) {
	await page.route("**/subjects", (route) => json(route, [{ name: "Politics" }, { name: "Sport" }, { name: "Arts" }]));
	await page.route("**/people", (route) => json(route, [{ id: "p1", name: "Ann Example" }, { id: "p2", name: "Bob Sample" }]));
	await page.route("**/languages", (route) => json(route, { en: "English", fr: "French", de: "German" }));
	await page.route(`**/newsorganisation/${outletId}`, (route) => json(route, { id: outletId, name: "Desk", defaultSubject: "Politics" }));
	await page.route(`**/tvshow/${showId}`, (route) => json(route, { id: showId, name: "Nightly" }));
}

/** GET returns the synthetic playable; PATCH records the body and answers 202. */
async function fakePlayable(page: Page, path: string, dto: unknown, sink: { body?: unknown }) {
	await page.route(`**/${path}`, async (route) => {
		if (route.request().method() === "PATCH") {
			sink.body = route.request().postDataJSON();
			await json(route, { searchIndexerState: "Executed" }, 202);
			return;
		}
		await json(route, dto);
	});
}

async function shot(page: Page, name: string) {
	if (screenshotDir) {
		await page.waitForTimeout(600); // let the tab slide finish
		await page.screenshot({ path: `${screenshotDir}/${name}.png` });
	}
}

async function submitToDeskHub(page: Page) {
	await page.route("**/newsorganisation/Desk", (route) => json(route, { id: outletId, name: "Desk" }));
	await page.route("**/submit", (route) =>
		json(
			route,
			{ success: { episode: "Created", podcast: "NotCreated", contentKind: "NewsReport", playableId: reportId } },
			200,
			{ "X-Origin": "true", "Access-Control-Expose-Headers": "X-Origin" }
		));
	await page.goto(`/news/${encodeURIComponent("Desk")}`);
	await expect(page.getByText("Bulletin").first()).toBeVisible();
	await page.locator("app-series-hub-menu #sort").click();
	await page.getByRole("menuitem", { name: /Submit Url for News Outlet/ }).click();
	const dialog = page.locator("mat-dialog-container");
	await dialog.getByPlaceholder("Podcast Url").fill("https://www.youtube.com/watch?v=abc123def45");
	await dialog.getByRole("button", { name: "Save" }).click();
	const snack = page.locator("app-submit-url-origin-response-snackbar");
	await expect(snack).toContainText("News created.");
	await expect(snack.getByRole("button")).toHaveText(["Review", "Edit"]);
	return snack;
}

test.describe("news report / TV episode curator edit", () => {
	test("hub submit shows Review + Edit; Review opens the report under its outlet", async ({ page }) => {
		const snack = await submitToDeskHub(page);
		await shot(page, "snackbar-review-edit");
		await snack.getByRole("button", { name: "Review" }).click();
		await expect(page).toHaveURL(new RegExp(`/news/Desk/${guids.toCatalogueShortId(reportId, "NewsReport")}$`));
		await expect(page.getByRole("heading", { name: "Bulletin" })).toBeVisible();
	});

	test("hub submit Edit opens the news report dialog and PATCHes only the changed fields", async ({ page }) => {
		const sink: { body?: unknown } = {};
		await fakeLookups(page);
		await fakePlayable(page, `newsreport/${reportId}`, report, sink);
		const snack = await submitToDeskHub(page);
		await snack.getByRole("button", { name: "Edit" }).click();
		const dialog = page.locator("mat-dialog-container");
		await expect(dialog.getByRole("heading", { name: "Edit News Report" })).toBeVisible();
		await expect(dialog.getByRole("tab")).toHaveText(["Details", "Flags", "Meta", "Guests"]);
		await expect(dialog.locator("#parent-name")).toHaveText("Desk");
		await dialog.getByLabel("Title").fill("Bulletin (edited)");
		await shot(page, "news-edit-details");
		await dialog.getByRole("tab", { name: "Flags" }).click();
		await dialog.getByRole("button", { name: "Remove" }).click();
		await expect(dialog.getByText("Will remove on save")).toBeVisible();
		await shot(page, "news-edit-flags");
		await dialog.getByRole("tab", { name: "Meta" }).click();
		await dialog.getByRole("combobox", { name: "Subjects" }).click();
		await page.getByRole("option", { name: "Sport" }).click();
		await page.keyboard.press("Escape");
		await expect(page.getByRole("listbox")).toHaveCount(0);
		await dialog.getByRole("combobox", { name: "Language" }).click();
		await page.getByRole("option", { name: "French" }).click();
		await shot(page, "news-edit-meta");
		await dialog.getByRole("tab", { name: "Guests" }).click();
		await dialog.getByRole("combobox", { name: "Guests" }).click();
		await page.getByRole("option", { name: "Bob Sample" }).click();
		await page.keyboard.press("Escape");
		await expect(page.getByRole("listbox")).toHaveCount(0);
		await shot(page, "news-edit-guests");
		await dialog.getByRole("button", { name: "Submit" }).click();
		await expect.poll(() => sink.body).toEqual({
			title: "Bulletin (edited)",
			unBluesky: true,
			subjects: ["Politics", "Sport"],
			guests: ["Ann Example", "Bob Sample"],
			language: "fr"
		});
		await expect(page.getByText("News report updated")).toBeVisible();
	});

	test("the news report page Edit opens the news report dialog, not the podcast editor", async ({ page }) => {
		const sink: { body?: unknown } = {};
		await fakeLookups(page);
		await fakePlayable(page, `newsreport/${reportId}`, report, sink);
		let podcastEpisodeGet = false;
		await page.route("**/episode/**", (route) => {
			podcastEpisodeGet = true;
			return json(route, {}, 404);
		});
		await page.goto(`/news/${encodeURIComponent("Desk")}/${guids.toCatalogueShortId(reportId, "NewsReport")}`);
		await expect(page.getByRole("heading", { name: "Bulletin" })).toBeVisible();
		await page.getByRole("button", { name: "Episode actions" }).click();
		// Post Episode is podcast-only (GET /episode/{podcast}/{id} + publish), so it is not offered here.
		await expect(page.getByRole("menuitem")).toHaveText([/Edit Episode/]);
		await page.getByRole("menuitem", { name: "Edit Episode" }).click();
		const dialog = page.locator("mat-dialog-container");
		await expect(dialog.getByRole("heading", { name: "Edit News Report" })).toBeVisible();
		await dialog.getByRole("tab", { name: "Flags" }).click();
		await dialog.getByRole("checkbox", { name: "Removed" }).check();
		await dialog.getByRole("button", { name: "Submit" }).click();
		await expect.poll(() => sink.body).toEqual({ removed: true });
		await expect(page.getByText("News report updated")).toBeVisible();
		expect(podcastEpisodeGet).toBe(false);
	});

	test("the TV episode page Edit opens the full TV dialog with an Identity tab", async ({ page }) => {
		const sink: { body?: unknown } = {};
		await fakeLookups(page);
		await fakePlayable(page, `tvshowepisode/${episodeId}`, tvEpisode, sink);
		await page.goto(`/tv/${encodeURIComponent("Nightly")}/${guids.toCatalogueShortId(episodeId, "TvShowEpisode")}`);
		await expect(page.getByRole("heading", { name: "Part" })).toBeVisible();
		await page.getByRole("button", { name: "Episode actions" }).click();
		await page.getByRole("menuitem", { name: "Edit Episode" }).click();
		const dialog = page.locator("mat-dialog-container");
		await expect(dialog.getByRole("heading", { name: "Edit TV Episode" })).toBeVisible();
		await expect(dialog.getByRole("tab")).toHaveText(["Details", "Flags", "Meta", "Guests", "Identity"]);
		await expect(dialog.locator("#parent-name")).toHaveText("Nightly");
		await dialog.getByLabel("Description").fill("Edited synthetic description");
		await shot(page, "tv-edit-details");
		await dialog.getByRole("tab", { name: "Identity" }).click();
		await expect(dialog.getByRole("textbox", { name: "IMDb" })).toHaveValue("https://www.imdb.com/title/tt0000001/");
		await dialog.getByRole("textbox", { name: "TheTVDB" }).fill("https://thetvdb.com/series/example/episodes/1");
		await shot(page, "tv-edit-identity");
		await dialog.getByRole("button", { name: "Submit" }).click();
		await expect.poll(() => sink.body).toEqual({
			description: "Edited synthetic description",
			tvdb: "https://thetvdb.com/series/example/episodes/1"
		});
		await expect(page.getByText("TV episode updated")).toBeVisible();
	});

	test("searching from a news report page is a normal site search, not a podcast search on the outlet", async ({ page }) => {
		await page.goto(`/news/${encodeURIComponent("Desk")}/${guids.toCatalogueShortId(reportId, "NewsReport")}`);
		await expect(page.getByRole("heading", { name: "Bulletin" })).toBeVisible();
		const search = page.getByRole("combobox", { name: "Search" });
		await search.fill("election");
		await search.press("Enter");
		await expect(page).toHaveURL(/\/search\/election$/);
	});
});
