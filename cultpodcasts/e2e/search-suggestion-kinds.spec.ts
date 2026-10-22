import { expect, test, type Page } from "@playwright/test";
import { GuidService } from "../src/app/guid.service";
import { catalogueE2eOrigin as appOrigin } from "./catalogue-origin";

/**
 * Search typeahead with one row of each kind (subject, podcast, TV show, news outlet, film).
 * Real app (ng serve) with a faked /search-suggestions; made-up names only.
 * Set SUGGESTION_SCREENSHOTS=<dir> to save a screenshot of the open dropdown with real icon fonts.
 */

const filmId = "00112233-4455-4677-8899-aabbccddeeff";
const guids = new GuidService();

const corpus = {
	generatedAtUtc: "2026-10-21T00:00:00Z",
	entries: [
		{ type: "subject", canonical: "Invented Topic", searchText: "invented topic" },
		{ type: "podcast", canonical: "Invented Podcast", searchText: "invented podcast" },
		{ type: "tvShow", canonical: "Invented Nightly", searchText: "invented nightly" },
		{ type: "newsOrganisation", canonical: "Invented Desk", searchText: "invented desk" },
		{ type: "film", canonical: "Invented Film", searchText: "invented film", id: filmId },
		{ type: "film", canonical: "Invented Film Without Id", searchText: "invented film without id" }
	]
};

async function fakeApi(page: Page): Promise<void> {
	const screenshots = !!process.env["SUGGESTION_SCREENSHOTS"];
	await page.route("**/*", async (route) => {
		const url = route.request().url();
		if (url.startsWith(appOrigin) ||
			(screenshots && /fonts\.(googleapis|gstatic)\.com/.test(url))) {
			await route.continue();
			return;
		}
		if (new URL(url).pathname === "/homepage") {
			await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ recentEpisodes: [], episodeCount: 0, totalDuration: "0:00:00" }) });
			return;
		}
		if (new URL(url).pathname === "/search-suggestions") {
			await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(corpus) });
			return;
		}
		if (route.request().method() === "POST" && url.includes("/search")) {
			await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ value: [] }) });
			return;
		}
		await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
	});
}

async function openSuggestions(page: Page, term: string) {
	await fakeApi(page);
	await page.goto("/");
	const input = page.locator("#searchtext:visible").first();
	await input.click();
	await input.fill(term);
	const list = page.locator("#search-suggestions-listbox");
	await expect(list).toBeVisible();
	return list;
}

test.describe("search suggestions show every catalogue kind", () => {
	test("each kind gets its own icon", async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		const list = await openSuggestions(page, "invented");
		const icon = (kind: string) => list.locator(`li[data-kind="${kind}"] .suggestion-icon`).first();
		await expect(icon("subject")).toHaveText("sell");
		await expect(icon("podcast")).toHaveText("podcasts");
		await expect(icon("tvShow")).toHaveText("live_tv");
		await expect(icon("newsOrganisation")).toHaveText("newspaper");
		await expect(icon("film")).toHaveText("movie");
		await expect(list.locator('li[data-kind="tvShow"]')).toHaveAttribute("aria-label", "TV show: Invented Nightly");

		const dir = process.env["SUGGESTION_SCREENSHOTS"];
		if (dir) {
			await page.evaluate(() => document.fonts.ready);
			await page.waitForTimeout(500);
			await page.screenshot({ path: `${dir}/search-suggestion-kinds.png` });
		}
	});

	test("a TV show suggestion opens /tv/{name}", async ({ page }) => {
		const list = await openSuggestions(page, "invented nightly");
		await list.locator('li[data-kind="tvShow"]').first().dispatchEvent("mousedown");
		await expect(page).toHaveURL(/\/tv\/Invented%20Nightly$/);
	});

	test("a news outlet suggestion opens /news/{name}", async ({ page }) => {
		const list = await openSuggestions(page, "invented desk");
		await list.locator('li[data-kind="newsOrganisation"]').first().dispatchEvent("mousedown");
		await expect(page).toHaveURL(/\/news\/Invented%20Desk$/);
	});

	test("a film suggestion opens /film/{name}/{shortId}", async ({ page }) => {
		const list = await openSuggestions(page, "invented film");
		await list.locator('li[data-kind="film"]', { hasText: /^movieInvented Film$/ }).first().dispatchEvent("mousedown");
		const shortId = guids.toCatalogueShortId(filmId, "Film");
		await expect(page).toHaveURL(new RegExp(`/film/Invented%20Film/${shortId}$`));
	});

	test("a film suggestion without an id falls back to /search/{name}", async ({ page }) => {
		const list = await openSuggestions(page, "without id");
		await list.locator('li[data-kind="film"]').first().dispatchEvent("mousedown");
		await expect(page).toHaveURL(/\/search\/Invented%20Film%20Without%20Id$/);
	});
});
