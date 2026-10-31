import { expect, Page, test } from "@playwright/test";
import { GuidService } from "../src/app/guid.service";
import { catalogueE2eOrigin as appOrigin } from "./catalogue-origin";

const id = "00112233-4455-4677-8899-aabbccddeeff";
const guids = new GuidService();

function documentFor(kind: string, title: string, parent: string) {
	return {
		id,
		title,
		seriesName: parent,
		description: "Desc",
		contentKind: kind,
		release: "2026-01-02T00:00:00.000Z",
		duration: "01:00:00"
	};
}

function documentsForFilter(filter: string) {
	if (filter.includes("eq 'One Off'")) {
		return [documentFor("Film", "One Off", "")];
	}
	if (filter.includes("eq 'Nightly'")) {
		return [documentFor("TvShowEpisode", "Part", "Nightly")];
	}
	if (filter.includes("eq 'Desk'")) {
		return [documentFor("NewsReport", "Bulletin", "Desk")];
	}
	if (filter.includes("eq 'Show'")) {
		return [documentFor("Episode", "Part", "Show")];
	}
	if (filter.includes(id) && !filter.includes("seriesName") && !filter.includes("podcastName")) {
		return [documentFor("Film", "One Off", "")];
	}
	return [];
}

test.beforeEach(async ({ page }) => {
	await page.route("**/*", async (route) => {
		const url = route.request().url();
		// Screenshot runs (SERIES_HUB_SCREENSHOTS) load the real icon/text fonts; tests never need them.
		if (url.startsWith(appOrigin) ||
			(process.env["SERIES_HUB_SCREENSHOTS"] && /fonts\.(googleapis|gstatic)\.com/.test(url))) {
			await route.continue();
			return;
		}
		if (route.request().method() === "POST" && url.includes("/search")) {
			const filter = String(route.request().postDataJSON()?.filter ?? "");
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ value: documentsForFilter(filter) })
			});
			return;
		}
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: "{}"
		});
	});
});

test.describe("catalogue pages with a faked search API", () => {
	test("a film short id shows the title and no parent", async ({ page }) => {
		const shortId = guids.toCatalogueShortId(id, "Film");
		await page.goto(`/film/${encodeURIComponent("One Off")}/${shortId}`);
		await expect(page.getByRole("heading", { name: "One Off" })).toBeVisible();
		await expect(page.locator("a.hero-pill")).toHaveCount(0);
	});

	test("an old podcast short id for a film leaves for /film/ without saying not found", async ({ page }) => {
		const legacy = guids.toBase64(id);
		await page.goto(`/podcast/${encodeURIComponent("Old Show")}/${legacy}`);
		await expect(page).toHaveURL(new RegExp(`/film/${encodeURIComponent("One Off")}/`));
		await expect(page.getByText("Episode not found")).toHaveCount(0);
		await expect(page.getByRole("heading", { name: "One Off" })).toBeVisible();
	});

	test("a news organisation hub lists the report from the faked search", async ({ page }) => {
		await page.goto(`/news/${encodeURIComponent("Desk")}`);
		await expect(page.getByRole("heading", { name: "Desk" })).toBeVisible();
		await expect(page.getByText("Bulletin")).toBeVisible();
	});

	test("a podcast episode stays on /podcast/", async ({ page }) => {
		const shortId = guids.toBase64(id);
		await page.goto(`/podcast/${encodeURIComponent("Show")}/${shortId}`);
		await expect(page).toHaveURL(new RegExp(`/podcast/${encodeURIComponent("Show")}/${shortId}`));
		await expect(page.getByText("Part")).toBeVisible();
		await expect(page.getByText("Episode not found")).toHaveCount(0);
	});
});

const outletId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
/** Set SERIES_HUB_SCREENSHOTS=dir to save the open menus as PNGs (PR evidence only). */
const screenshotDir = process.env["SERIES_HUB_SCREENSHOTS"];

async function signInAs(page: Page, roles: string[]): Promise<void> {
	await page.addInitScript((r) => {
		(globalThis as { __E2E_CURATOR__?: boolean }).__E2E_CURATOR__ = true;
		(globalThis as { __E2E_ROLES__?: string[] }).__E2E_ROLES__ = r;
	}, roles);
}

