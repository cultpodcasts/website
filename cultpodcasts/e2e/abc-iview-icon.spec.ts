import { expect, test, type Locator, type Page } from "@playwright/test";
import { GuidService } from "../src/app/guid.service";
import { catalogueE2eOrigin as appOrigin } from "./catalogue-origin";

/**
 * ABC iview service button: the live app-icon mark (white ABC lissajous over the
 * iview wordmark on the iview teal tile) beside YouTube, on the homepage hero and the
 * TV episode page. Real app (ng serve), faked /homepage and /search. Synthetic data only.
 *
 * Set IVIEW_SHOTS_DIR to save the button row (desktop + mobile) as PNGs (PR evidence only).
 */

const IVIEW_TEAL = "#2FB7B6";
const IVIEW_URL = "https://iview.abc.net.au/video/ZZ0000H000S00";
const YOUTUBE_ID = "inventedTv01";
const YOUTUBE_URL = `https://www.youtube.com/watch?v=${YOUTUBE_ID}`;
const SHOW = "Invented TV Show";
const EPISODE_ID = "0aa11bb2-2cc3-4dd4-8ee5-ff6677889900";
const shots = process.env["IVIEW_SHOTS_DIR"];
const guids = new GuidService();

// 16x9 dark PNG for every image so the hero lays out as live.
const PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAABAAAAAJCAIAAAC0SDtlAAAAE0lEQVR4nGOQkJAhCTGMahgUGgDT9SrBp83iigAAAABJRU5ErkJggg==",
	"base64"
);

function homepage() {
	const now = Date.now();
	const recentEpisodes = Array.from({ length: 3 }, (_, i) => ({
		id: `00000000-0000-4000-8000-0000000000b${i + 1}`,
		podcastName: SHOW,
		episodeTitle: `Invented TV episode ${i + 1}`,
		episodeDescription: "A synthetic TV episode description.",
		release: new Date(now - (i + 1) * 3_600_000).toISOString(),
		duration: "00:30:00",
		contentKind: "TvShowEpisode",
		services: { youtube: { url: YOUTUBE_URL }, abcIview: { url: IVIEW_URL } },
		ids: { youtube: YOUTUBE_ID },
		subjects: ["Invented subject"],
		image: `https://img.example.test/tv-${i}.png`
	}));
	return { recentEpisodes, episodeCount: recentEpisodes.length, totalDuration: "1:30:00" };
}

const tvDocument = {
	id: EPISODE_ID,
	title: "Invented TV episode",
	seriesName: SHOW,
	description: "A synthetic TV episode description.",
	contentKind: "TvShowEpisode",
	release: "2026-10-01T00:00:00.000Z",
	duration: "00:30:00",
	youtubeId: YOUTUBE_ID,
	svc: "abcIview:ZZ0000H000S00"
};

async function fakeApi(page: Page): Promise<void> {
	await page.route("**/*", async (route) => {
		const url = route.request().url();
		if (url.startsWith(appOrigin) || (shots && /^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(url))) {
			await route.continue();
			return;
		}
		if (url.includes("img.example.test") || route.request().resourceType() === "image") {
			await route.fulfill({ status: 200, contentType: "image/png", body: PNG });
			return;
		}
		if (new URL(url).pathname === "/homepage") {
			await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(homepage()) });
			return;
		}
		if (route.request().method() === "POST" && url.includes("/search")) {
			const filter = String(route.request().postDataJSON()?.filter ?? "");
			const hit = filter.includes(EPISODE_ID) || filter.includes(SHOW);
			await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ value: hit ? [tvDocument] : [] }) });
			return;
		}
		await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
	});
}

/** The rendered mat-icon SVG: teal rx 5.4 tile, two white paths, no <text>. */
async function expectIviewMark(link: Locator): Promise<void> {
	const icon = link.locator("mat-icon");
	await expect(icon).toHaveAttribute("data-mat-icon-name", "abc-iview");
	const mark = await icon.evaluate((el) => {
		const svg = el.querySelector("svg");
		const rect = svg?.querySelector("rect");
		const box = el.getBoundingClientRect();
		return {
			viewBox: svg?.getAttribute("viewBox"),
			fill: rect?.getAttribute("fill"),
			rx: rect?.getAttribute("rx"),
			texts: svg?.querySelectorAll("text").length ?? -1,
			paths: Array.from(svg?.querySelectorAll("path") ?? []).map((p) => p.getAttribute("fill")),
			width: box.width,
			height: box.height
		};
	});
	expect(mark.viewBox).toBe("0 0 24 24");
	expect(mark.fill).toBe(IVIEW_TEAL);
	expect(mark.rx).toBe("5.4");
	expect(mark.texts).toBe(0);
	expect(mark.paths).toEqual(["#fff", "#fff"]);
	expect(mark.width).toBeGreaterThan(0);
	expect(mark.height).toBeGreaterThan(0);
}

