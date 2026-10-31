import { expect, test, type Locator, type Page } from "@playwright/test";
import { catalogueE2eOrigin as appOrigin } from "./catalogue-origin";

/**
 * CBC Gem service button: the live CBC Gem app icon (white CBC gem on the Gem red tile),
 * centred in its round icon button exactly like its ABC iview / YouTube neighbours, on the
 * curator Review Episodes and Outgoing Episodes cards and the homepage hero, plus every
 * service button on a Discovery card (same .curator-card__platforms rule). Real app (ng serve),
 * faked API and Auth0. Synthetic data only.
 *
 * Set CBC_GEM_SHOTS_DIR to save the button row as PNGs (PR evidence only).
 */

const GEM_RED = "#E60505";
const GEM_URL = "https://gem.cbc.ca/invented-film";
const IVIEW_URL = "https://iview.abc.net.au/video/ZZ0000H000S00";
const YOUTUBE_ID = "inventedGem1";
const YOUTUBE_URL = `https://www.youtube.com/watch?v=${YOUTUBE_ID}`;
const EPISODE_ID = "0cc11bb2-2cc3-4dd4-8ee5-ff66778899aa";
const shots = process.env["CBC_GEM_SHOTS_DIR"];
const services = { youtube: { url: YOUTUBE_URL }, abcIview: { url: IVIEW_URL }, cbcGem: { url: GEM_URL } };

const PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAABAAAAAJCAIAAAC0SDtlAAAAE0lEQVR4nGOQkJAhCTGMahgUGgDT9SrBp83iigAAAABJRU5ErkJggg==",
	"base64"
);

function homepage() {
	const now = Date.now();
	const recentEpisodes = Array.from({ length: 3 }, (_, i) => ({
		id: `00000000-0000-4000-8000-0000000000c${i + 1}`,
		podcastName: "Invented Show",
		episodeTitle: `Invented episode ${i + 1}`,
		episodeDescription: "A synthetic episode description.",
		release: new Date(now - (i + 1) * 3_600_000).toISOString(),
		duration: "00:43:00",
		contentKind: "TvShowEpisode",
		services,
		ids: { youtube: YOUTUBE_ID },
		subjects: ["Invented subject"],
		image: `https://img.example.test/gem-${i}.png`
	}));
	return { recentEpisodes, episodeCount: recentEpisodes.length, totalDuration: "2:09:00" };
}

const apiEpisode = {
	id: EPISODE_ID,
	title: "Invented film",
	podcastId: "0cc11bb2-2cc3-4dd4-8ee5-ff66778899ab",
	podcastName: "Invented Show",
	description: "A synthetic episode description.",
	posted: false,
	tweeted: false,
	bluesky: false,
	ignored: false,
	removed: false,
	explicit: false,
	release: "2026-10-27T00:00:00.000Z",
	duration: "00:43:00",
	ids: { youtube: YOUTUBE_ID },
	services,
	subjects: ["Invented subject"]
};

/** One Discovery card with YouTube (plus the Views / Members meta beside it), Spotify and Apple links. */
const discovery = {
	ids: ["0cc11bb2-2cc3-4dd4-8ee5-ff66778899ac"],
	hiddenCount: 0,
	awaitingReview: [],
	results: [{
		id: "0cc11bb2-2cc3-4dd4-8ee5-ff66778899ad",
		urls: {
			youtube: YOUTUBE_URL,
			spotify: "https://open.spotify.com/episode/inventedGem01",
			apple: "https://podcasts.apple.com/podcast/id1?i=2"
		},
		episodeName: "Invented discovery episode",
		showName: "Invented Show",
		episodeDescription: "A synthetic discovery description.",
		showDescription: "A synthetic show.",
		released: "2026-10-27T00:00:00.000Z",
		duration: "00:43:00",
		subjects: ["Invented subject"],
		subjectMatches: null,
		youTubeViews: 1234,
		youTubeChannelMembers: 56,
		containsSyntheticMedia: false,
		guests: [],
		imageUrl: "https://img.example.test/discovery.png",
		enrichedTimeFromApple: false,
		enrichedUrlFromSpotify: false,
		matchingPodcasts: null,
		acceptProbability: null,
		autoHidden: false,
		isFocused: false
	}]
};

/** Empty shared curation session (no selections, votes or presence). */
const discoverySession = {
	includedDocumentIds: discovery.ids,
	pendingDocumentIds: [],
	selectedResultIds: [],
	votesByResultId: {},
	presence: {},
	rev: 1,
	updatedAt: "2026-10-27T00:00:00.000Z"
};