async function openHubMenu(page: Page) {
	await page.locator("app-series-hub-menu #sort").click();
	const menu = page.getByRole("menu");
	await expect(menu).toBeVisible();
	return menu;
}

test.describe("news and TV hub menu", () => {
	test("curator + admin get Index, Edit, Submit Url and Rename alongside sort on a news hub", async ({ page }) => {
		await signInAs(page, ["Curator", "Admin"]);
		await page.goto(`/news/${encodeURIComponent("Desk")}`);
		await expect(page.getByText("Bulletin")).toBeVisible();
		const menu = await openHubMenu(page);
		await expect(menu.getByRole("menuitem")).toHaveText([
			/Index News Outlet/,
			/Edit News Outlet/,
			/Submit Url for News Outlet/,
			/Rename News Outlet/,
			/Newest first/,
			/Oldest first/
		]);
		if (screenshotDir) {
			await page.waitForTimeout(400); // menu open animation
			await page.screenshot({ path: `${screenshotDir}/news-hub-menu-curator-admin.png` });
		}
	});

	test("anonymous visitors only get the sort items on a TV hub", async ({ page }) => {
		await page.goto(`/tv/${encodeURIComponent("Nightly")}`);
		await expect(page.getByText("Part")).toBeVisible();
		const menu = await openHubMenu(page);
		await expect(menu.getByRole("menuitem")).toHaveText([/Newest first/, /Oldest first/]);
		if (screenshotDir) {
			await page.screenshot({ path: `${screenshotDir}/tv-hub-menu-anonymous.png` });
		}
	});

	test("Oldest first reloads the hub with release asc", async ({ page }) => {
		await page.goto(`/tv/${encodeURIComponent("Nightly")}`);
		await expect(page.getByText("Part")).toBeVisible();
		const ordered = page.waitForRequest((r) =>
			r.method() === "POST" && r.url().includes("/search") && r.postDataJSON()?.orderby === "release asc");
		await (await openHubMenu(page)).getByRole("menuitem", { name: /Oldest first/ }).click();
		await ordered;
		await expect(page.locator("app-series-hub-menu #sort")).toContainText("Oldest first");
	});

	test("Submit Url for News Outlet sends the URL to the outlet by id, not as a podcast", async ({ page }) => {
		await signInAs(page, ["Curator"]);
		let submitBody: Record<string, unknown> | undefined;
		await page.route("**/newsorganisation/Desk", (route) =>
			route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: outletId, name: "Desk" }) }));
		await page.route("**/submit", async (route) => {
			submitBody = route.request().postDataJSON();
			await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
		});
		await page.goto(`/news/${encodeURIComponent("Desk")}`);
		await expect(page.getByText("Bulletin")).toBeVisible();
		await (await openHubMenu(page)).getByRole("menuitem", { name: /Submit Url for News Outlet/ }).click();
		const dialog = page.locator("mat-dialog-container");
		await expect(dialog.getByRole("heading", { name: "Submit URL for News Outlet" })).toBeVisible();
		await expect(dialog.locator("#submit-target")).toHaveText("News Outlet: Desk");
		await dialog.getByPlaceholder("Podcast Url").fill("https://www.youtube.com/watch?v=abc123def45");
		await expect(page.getByRole("menu")).toHaveCount(0);
		if (screenshotDir) {
			await page.screenshot({ path: `${screenshotDir}/news-hub-submit-dialog.png` });
		}
		await dialog.getByRole("button", { name: "Save" }).click();
		await expect.poll(() => submitBody).toBeDefined();
		expect(submitBody).toEqual({
			url: "https://www.youtube.com/watch?v=abc123def45",
			parentKind: "NewsOrganisation",
			parentId: outletId,
			parentName: "Desk"
		});
	});

	test("Index News Outlet POSTs to the outlet index route by name and Review reloads the hub", async ({ page }) => {
		await signInAs(page, ["Curator"]);
		let indexPosts = 0;
		await page.route("**/newsorganisation/index/Desk", async (route) => {
			expect(route.request().method()).toBe("POST");
			indexPosts++;
			await route.fulfill({
				status: 200, contentType: "application/json",
				body: JSON.stringify({ indexedItemIds: ["a", "b"], searchIndexerState: "Executed" })
			});
		});
		await page.goto(`/news/${encodeURIComponent("Desk")}`);
		await expect(page.getByText("Bulletin")).toBeVisible();
		await (await openHubMenu(page)).getByRole("menuitem", { name: /Index News Outlet/ }).click();
		const snack = page.locator("mat-snack-bar-container");
		await expect(snack).toContainText("News Outlet indexed. 2 items updated.");
		expect(indexPosts).toBe(1);
		await expect(page.getByRole("menu")).toHaveCount(0);
		if (screenshotDir) {
			await page.waitForTimeout(400); // let the menu fade and the snackbar settle for the evidence shot
			await page.screenshot({ path: `${screenshotDir}/news-hub-index-snackbar.png` });
		}
		const reloaded = page.waitForRequest((r) => r.method() === "POST" && r.url().includes("/search"));
		await snack.getByRole("button", { name: "Review" }).click();
		await reloaded;
		await expect(page).toHaveURL(/\/news\/Desk$/);
	});

	test("Index TV Show says when the show is not indexable", async ({ page }) => {
		await signInAs(page, ["Curator"]);
		await page.route("**/tvshow/index/Nightly", (route) =>
			route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ reason: "NotIndexable" }) }));
		await page.goto(`/tv/${encodeURIComponent("Nightly")}`);
		await expect(page.getByText("Part")).toBeVisible();
		await (await openHubMenu(page)).getByRole("menuitem", { name: /Index TV Show/ }).click();
		await expect(page.locator("mat-snack-bar-container")).toContainText("TV Show not indexable");
	});

	test("Index News Outlet says to try again later when the index runs out of time (504)", async ({ page }) => {
		await signInAs(page, ["Curator"]);
		await page.route("**/newsorganisation/index/Desk", (route) =>
			route.fulfill({
				status: 504,
				contentType: "application/json",
				body: JSON.stringify({ reason: "TimedOut", message: "Indexing ran out of time. Try again later." })
			}));
		await page.goto(`/news/${encodeURIComponent("Desk")}`);
		await expect(page.getByText("Bulletin")).toBeVisible();
		await (await openHubMenu(page)).getByRole("menuitem", { name: /Index News Outlet/ }).click();
		await expect(page.locator("mat-snack-bar-container"))
			.toContainText("News Outlet indexing ran out of time. Anything it saved will appear shortly; try again later.");
	});

	test("admin Rename posts the new name to the TV show rename route", async ({ page }) => {
		await signInAs(page, ["Curator", "Admin"]);
		let renameBody: Record<string, unknown> | undefined;
		await page.route("**/tvshow/name/Nightly", async (route) => {
			renameBody = route.request().postDataJSON();
			await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ indexState: "Executed" }) });
		});
		await page.goto(`/tv/${encodeURIComponent("Nightly")}`);
		await expect(page.getByText("Part")).toBeVisible();
		await (await openHubMenu(page)).getByRole("menuitem", { name: /Rename TV Show/ }).click();
		const dialog = page.locator("mat-dialog-container");
		await dialog.locator("#newCatalogueParentName").fill("Nightly Two");
		await dialog.getByRole("button", { name: "Submit" }).click();
		await expect.poll(() => renameBody).toEqual({ newName: "Nightly Two" });
		await expect(page.getByText('TV Show name changed to "Nightly Two". Index updated.')).toBeVisible();
	});

	test("Edit (tabbed like the podcast edit) loads the outlet and PATCHes only the changed fields by id", async ({ page }) => {
		await signInAs(page, ["Curator"]);
		let patchBody: Record<string, unknown> | undefined;
		await page.route("**/newsorganisation/Desk", (route) =>
			route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ id: outletId, name: "Desk", publisher: "Desk Media", twitterHandle: "@desk" })
			}));
		// Same /subjects and /languages lookups as the podcast edit dialog.
		await page.route("**/subjects", (route) =>
			route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ name: "Politics" }, { name: "Sport" }]) }));
		await page.route("**/languages", (route) =>
			route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ en: "English", fr: "French" }) }));
		await page.route(`**/newsorganisation/${outletId}`, async (route) => {
			patchBody = route.request().postDataJSON();
			await route.fulfill({ status: 202, body: "" });
		});
		await page.goto(`/news/${encodeURIComponent("Desk")}`);
		await expect(page.getByText("Bulletin")).toBeVisible();
		await (await openHubMenu(page)).getByRole("menuitem", { name: /Edit News Outlet/ }).click();
		const dialog = page.locator("mat-dialog-container");
		await expect(dialog.getByRole("tab")).toHaveText(["Details", "Flags", "Subjects", "Social", "Meta", "Regexs"]);
		const channel = dialog.getByLabel("YouTube Id");
		await expect(channel).toHaveValue("");
		await expect(page.getByRole("menu")).toHaveCount(0);
		await channel.fill("UCaaaaaaaaaaaaaaaaaaaaaa");
		if (screenshotDir) {
			await page.screenshot({ path: `${screenshotDir}/news-hub-edit-dialog.png` });
		}
		await dialog.getByRole("tab", { name: "Subjects" }).click();
		await dialog.getByRole("combobox", { name: "Default Subject" }).click();
		await page.getByRole("option", { name: "Politics" }).click();
		await dialog.getByRole("combobox", { name: "Ignored Subjects" }).click();
		await page.getByRole("option", { name: "Sport" }).click();
		await page.keyboard.press("Escape");
		await expect(page.getByRole("listbox")).toHaveCount(0);
		if (screenshotDir) {
			await page.waitForTimeout(600); // let the tab slide finish
			await page.screenshot({ path: `${screenshotDir}/news-hub-edit-dialog-subjects.png` });
		}
		await dialog.getByRole("tab", { name: "Meta" }).click();
		const publisher = dialog.getByLabel("Publisher");
		await expect(publisher).toHaveValue("Desk Media");
		await publisher.fill("Desk Media Group");
		const language = dialog.getByRole("combobox", { name: "Language" });
		await expect(language).toHaveText("No Language");
		await language.click();
		await page.getByRole("option", { name: "French" }).click();
		if (screenshotDir) {
			await page.waitForTimeout(600); // let the tab slide finish
			await page.screenshot({ path: `${screenshotDir}/news-hub-edit-dialog-meta.png` });
		}
		await dialog.getByRole("button", { name: "Save" }).click();
		await expect.poll(() => patchBody).toEqual({
			youTubeChannelId: "UCaaaaaaaaaaaaaaaaaaaaaa",
			publisher: "Desk Media Group",
			defaultSubject: "Politics",
			ignoredSubjects: ["Sport"],
			language: "fr"
		});
		await expect(page.getByText("News Outlet updated")).toBeVisible();
	});

	test.describe("history dates in a timezone ahead of UTC", () => {
		// UTC+14: 2026-10-30T23:45:12Z is 31 Oct locally, so local-date formatting would show (2026-10-31) and fail.
		test.use({ timezoneId: "Pacific/Kiritimati" });

		test("Edit News Outlet still renders when the outlet has previous playlist ids (dates arrive as Date objects)", async ({ page }) => {
			await signInAs(page, ["Curator"]);
			await page.route("**/newsorganisation/Desk", (route) =>
				route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify({
						id: outletId,
						name: "Desk",
						publisher: "Desk Media",
						youTubePlaylistId: "PLsyntheticplaylistnew000000000000",
						youTubePlaylistIdHistory: [{ id: "PLsyntheticplaylistold000000000000", replacedAt: "2026-10-30T23:45:12.345Z" }]
					})
				}));
			await page.route("**/subjects", (route) =>
				route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ name: "Politics" }]) }));
			await page.route("**/languages", (route) =>
				route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ en: "English" }) }));
			const pageErrors: string[] = [];
			page.on("pageerror", (error) => pageErrors.push(error.message));
			await page.goto(`/news/${encodeURIComponent("Desk")}`);
			await expect(page.getByText("Bulletin")).toBeVisible();
			await (await openHubMenu(page)).getByRole("menuitem", { name: /Edit News Outlet/ }).click();
			const dialog = page.locator("mat-dialog-container");
			await expect(dialog.getByRole("tab")).toHaveText(["Details", "Flags", "Subjects", "Social", "Meta", "Regexs"]);
			await expect(dialog.getByLabel("YouTube Playlist Id")).toHaveValue("PLsyntheticplaylistnew000000000000");
			await expect(dialog.getByText("PLsyntheticplaylistold000000000000 (2026-10-30)")).toBeVisible();
			await expect(dialog.getByLabel("YouTube Publication Delay")).toBeVisible();
			await expect(dialog.getByRole("button", { name: "Save" })).toBeVisible();
			// The bug threw "old.replacedAt.slice is not a function" while rendering the Details tab.
			expect(pageErrors.filter((message) => /replacedAt|slice is not a function/.test(message))).toEqual([]);
		});
	});
});

