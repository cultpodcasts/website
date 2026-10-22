import { expect, Route, test } from "@playwright/test";
import { GuidService } from "../src/app/guid.service";
import { catalogueE2eOrigin as appOrigin } from "./catalogue-origin";

/**
 * The film page's Trailers rail against real routes with a faked search (synthetic data only): trailers render as
 * rail cards under the hero, above the "More on" rails, with the same card as those rails.
 * Set CATALOGUE_EDIT_SCREENSHOTS=dir to save PR screenshots.
 */
const guids = new GuidService();
const filmId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const filmPath = `/film/${encodeURIComponent("One Off")}/${guids.toCatalogueShortId(filmId, "Film")}`;
const screenshotDir = process.env["CATALOGUE_EDIT_SCREENSHOTS"];

const trailers = [
	"00:07:58|https://www.youtube.com/watch?v=synthTrl001|Synthetic Teaser: The Book Group",
	"00:02:11|https://www.youtube.com/watch?v=synthTrl002|Synthetic Trailer | Official",
	"00:01:30|https://www.bbc.co.uk/iplayer/episode/synthetic01|Synthetic iPlayer Clip",
];

const film = {
	id: filmId,
	title: "One Off",
	seriesName: "One Off",
	description: "A synthetic film about nothing in particular.",
	contentKind: "Film",
	release: "2023-04-05T00:00:00.000Z",
	duration: "00:59:08",
	subjects: ["Arts"],
	youtubeId: "synthFilm01",
	trailers,
};

const related = Array.from({ length: 6 }, (_, i) => ({
	id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa${String(i).padStart(2, "0")}`,
	title: `Synthetic Episode ${i + 1}`,
	seriesName: "Synthetic Show",
	description: "Synthetic",
	release: "2026-01-02T00:00:00.000Z",
	duration: "00:32:58",
	subjects: ["Arts"],
	youtubeId: `synthEp${String(i).padStart(4, "0")}`,
}));

/** A synthetic 4:3 thumbnail naming its video id (like hqdefault.jpg). */
const thumbnail = (url: string) => {
	const id = new URL(url).pathname.split("/")[2] ?? "";
	const hue = [...id].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 360;
	return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360"><rect width="480" height="360" fill="hsl(${hue},45%,35%)"/>`
		+ `<text x="240" y="190" font-family="sans-serif" font-size="36" fill="#fff" text-anchor="middle">${id}</text></svg>`;
};

const json = (route: Route, body: unknown) =>
	route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

test.beforeEach(async ({ page }) => {
	await page.route("**/*", async (route) => {
		const url = route.request().url();
		if (url.startsWith(appOrigin) || (screenshotDir && /fonts\.(googleapis|gstatic)\.com/.test(url))) {
			await route.continue();
			return;
		}
		if (url.startsWith("https://i.ytimg.com/")) {
			await route.fulfill({ status: 200, contentType: "image/svg+xml", body: thumbnail(url) });
			return;
		}
		if (route.request().method() === "POST" && url.includes("/search")) {
			const filter = String(route.request().postDataJSON()?.filter ?? "");
			// The "More on" queries name the film too (`id ne`), so they are matched first.
			await json(route, { value: filter.includes("subjects/any") ? related : filter.includes(filmId) ? [film] : [] });
			return;
		}
		await json(route, {});
	});
});

test("the film page shows its trailers as a rail of cards above the More on rail", async ({ page }) => {
	await page.goto(filmPath);

	const rail = page.locator("app-film-trailers app-episode-rail");
	await expect(rail.locator(".rail__title")).toHaveText("Trailers");
	const cards = rail.locator("app-film-trailer-card");
	await expect(cards).toHaveCount(3);
	await expect(cards.locator(".episode-poster__episode")).toHaveText([
		"Synthetic Teaser: The Book Group",
		"Synthetic Trailer | Official",
		"Synthetic iPlayer Clip",
	]);

	const first = cards.nth(0);
	await expect(first.locator("img")).toHaveAttribute("src", "https://i.ytimg.com/vi/synthTrl001/hqdefault.jpg");
	await expect(first.locator(".episode-poster__badge--duration")).toHaveText("0:07:58");
	await expect(first.locator("button.episode-poster__cta")).toHaveText("Watch");
	await expect(first.locator(".episode-poster__byline")).toContainText("Trailer");
	await expect(first.locator("a.episode-poster__titles")).toHaveAttribute("href", "https://www.youtube.com/watch?v=synthTrl001");
	await expect(first.locator("a.episode-poster__titles")).toHaveAttribute("target", "_blank");
	await expect(cards.nth(2).locator("button.episode-poster__cta")).toHaveText("Watch");

	// Same rail as the related rails, and above them.
	const moreOn = page.locator("app-episode-rail", { hasText: "More on Arts" });
	await expect(moreOn).toBeVisible();
	const [trailersTop, moreOnTop] = await Promise.all([rail.boundingBox(), moreOn.boundingBox()]);
	expect(trailersTop!.y).toBeLessThan(moreOnTop!.y);

	if (screenshotDir) {
		await page.waitForTimeout(600);
		await page.screenshot({ path: `${screenshotDir}/film-trailers-rail.png`, fullPage: true });
	}

	// A YouTube trailer plays in the site player.
	await first.locator("button.episode-poster__cta").click();
	await expect(page.locator("app-episode-player")).toContainText("Synthetic Teaser: The Book Group");
	if (screenshotDir) {
		await page.waitForTimeout(600);
		await page.screenshot({ path: `${screenshotDir}/film-trailers-rail-playing.png` });
	}
});