async function fakeApi(page: Page): Promise<void> {
	await page.addInitScript(() => {
		(globalThis as { __E2E_CURATOR__?: boolean }).__E2E_CURATOR__ = true;
		(globalThis as { __E2E_ROLES__?: string[] }).__E2E_ROLES__ = ["Curator"];
	});
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
		const path = new URL(url).pathname;
		if (path === "/homepage") {
			await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(homepage()) });
			return;
		}
		if (route.request().method() === "GET" && path.startsWith("/episode/") && path.endsWith(EPISODE_ID)) {
			await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(apiEpisode) });
			return;
		}
		if (route.request().method() === "GET" && path === "/episodes/outgoing") {
			await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([apiEpisode]) });
			return;
		}
		if (route.request().method() === "GET" && path === "/discovery-curation") {
			await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(discovery) });
			return;
		}
		if (path.startsWith("/discovery-curation/session")) {
			await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(discoverySession) });
			return;
		}
		if (path === "/discovery-info") {
			await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ documentCount: 1, numberOfResults: 1 }) });
			return;
		}
		if (route.request().method() === "POST" && url.includes("/search")) {
			await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ value: [] }) });
			return;
		}
		await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
	});
}

type Geometry = { label: string | null; top: number; width: number; height: number; iconW: number; iconH: number; dx: number; dy: number; svgW: number; svgH: number };

/** Button box, mat-icon box, rendered <svg> box, and how far the svg's centre sits from the button's centre. */
async function geometry(links: Locator): Promise<Geometry[]> {
	return links.evaluateAll((els) => els.map((a) => {
		const b = a.getBoundingClientRect();
		const icon = a.querySelector("mat-icon")!;
		const i = icon.getBoundingClientRect();
		const s = (icon.querySelector("svg") ?? icon).getBoundingClientRect();
		return {
			label: a.getAttribute("aria-label"),
			top: b.top,
			width: b.width,
			height: b.height,
			iconW: i.width,
			iconH: i.height,
			svgW: s.width,
			svgH: s.height,
			dx: s.left + s.width / 2 - (b.left + b.width / 2),
			dy: s.top + s.height / 2 - (b.top + b.height / 2)
		};
	}));
}

/** CBC Gem has the same button box, glyph size and centring as every other service icon in the row. */
async function expectCentredLikeNeighbours(links: Locator): Promise<void> {
	const rows = await geometry(links);
	const gem = rows.find((r) => r.label === "CBC Gem");
	expect(gem, "CBC Gem button").toBeTruthy();
	const others = rows.filter((r) => r.label !== "CBC Gem");
	expect(others.length).toBeGreaterThanOrEqual(1);
	for (const other of others) {
		expect(Math.abs(gem!.width - other.width), `${other.label} width`).toBeLessThanOrEqual(1);
		expect(Math.abs(gem!.height - other.height), `${other.label} height`).toBeLessThanOrEqual(1);
		expect(Math.abs(gem!.top - other.top), `${other.label} top`).toBeLessThanOrEqual(1);
		expect(Math.abs(gem!.iconW - other.iconW), `${other.label} icon width`).toBeLessThanOrEqual(1);
		expect(Math.abs(gem!.svgW - other.svgW), `${other.label} svg width`).toBeLessThanOrEqual(1);
		expect(Math.abs(gem!.svgH - other.svgH), `${other.label} svg height`).toBeLessThanOrEqual(1);
	}
	expect(Math.abs(gem!.dx)).toBeLessThanOrEqual(1);
	expect(Math.abs(gem!.dy)).toBeLessThanOrEqual(1);
}

/** Every service glyph in the row sits within 1px of its button's centre, at the same size. */
async function expectAllCentred(links: Locator): Promise<void> {
	const rows = await geometry(links);
	expect(rows.length).toBeGreaterThanOrEqual(2);
	for (const row of rows) {
		expect(row.width, `${row.label} width`).toBe(40);
		expect(row.svgW, `${row.label} svg width`).toBe(24);
		expect(Math.abs(row.dx), `${row.label} dx`).toBeLessThanOrEqual(1);
		expect(Math.abs(row.dy), `${row.label} dy`).toBeLessThanOrEqual(1);
	}
}