test.describe("news report page carousels link with short ids", () => {
	const relatedNews = "11111111-2222-4333-8444-555555555555";
	const relatedTv = "66666666-7777-4888-8999-aaaaaaaaaaaa";
	const relatedFilm = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";

	test("More from the outlet and the subject rail use prefixed short ids, never raw guids", async ({ page }) => {
		const doc = (docId: string, kind: string, title: string, parent: string) => ({
			...documentFor(kind, title, parent),
			id: docId,
			subjects: ["Synthetic Subject"]
		});
		await page.route("**/search", async (route) => {
			if (route.request().method() !== "POST") {
				await route.fallback();
				return;
			}
			const filter = String(route.request().postDataJSON()?.filter ?? "");
			let value: unknown[] = [];
			if (filter.includes("id ne") && filter.includes("subjects/any")) {
				value = [doc(relatedTv, "TvShowEpisode", "Synthetic Tv Part", "Nightly"), doc(relatedFilm, "Film", "Synthetic Film", "")];
			} else if (filter.includes("id ne")) {
				value = [doc(relatedNews, "NewsReport", "Synthetic Follow Up", "Desk")];
			} else if (filter.includes("eq 'Desk'") || filter.includes(id)) {
				value = [doc(id, "NewsReport", "Bulletin", "Desk")];
			}
			await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ value }) });
		});

		const shortId = guids.toCatalogueShortId(id, "NewsReport");
		await page.goto(`/news/Desk/${shortId}`);
		await expect(page.getByRole("heading", { name: "Bulletin" })).toBeVisible();
		await expect(page.getByText("Synthetic Follow Up").first()).toBeVisible();
		await expect(page.getByText("Synthetic Film").first()).toBeVisible();

		const hrefs = await page.locator("a[href]").evaluateAll(as => as.map(a => a.getAttribute("href") ?? ""));
		expect(hrefs).toContain(`/news/Desk/${guids.toCatalogueShortId(relatedNews, "NewsReport")}`);
		expect(hrefs).toContain(`/tv/Nightly/${guids.toCatalogueShortId(relatedTv, "TvShowEpisode")}`);
		expect(hrefs).toContain(`/film/Synthetic%20Film/${guids.toCatalogueShortId(relatedFilm, "Film")}`);
		for (const raw of [id, relatedNews, relatedTv, relatedFilm]) {
			expect(hrefs.filter(h => h.includes(raw))).toEqual([]);
		}
		await expect(page).toHaveURL(new RegExp(`/news/Desk/${shortId}$`));
	});
});

