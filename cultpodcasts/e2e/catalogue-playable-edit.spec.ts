import { expect, Page, Route, test } from "@playwright/test";
import { GuidService } from "../src/app/guid.service";
import { catalogueE2eOrigin as appOrigin } from "./catalogue-origin";

/**
 * News report / TV episode / film curator edit against real routes with a faked API (synthetic data only):
 * hub submit → snackbar Review + Edit, the news report page Edit, the TV episode page Edit, and for films the
 * film page Edit, the toolbar submit snackbar and the review page row.
 * Set CATALOGUE_EDIT_SCREENSHOTS=dir to save PR screenshots.
 */
const guids = new GuidService();
const reportId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const episodeId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const outletId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const showId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const filmId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
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
	imdbId: "tt0000001",
	tvdbId: null,
	tmdbId: null
};

/** Synthetic `film/{id}` GET: publisher fields + playable fields, `name` not `title`, year-only release. */
const film = {
	...playable,
	id: filmId,
	name: "One Off",
	publisher: "Example Pictures",
	description: "A synthetic film about nothing in particular.",
	release: "1999",
	duration: "1:42:00",
	subjects: ["Arts"],
	defaultSubject: "Arts",
	twitterHandle: "",
	imdbId: "tt0000002",
	tmdbId: null,
	services: null
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
					: filter.includes(filmId)
						? [searchDoc(filmId, "Film", "One Off", "One Off")]
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
	await page.route("**/subjects", (route) => json(route, [{ name: "Politics" }, { name: "Sport" }, { name: "Arts" }, { name: "Film" }]));
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
		await expect(dialog.getByRole("tab")).toHaveText(["Details", "Flags", "Urls", "Meta", "Images", "Guests"]);
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
		await expect(dialog.getByRole("tab")).toHaveText(["Details", "Flags", "Urls", "Meta", "Images", "Guests", "Identity"]);
		await expect(dialog.locator("#parent-name")).toHaveText("Nightly");
		await dialog.getByLabel("Description").fill("Edited synthetic description");
		await shot(page, "tv-edit-details");
		await dialog.getByRole("tab", { name: "Identity" }).click();
		await expect(dialog.getByRole("textbox", { name: "IMDb id" })).toHaveValue("tt0000001");
		await dialog.getByRole("textbox", { name: "TheTVDB id" }).fill("4242");
		await shot(page, "tv-edit-identity");
		await dialog.getByRole("button", { name: "Submit" }).click();
		await expect.poll(() => sink.body).toEqual({
			description: "Edited synthetic description",
			tvdbId: 4242
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

test.describe("reorder selected subjects and guests", () => {
	test("drag a selected subject by its right-hand handle and Alt+Arrow a guest; the PATCH sends only the new orders", async ({ page }) => {
		const sink: { body?: unknown } = {};
		await fakeLookups(page);
		await fakePlayable(page, `newsreport/${reportId}`, {
			...report,
			subjects: ["Politics", "Sport", "Arts"],
			guests: ["Ann Example", "Bob Sample"]
		}, sink);
		await page.goto(`/news/${encodeURIComponent("Desk")}/${guids.toCatalogueShortId(reportId, "NewsReport")}`);
		await expect(page.getByRole("heading", { name: "Bulletin" })).toBeVisible();
		await page.getByRole("button", { name: "Episode actions" }).click();
		await page.getByRole("menuitem", { name: "Edit Episode" }).click();
		const dialog = page.locator("mat-dialog-container");
		await expect(dialog.getByRole("heading", { name: "Edit News Report" })).toBeVisible();

		await dialog.getByRole("tab", { name: "Meta" }).click();
		await dialog.getByRole("combobox", { name: "Subjects" }).click();
		const listbox = page.getByRole("listbox");
		const options = listbox.getByRole("option");
		await expect(options.nth(0)).toHaveText("Politics");
		await expect(options.nth(2)).toHaveText("Arts");

		// Only the three selected options get a handle, and it sits on the right of the row.
		const handles = listbox.locator("app-select-reorder-handle");
		await expect(handles).toHaveCount(3);
		const arts = listbox.getByRole("option", { name: "Arts" });
		const handle = arts.locator("app-select-reorder-handle");
		const optionBox = (await arts.boundingBox())!;
		const handleBox = (await handle.boundingBox())!;
		expect(handleBox.x).toBeGreaterThan(optionBox.x + optionBox.width / 2);

		// Drag Arts from its handle to the top.
		// (The outlet default, Politics, is also listed again in the hoisted group, so scope to the selected group.)
		const target = (await listbox.locator(".select-reorder-list").getByRole("option", { name: "Politics" }).boundingBox())!;
		await handle.hover();
		await page.mouse.down();
		const startX = handleBox.x + handleBox.width / 2;
		const startY = handleBox.y + handleBox.height / 2;
		await page.mouse.move(startX, startY - 6, { steps: 3 });
		await page.mouse.move(startX, target.y + 4, { steps: 12 });
		await page.mouse.up();
		await shot(page, "reorder-subjects-dragged");

		await expect(options.nth(0)).toHaveText("Arts");
		await expect(options.nth(1)).toHaveText("Politics");
		await expect(options.nth(2)).toHaveText("Sport");
		// The drag neither toggled the option nor closed the panel.
		await expect(listbox).toBeVisible();
		await expect(arts).toHaveAttribute("aria-selected", "true");

		// A plain click on the handle does not toggle the option either.
		await arts.locator("app-select-reorder-handle").click();
		await expect(arts).toHaveAttribute("aria-selected", "true");
		await expect(listbox).toBeVisible();
		await page.keyboard.press("Escape");
		await expect(page.getByRole("listbox")).toHaveCount(0);

		// Keyboard: the panel opens with the first selected guest active; Alt+ArrowDown moves it down.
		await dialog.getByRole("tab", { name: "Guests" }).click();
		await dialog.getByRole("combobox", { name: "Guests" }).click();
		const guestOptions = page.getByRole("listbox").getByRole("option");
		await expect(guestOptions.nth(0)).toHaveText("Ann Example");
		await page.keyboard.press("Alt+ArrowDown");
		await expect(guestOptions.nth(0)).toHaveText("Bob Sample");
		await expect(guestOptions.nth(1)).toHaveText("Ann Example");
		await expect(page.getByRole("listbox")).toBeVisible();
		await expect(page.locator(".cdk-live-announcer-element")).toHaveText("Ann Example moved to position 2 of 2");
		await shot(page, "reorder-guests-keyboard");
		await page.keyboard.press("Escape");
		await expect(page.getByRole("listbox")).toHaveCount(0);

		await dialog.getByRole("button", { name: "Submit" }).click();
		await expect.poll(() => sink.body).toEqual({
			subjects: ["Arts", "Politics", "Sport"],
			guests: ["Bob Sample", "Ann Example"]
		});
	});
});

test.describe("film curator edit", () => {
	const filmShort = guids.toCatalogueShortId(filmId, "Film");
	const filmPath = `/film/${encodeURIComponent("One Off")}/${filmShort}`;

	/** Opens the film dialog from the film page menu; Post Episode is podcast-only and not offered. */
	async function openFromFilmPage(page: Page) {
		await page.goto(filmPath);
		await expect(page.getByRole("heading", { name: "One Off" })).toBeVisible();
		await page.getByRole("button", { name: "Episode actions" }).click();
		await expect(page.getByRole("menuitem")).toHaveText([/Edit Episode/]);
		await page.getByRole("menuitem", { name: "Edit Episode" }).click();
		const dialog = page.locator("mat-dialog-container");
		await expect(dialog.getByRole("heading", { name: "Edit Film" })).toBeVisible();
		return dialog;
	}

	test("the film page Edit opens the tabbed film dialog and PATCHes only the changed fields, never a title", async ({ page }) => {
		const sink: { body?: unknown } = {};
		await fakeLookups(page);
		await fakePlayable(page, `film/${filmId}`, film, sink);
		let podcastEpisodeGet = false;
		await page.route("**/episode/**", (route) => {
			podcastEpisodeGet = true;
			return json(route, {}, 404);
		});
		const dialog = await openFromFilmPage(page);
		await expect(dialog.getByRole("tab")).toHaveText(["Details", "Flags", "Urls", "Meta", "Images", "Trailers", "Guests", "Identity"]);
		await expect(dialog.locator("#parent-name")).toHaveCount(0);
		const name = dialog.getByRole("textbox", { name: "Name" });
		await expect(name).toHaveValue("One Off");
		await expect(name).toBeDisabled();
		await expect(dialog.getByText("Renaming a film is done from the admin Rename screen")).toBeVisible();
		await dialog.getByRole("textbox", { name: "Publisher" }).fill("Other Pictures");
		await shot(page, "film-edit-details");
		await dialog.getByRole("tab", { name: "Flags" }).click();
		await dialog.getByRole("checkbox", { name: "Tweeted" }).uncheck();
		await dialog.getByRole("button", { name: "Remove" }).click();
		await expect(dialog.getByText("Will remove on save")).toBeVisible();
		await shot(page, "film-edit-flags");
		await dialog.getByRole("tab", { name: "Meta" }).click();
		const release = dialog.getByRole("textbox", { name: "Release" });
		await expect(release).toHaveValue("1999");
		// The accepted formats show as a hint (a placeholder would only appear on focus); the error replaces it.
		await expect(dialog.getByText("Year (yyyy) or date (yyyy-mm-dd)")).toBeVisible();
		await release.fill("May 1999");
		await release.blur();
		await expect(dialog.getByText("A year (yyyy) or a date (yyyy-mm-dd)")).toBeVisible();
		await expect(dialog.getByText("Year (yyyy) or date (yyyy-mm-dd)")).toBeHidden();
		await expect(dialog.getByRole("button", { name: "Submit" })).toBeDisabled();
		await release.fill("1999-05-01");
		await dialog.getByRole("combobox", { name: "Subjects" }).click();
		await page.getByRole("option", { name: "Film", exact: true }).click();
		await page.keyboard.press("Escape");
		await expect(page.getByRole("listbox")).toHaveCount(0);
		await shot(page, "film-edit-meta");
		await dialog.getByRole("tab", { name: "Guests" }).click();
		await dialog.getByRole("combobox", { name: "Guests" }).click();
		await page.getByRole("option", { name: "Bob Sample" }).click();
		await page.keyboard.press("Escape");
		await expect(page.getByRole("listbox")).toHaveCount(0);
		await shot(page, "film-edit-guests");
		await dialog.getByRole("tab", { name: "Identity" }).click();
		const imdb = dialog.getByRole("textbox", { name: "IMDb id", exact: true });
		await expect(imdb).toHaveValue("tt0000002");
		await expect(dialog.getByRole("textbox", { name: "TheTVDB id" })).toHaveCount(0);
		await imdb.fill("tt0000009");
		await shot(page, "film-edit-identity");
		await dialog.getByRole("button", { name: "Submit" }).click();
		await expect.poll(() => sink.body).toEqual({
			release: "1999-05-01",
			tweeted: false,
			unBluesky: true,
			subjects: ["Arts", "Film"],
			guests: ["Ann Example", "Bob Sample"],
			publisher: "Other Pictures",
			imdbId: "tt0000009"
		});
		await expect(page.getByText("Film updated")).toBeVisible();
		expect(podcastEpisodeGet).toBe(false);
	});

	test("an untouched film dialog says No change and sends nothing", async ({ page }) => {
		const sink: { body?: unknown } = {};
		await fakeLookups(page);
		await fakePlayable(page, `film/${filmId}`, film, sink);
		const dialog = await openFromFilmPage(page);
		await dialog.getByRole("button", { name: "Submit" }).click();
		await expect(page.getByText("No change")).toBeVisible();
		expect(sink.body).toBeUndefined();
	});

	test("the review page film row has the curator menu; Edit Episode opens the film dialog and saves via PATCH /film", async ({ page }) => {
		const sink: { body?: unknown } = {};
		await fakeLookups(page);
		await fakePlayable(page, `film/${filmId}`, film, sink);
		const row = {
			id: filmId, title: "One Off", description: "Synthetic", posted: false, tweeted: false, ignored: false, removed: false,
			explicit: false, release: "1999-01-01T00:00:00Z", duration: "01:42:00", subjects: ["Arts"],
			contentKind: "Film", slug: "One Off", path: filmPath
		};
		let podcastPatch = false;
		await page.route(`**/episode/${filmId}`, (route) => json(route, row));
		await page.route("**/episode/*/*", (route) => {
			podcastPatch = true;
			return json(route, {}, 404);
		});
		await page.goto(`/episodes/${encodeURIComponent(JSON.stringify([filmId]))}`);
		// The API path is already encoded: the row link must not encode it again (%2520).
		await expect(page.locator("mat-card-title a")).toHaveAttribute("href", filmPath);
		await page.getByRole("button", { name: "Episode actions" }).click();
		// Post / Edit Podcast / Delete are podcast-only.
		await expect(page.getByRole("menuitem")).toHaveText([/Edit Episode/]);
		await page.getByRole("menuitem", { name: "Edit Episode" }).click();
		const dialog = page.locator("mat-dialog-container");
		await expect(dialog.getByRole("heading", { name: "Edit Film" })).toBeVisible();
		await dialog.getByRole("tab", { name: "Flags" }).click();
		await dialog.getByRole("checkbox", { name: "Ignored" }).check();
		await dialog.getByRole("button", { name: "Submit" }).click();
		await expect.poll(() => sink.body).toEqual({ ignored: true });
		await expect(page.getByText("Film updated")).toBeVisible();
		expect(podcastPatch).toBe(false);
	});

	test("a toolbar film submit shows Review + Edit; Edit opens the film dialog and Review lands on the film page by its Film short id", async ({ page }) => {
		test.slow(); // submit → snackbar → dialog → save → Review → page load: several serial round trips.
		const sink: { body?: unknown } = {};
		await fakeLookups(page);
		await fakePlayable(page, `film/${filmId}`, film, sink);
		await page.route("**/submit", (route) =>
			json(
				route,
				{ success: { episode: "Created", podcast: "NotCreated", contentKind: "Film", playableId: filmId } },
				200,
				{ "X-Origin": "true", "Access-Control-Expose-Headers": "X-Origin" }
			));
		await page.goto("/");
		await page.getByRole("img", { name: "Add Podcast" }).click();
		const add = page.locator("mat-dialog-container");
		await expect(add.getByRole("heading", { name: "Add Podcast" })).toBeVisible();
		await add.getByPlaceholder("Podcast Url").fill("https://www.youtube.com/watch?v=abc123def45");
		await add.getByRole("button", { name: "Save" }).click();
		const snack = page.locator("app-submit-url-origin-response-snackbar");
		await expect(snack.getByRole("button")).toHaveText(["Review", "Edit"]);
		await shot(page, "film-snackbar-review-edit");
		await snack.getByRole("button", { name: "Edit" }).click();
		const dialog = page.locator("mat-dialog-container");
		await expect(dialog.getByRole("heading", { name: "Edit Film" })).toBeVisible();
		await dialog.getByRole("tab", { name: "Flags" }).click();
		await dialog.getByRole("checkbox", { name: "Explicit" }).check();
		await dialog.getByRole("button", { name: "Submit" }).click();
		await expect.poll(() => sink.body).toEqual({ explicit: true });
		await page.getByRole("button", { name: "Review" }).click();
		await expect(page).toHaveURL(new RegExp(`/film/${encodeURIComponent("One Off")}/${filmShort}$`));
		expect(page.url()).not.toContain(filmId);
		await expect(page.getByRole("heading", { name: "One Off" })).toBeVisible();
	});
});