/** Same button box as YouTube, on the same row, right after it. */
async function expectBesideYouTube(links: Locator): Promise<void> {
	await expect(links).toHaveCount(2);
	const labels = await links.evaluateAll((els) => els.map((a) => a.getAttribute("aria-label")));
	expect(labels).toEqual(["YouTube", "ABC iview"]);
	await expect(links.nth(1)).toHaveAttribute("href", IVIEW_URL);
	await expect(links.nth(1)).toHaveAttribute("target", "_blank");
	const [yt, iv] = await links.evaluateAll((els) => els.map((a) => {
		const b = a.getBoundingClientRect();
		const i = a.querySelector("mat-icon")!.getBoundingClientRect();
		return { top: b.top, left: b.left, right: b.right, width: b.width, height: b.height, iconW: i.width, iconH: i.height };
	}));
	expect(Math.abs(iv.width - yt.width)).toBeLessThanOrEqual(1);
	expect(Math.abs(iv.height - yt.height)).toBeLessThanOrEqual(1);
	expect(Math.abs(iv.iconW - yt.iconW)).toBeLessThanOrEqual(1);
	expect(Math.abs(iv.top - yt.top)).toBeLessThanOrEqual(1);
	expect(iv.left).toBeGreaterThanOrEqual(yt.right - 1);
}

async function shoot(page: Page, links: Locator, name: string): Promise<void> {
	if (!shots) {
		return;
	}
	await page.waitForTimeout(400);
	const boxes = await links.evaluateAll((els) => els.map((a) => a.getBoundingClientRect().toJSON() as DOMRect));
	if (!boxes.length) {
		return;
	}
	const pad = 24;
	const left = Math.min(...boxes.map((b) => b.left)), top = Math.min(...boxes.map((b) => b.top));
	const right = Math.max(...boxes.map((b) => b.right)), bottom = Math.max(...boxes.map((b) => b.bottom));
	await page.screenshot({
		path: `${shots}/${name}.png`,
		clip: { x: Math.max(0, left - pad * 2), y: Math.max(0, top - pad), width: right - left + pad * 4, height: bottom - top + pad * 2 }
	});
}

const viewports = [
	{ name: "desktop", width: 1440, height: 900 },
	{ name: "mobile", width: 390, height: 844 }
] as const;

test.describe("ABC iview service button", () => {
	// Screenshot runs only: 2x so the PR evidence is legible.
	test.use({ deviceScaleFactor: shots ? 2 : 1 });
	for (const vp of viewports) {
		test(`${vp.name}: homepage hero shows the ABC iview mark beside YouTube`, async ({ page }) => {
			await page.setViewportSize({ width: vp.width, height: vp.height });
			await fakeApi(page);
			await page.goto("/");
			const links = page.locator(".billboard__actions app-episode-links a");
			await expect(links.first()).toBeVisible();
			await page.locator(".billboard__actions").scrollIntoViewIfNeeded();
			await shoot(page, links, `hero-${vp.name}`);
			await expectBesideYouTube(links);
			await expectIviewMark(links.nth(1));
		});

		test(`${vp.name}: TV episode page shows the ABC iview mark beside YouTube`, async ({ page }) => {
			await page.setViewportSize({ width: vp.width, height: vp.height });
			await fakeApi(page);
			const shortId = guids.toCatalogueShortId(EPISODE_ID, "TvShowEpisode");
			await page.goto(`/tv/${encodeURIComponent(SHOW)}/${shortId}`);
			const links = page.locator("app-podcast-episode app-episode-links #episodelinks a");
			await expect(links.first()).toBeVisible();
			await links.first().scrollIntoViewIfNeeded();
			await shoot(page, links, `episode-${vp.name}`);
			await expectBesideYouTube(links);
			await expectIviewMark(links.nth(1));
		});
	}
});