test.describe("podcast episode links use the short id", () => {
	const ids = ["11111111-2222-4333-8444-555555555555", "66666666-7777-4888-8999-aaaaaaaaaaaa"];
	const episodeDoc = (docId: string, title: string) => ({
		...documentFor("Episode", title, "Synthetic Pod"),
		id: docId,
		subjects: ["Synthetic Subject"]
	});
	const isGuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

	async function fakeEpisodes(page: Page) {
		await page.route("**/search", async (route) => {
			if (route.request().method() !== "POST") {
				await route.fallback();
				return;
			}
			const filter = String(route.request().postDataJSON()?.filter ?? "");
			const all = [episodeDoc(ids[0], "Synthetic First"), episodeDoc(ids[1], "Synthetic Second")];
			const byId = all.filter(doc => filter.includes(`id eq '${doc.id}'`));
			const value = byId.length ? byId : filter.includes("id eq") ? [] : all;
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ "@odata.count": value.length, value })
			});
		});
	}

	async function episodeHrefs(page: Page): Promise<string[]> {
		const hrefs = await page.locator("a[href]").evaluateAll(as => as.map(a => a.getAttribute("href") ?? ""));
		return hrefs.filter(h => h.startsWith("/podcast/"));
	}

	for (const path of ["/podcast/Synthetic%20Pod", "/search/Synthetic", "/subject/Synthetic%20Subject"]) {
		test(`${path} links each podcast episode by its 22-char short id and never a raw guid`, async ({ page }) => {
			await fakeEpisodes(page);
			await page.goto(path);
			await expect(page.getByText("Synthetic First").first()).toBeVisible();
			const hrefs = await episodeHrefs(page);
			for (const docId of ids) {
				expect(hrefs).toContain(`/podcast/Synthetic%20Pod/${guids.toBase64(docId)}`);
			}
			expect(hrefs.filter(h => isGuid.test(h))).toEqual([]);
		});
	}

	test("an old full-guid podcast episode URL 301s once to the short id and opens the episode", async ({ page }) => {
		await fakeEpisodes(page);
		const shortUrl = `/podcast/Synthetic%20Pod/${guids.toBase64(ids[0])}`;
		const guidUrl = `/podcast/Synthetic%20Pod/${ids[0]}`;

		const response = await page.goto(guidUrl);
		await expect(page).toHaveURL(new RegExp(`${shortUrl}$`));
		await expect(page.getByText("Synthetic First").first()).toBeVisible();
		await expect(page.getByText("Episode not found")).toHaveCount(0);

		// Exactly one hop: the GUID request answered 301 with the short id, and nothing before it.
		const hop = response!.request().redirectedFrom();
		expect(hop, "GUID URL should be redirected").not.toBeNull();
		expect(new URL(hop!.url()).pathname).toBe(guidUrl);
		expect((await hop!.response())!.status()).toBe(301);
		expect(hop!.redirectedFrom()).toBeNull();
		expect(new URL(response!.url()).pathname).toBe(shortUrl);
		expect(response!.status()).toBe(200);

		// The short-id page does not redirect again (no loop) once the browser app takes over.
		await page.waitForTimeout(500);
		expect(new URL(page.url()).pathname).toBe(shortUrl);
	});

	test("an in-app link to an old full-guid podcast episode URL replaces itself with the short id", async ({ page }) => {
		await fakeEpisodes(page);
		const shortUrl = `/podcast/Synthetic%20Pod/${guids.toBase64(ids[0])}`;
		await page.goto("/search/Synthetic");
		await expect(page.getByText("Synthetic First").first()).toBeVisible();
		const before = await page.evaluate(() => history.length);

		// Client-side navigation to the old GUID path (history entry + popstate, as the router sees a back/forward or pasted in-app URL).
		await page.evaluate((target) => {
			const a = document.createElement("a");
			a.href = target;
			a.textContent = "old link";
			a.addEventListener("click", (e) => {
				e.preventDefault();
				history.pushState(null, "", target);
				window.dispatchEvent(new PopStateEvent("popstate", { state: null }));
			});
			document.body.appendChild(a);
			a.click();
		}, `/podcast/Synthetic%20Pod/${ids[0]}`);

		await expect(page).toHaveURL(new RegExp(`${shortUrl}$`));
		await expect(page.getByText("Synthetic First").first()).toBeVisible();
		await expect(page.getByText("Episode not found")).toHaveCount(0);
		// The GUID entry was replaced by the short id rather than adding a second entry.
		expect(await page.evaluate(() => history.length)).toBe(before + 1);
		await page.goBack();
		await expect(page).toHaveURL(/\/search\/Synthetic$/);
	});
});