/** The rendered mark: Gem red rx 5.4 tile, white vector gem, no font-dependent <text>. */
async function expectGemMark(link: Locator): Promise<void> {
	const icon = link.locator("mat-icon");
	await expect(icon).toHaveAttribute("data-mat-icon-name", "cbc-gem");
	const mark = await icon.evaluate((el) => {
		const svg = el.querySelector("svg");
		const rect = svg?.querySelector("rect");
		return {
			viewBox: svg?.getAttribute("viewBox"),
			fill: rect?.getAttribute("fill"),
			rx: rect?.getAttribute("rx"),
			texts: svg?.querySelectorAll("text").length ?? -1,
			paths: Array.from(svg?.querySelectorAll("path") ?? []).map((p) => p.getAttribute("fill"))
		};
	});
	expect(mark.viewBox).toBe("0 0 24 24");
	expect(mark.fill).toBe(GEM_RED);
	expect(mark.rx).toBe("5.4");
	expect(mark.texts).toBe(0);
	expect(mark.paths.length).toBeGreaterThanOrEqual(1);
	expect(mark.paths.every((fill) => fill === "#fff")).toBe(true);
}

async function shoot(page: Page, links: Locator, name: string): Promise<void> {
	if (!shots) {
		return;
	}
	await page.waitForTimeout(400);
	const boxes = await links.evaluateAll((els) => els.map((a) => a.getBoundingClientRect().toJSON() as DOMRect));
	const pad = 24;
	const left = Math.min(...boxes.map((b) => b.left)), top = Math.min(...boxes.map((b) => b.top));
	const right = Math.max(...boxes.map((b) => b.right)), bottom = Math.max(...boxes.map((b) => b.bottom));
	await page.screenshot({
		path: `${shots}/${name}.png`,
		clip: { x: Math.max(0, left - pad * 2), y: Math.max(0, top - pad), width: right - left + pad * 4, height: bottom - top + pad * 2 }
	});
}

test.describe("CBC Gem service button", () => {
	// Screenshot runs only: 3x, dark scheme (as on Jon's phone) so the PR evidence is legible.
	test.use({ deviceScaleFactor: shots ? 3 : 1, colorScheme: shots ? "dark" : "light" });

	test("Review Episodes card: CBC Gem mark is centred and sized like YouTube and ABC iview", async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await fakeApi(page);
		await page.goto(`/episodes/${encodeURIComponent(JSON.stringify([`${apiEpisode.podcastId}/${EPISODE_ID}`]))}`);
		const links = page.locator(".curator-card__platforms app-episode-podcast-links a");
		await expect(links).toHaveCount(3);
		await expect(links.nth(2)).toHaveAttribute("aria-label", "CBC Gem");
		await expect(links.nth(2)).toHaveAttribute("href", GEM_URL);
		await links.first().scrollIntoViewIfNeeded();
		// Hover shows the round state layer Jon saw behind the tile.
		await links.nth(2).hover();
		await shoot(page, links, "episodes-card");
		await expectCentredLikeNeighbours(links);
		await expectGemMark(links.nth(2));
	});

	test("homepage hero: CBC Gem mark is centred and sized like YouTube and ABC iview", async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await fakeApi(page);
		await page.goto("/");
		const links = page.locator(".billboard__actions app-episode-links a");
		await expect(links).toHaveCount(3);
		await page.locator(".billboard__actions").scrollIntoViewIfNeeded();
		await shoot(page, links, "hero");
		await expectCentredLikeNeighbours(links);
		await expectGemMark(links.nth(2));
	});

	test("Outgoing Episodes card: CBC Gem mark is centred and sized like YouTube and ABC iview", async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await fakeApi(page);
		await page.goto("/outgoingEpisodes");
		const links = page.locator(".curator-card__platforms app-episode-podcast-links a");
		await expect(links).toHaveCount(3);
		await expect(links.nth(2)).toHaveAttribute("aria-label", "CBC Gem");
		await expectCentredLikeNeighbours(links);
		await expectAllCentred(links);
	});

	test("Discovery card: YouTube (with views meta), Spotify and Apple buttons are centred", async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await fakeApi(page);
		await page.goto("/discovery");
		const links = page.locator(".curator-card__platforms.discovery-service-links a[mat-icon-button]");
		await expect(links).toHaveCount(3);
		await expect(page.locator(".discovery-service-links .youtubemeta")).toBeVisible();
		await links.first().scrollIntoViewIfNeeded();
		await shoot(page, links, "discovery-card");
		await expectAllCentred(links);
	});
});
