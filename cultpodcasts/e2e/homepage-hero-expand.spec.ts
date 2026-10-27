import { expect, test, type Page } from "@playwright/test";
import { catalogueE2eOrigin as appOrigin } from "./catalogue-origin";
import { expectExpandedKeepsTop, heroExpandGeometry, stripTopPainters } from "./hero-expand-geometry";

/**
 * Homepage hero, expanded description on the real app (ng serve, faked /homepage) with classic
 * scrollbars shown (headless Chromium hides them by default):
 * - HERO-DSC-004 / 005: expanding keeps the card's top (within 1px), the art box, the hero box
 *   and the stats strip where they were; the card grows down and may cover the strip, but the
 *   art never paints over it (only the strip or the card paints the strip's top).
 * - HERO-DSC-003: the text keeps a gap from the scrollbar, long unbroken URLs wrap (nothing
 *   scrolls sideways, not the description and not the page), and the chevron never covers text.
 * Made-up shows, titles and show notes only (example.test hosts).
 * Set HERO_SCREENS_DIR to save screenshots. The harness twin is e2e/hero-layout-expand.spec.ts.
 */

test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

const LONG_URL_DESC = [
	"Invented show notes. Follow along at https://notes.example.test/invented/episode-33/show-notes-with-a-very-long-path-segment-that-never-breaks?utm_source=synthetic&utm_medium=hero&utm_campaign=synthetic_campaign_value_that_is_long",
	"Support: https://help.example.test/gb/basics/invented-topic/invented-topic-prevention-resources-and-a-very-long-path-segment-without-breaks",
	...Array.from({ length: 16 }, (_, i) =>
		`Invented paragraph ${i + 1} with more synthetic notes at https://news.example.test/invented/story-${i + 1}?ref=hero&campaign=synthetic_long_value_${i}_${"y".repeat(24)}.`)
].join(" ");

const PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAABAAAAAJCAIAAAC0SDtlAAAAE0lEQVR4nGOQkJAhCTGMahgUGgDT9SrBp83iigAAAABJRU5ErkJggg==",
	"base64"
);

/**
 * Medium show notes (HERO-DSC-005): overflow the clamp but fit the expanded cap on desktop, so
 * they show in full.
 */
const MEDIUM_URL_DESC = [
	"Invented show notes. Previous video: https://video.example.test/_SyntheticAAA?is=2UOsXSc3lQiESIHE and part two: https://video.example.test/kQSynthetic?is=iDE3kl3t4jufLS0O",
	"Support the invented host at https://tips.example.test/inventedhost or https://pay.example.test/inventedhost; the invented book: https://tips.example.test/s/23f5f8d77a",
	...Array.from({ length: 4 }, (_, i) =>
		`Invented paragraph ${i + 1} with more synthetic notes at https://news.example.test/invented/story-${i + 1}?ref=hero&campaign=synthetic_value_${i}.`)
].join(" ");

/** Two-line title and no subject chips: the wide card fills its band, ~20px under the search. */
const TALL_CARD_TITLE = "Invented Kingdom From Another World Or The Synthetic Host Examines A Made-Up Group";

async function fakeApi(page: Page, episodeDescription = LONG_URL_DESC, tallCard = false): Promise<void> {
	const now = Date.now();
	const recentEpisodes = Array.from({ length: 4 }, (_, i) => ({
		id: `00000000-0000-4000-8000-00000000001${i + 1}`,
		podcastName: `Invented Show ${String.fromCharCode(65 + i)}`,
		episodeTitle: tallCard ? `${TALL_CARD_TITLE} ${i + 1}` : `Invented episode title ${i + 1}`,
		episodeDescription,
		release: new Date(now - (i + 1) * 3_600_000).toISOString(),
		duration: "00:51:17",
		services: { youtube: { url: `https://www.youtube.com/watch?v=synthetic${i}` } },
		ids: { youtube: `synthetic${i}` },
		subjects: tallCard ? [] : ["Invented subject"],
		image: `https://img.example.test/hero-${i}.png`
	}));
	const body = JSON.stringify({ recentEpisodes, episodeCount: 87_753, totalDuration: "2639:00:00:00" });
	await page.route("**/*", async (route) => {
		const url = route.request().url();
		if (url.startsWith(appOrigin)) {
			await route.continue();
			return;
		}
		if (process.env.HERO_SCREENS_DIR && /^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(url)) {
			await route.continue();
			return;
		}
		if (url.includes("img.example.test") || route.request().resourceType() === "image") {
			await route.fulfill({ status: 200, contentType: "image/png", body: PNG });
			return;
		}
		if (new URL(url).pathname === "/homepage") {
			await route.fulfill({ status: 200, contentType: "application/json", body });
			return;
		}
		await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
	});
}

const desc = (page: Page) => page.locator(".billboard__desc");

/**
 * Home, settled: the expander and the strip are up and the art's aspect is measured. Stacked
 * layouts size the art band from it (`has-art-aspect`), and a "before" box taken ahead of the
 * image load is the full-bleed fallback, which then changes under the test.
 */
async function openHero(page: Page): Promise<void> {
	await page.goto("/");
	await expect(page.locator("button.billboard__desc-toggle")).toBeVisible();
	await expect(page.locator(".catalogue")).toBeVisible();
	await expect(page.locator(".billboard")).toHaveClass(/has-art-aspect/);
}
const toggle = (page: Page) => page.locator("button.billboard__desc-toggle");
const shots = process.env.HERO_SCREENS_DIR;

const viewports = [
	{ name: "desktop-1024", width: 1024, height: 700 },
	{ name: "desktop-1440", width: 1440, height: 900 },
	{ name: "desktop-1920", width: 1920, height: 1080 },
	{ name: "tablet-768", width: 768, height: 1024 },
	{ name: "mobile-390", width: 390, height: 844 }
];

test.describe("homepage hero: expanded description vs stats strip, scrollbar and long URLs", () => {
	for (const vp of viewports) {
		test(`${vp.name}: card top kept (may cover the strip), art never over the strip; text clears the scrollbar; URLs wrap; chevron off the text (HERO-DSC-003/005)`, async ({ page }) => {
			await page.setViewportSize({ width: vp.width, height: vp.height });
			await fakeApi(page);
			await openHero(page);
			expect(await desc(page).evaluate((d) => d.scrollWidth - d.clientWidth), "collapsed URLs overflow").toBeLessThanOrEqual(0);
			const before = await heroExpandGeometry(page);
			const beforePainters = await stripTopPainters(page);
			await page.evaluate(() => window.scrollTo(0, 0));
			await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

			await toggle(page).click();
			await toggle(page).evaluate((el) => (el as HTMLElement).blur());
			await expect(desc(page)).toHaveClass(/is-expanded/);
			const after = await heroExpandGeometry(page);
			const painters = await stripTopPainters(page);
			expectExpandedKeepsTop(before, after, beforePainters, painters, vp.name);
			expect(after.cardBottom - after.cardTop, "card did not grow").toBeGreaterThan(before.cardBottom - before.cardTop + 40);
			await page.evaluate(() => window.scrollTo(0, 0));
			if (shots) {
				await desc(page).evaluate((d) => { d.scrollTop = (d.scrollHeight - d.clientHeight) / 3; });
				await page.screenshot({ path: `${shots}/homepage-e2e-${vp.name}-expanded.png` });
			}

			for (const at of [0, 0.5, 1]) {
				await desc(page).evaluate((d, f) => { d.scrollTop = (d.scrollHeight - d.clientHeight) * f; }, at);
				const r = await desc(page).evaluate((d) => {
					const b = d.getBoundingClientRect();
					const clientTop = b.top + d.clientTop;
					const clientBottom = clientTop + d.clientHeight;
					const clientRight = b.left + d.clientLeft + d.clientWidth;
					const range = document.createRange();
					range.selectNodeContents(d);
					const lines = [...range.getClientRects()].filter((x) => x.width > 0)
						.map((x) => ({ left: x.left, right: x.right, top: Math.max(x.top, clientTop), bottom: Math.min(x.bottom, clientBottom) }))
						.filter((x) => x.bottom - x.top > 0.5);
					const t = document.querySelector(".billboard__desc-toggle")!.getBoundingClientRect();
					return {
						lines: lines.length,
						gap: clientRight - Math.max(...lines.map((x) => x.right)),
						scrollbarW: d.offsetWidth - d.clientWidth - 2 * d.clientLeft,
						xOverflow: d.scrollWidth - d.clientWidth,
						chevronHits: lines.filter((x) => x.left < t.right && x.right > t.left && x.top < t.bottom && x.bottom > t.top).length,
						toggleTop: t.top,
						descBottom: b.bottom
					};
				});
				const where = `${vp.name} scroll ${at}: ${JSON.stringify(r)}`;
				expect(r.lines, where).toBeGreaterThan(2);
				expect(r.scrollbarW, where).toBeGreaterThan(0);
				expect(r.gap, where).toBeGreaterThanOrEqual(16 - 0.5);
				expect(r.xOverflow, where).toBeLessThanOrEqual(0);
				expect(r.chevronHits, where).toBe(0);
				expect(r.toggleTop, where).toBeGreaterThanOrEqual(r.descBottom - 0.5);
			}
			const pageOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
			expect(pageOverflow, "page scrolls sideways while expanded").toBeLessThanOrEqual(0);

			await toggle(page).click();
			await expect(desc(page)).not.toHaveClass(/is-expanded/);
			const collapsed = await heroExpandGeometry(page);
			for (const k of ["cardTop", "cardBottom", "stripTop"] as const) {
				expect(Math.abs(collapsed[k] - before[k]), `${k} after collapse`).toBeLessThanOrEqual(1);
			}
			for (let i = 0; i < 4; i++) {
				expect(Math.abs(collapsed.stages[i] - before.stages[i]), `art [${i}] after collapse`).toBeLessThanOrEqual(1);
				expect(Math.abs(collapsed.hero[i] - before.hero[i]), `hero [${i}] after collapse`).toBeLessThanOrEqual(1);
			}
		});
	}
});

// HERO-DSC-005. Jon (27 Oct 2026): "when i expand the description, the box shifts downwards now" —
// a tall card (long title, no chips) with medium show notes; on e77a995 the wide card moved down
// ~32px (its growth-sized translateY overshot the in-flow growth). Checked at every layout,
// including the wide/stacked boundary (1280 is stacked, 1281 the first wide width) and 1536,
// with medium and very long notes, normal and tall cards: the top holds on every frame from the
// click, collapse restores the layout and clears the inline styles; a height-only resize while
// expanded keeps the top; a width change collapses back to the exact layout.
/** Extra widths for HERO-DSC-005, on top of `viewports`. */
const edgeViewports = [
	{ name: "desktop-1280", width: 1280, height: 800 },
	{ name: "desktop-1281", width: 1281, height: 800 },
	{ name: "desktop-1536", width: 1536, height: 864 }
];

/** Card top (page-relative) on each animation frame for `frames` frames, starting now. */
function sampleCardTop(page: Page, frames: number): Promise<number[]> {
	return page.evaluate((n) => new Promise<number[]>((resolve) => {
		const out: number[] = [];
		const card = document.querySelector<HTMLElement>(".billboard__content")!;
		const tick = () => {
			out.push(card.getBoundingClientRect().top + window.scrollY);
			if (out.length >= n) resolve(out); else requestAnimationFrame(tick);
		};
		tick();
	}), frames);
}

test.describe("homepage hero: card top kept at the layout edges, every frame and on resize (HERO-DSC-005)", () => {
	for (const vp of [...edgeViewports, ...viewports]) for (const notes of ["medium", "long"] as const) for (const tallCard of [false, true]) {
		const label = `${vp.name}, ${notes} notes${tallCard ? ", tall card" : ""}`;
		test(`${label}: top kept on every frame of the expand; collapse restores the layout and clears the inline styles`, async ({ page }) => {
			await page.setViewportSize({ width: vp.width, height: vp.height });
			await fakeApi(page, notes === "medium" ? MEDIUM_URL_DESC : LONG_URL_DESC, tallCard);
			await openHero(page);
			const before = await heroExpandGeometry(page);
			const beforePainters = await stripTopPainters(page);
			await page.evaluate(() => window.scrollTo(0, 0));
			await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
			if (shots) {
				await page.screenshot({ path: `${shots}/homepage-e2e-${vp.name}-${notes}${tallCard ? "-tall" : ""}-collapsed.png` });
			}

			// Sample from the click on: every rendered frame keeps the top.
			const frames = page.evaluate(() => new Promise<number[]>((resolve) => {
				const out: number[] = [];
				const card = document.querySelector<HTMLElement>(".billboard__content")!;
				const btn = document.querySelector<HTMLElement>("button.billboard__desc-toggle")!;
				btn.click();
				const tick = () => {
					out.push(card.getBoundingClientRect().top + window.scrollY);
					if (out.length >= 12) resolve(out); else requestAnimationFrame(tick);
				};
				requestAnimationFrame(tick);
			}));
			const tops = await frames;
			await expect(desc(page)).toHaveClass(/is-expanded/);
			for (const t of tops) {
				expect(Math.abs(t - before.cardTop), `${label}: frame tops ${JSON.stringify(tops)} vs ${before.cardTop}`).toBeLessThanOrEqual(1);
			}
			const after = await heroExpandGeometry(page);
			const painters = await stripTopPainters(page);
			expectExpandedKeepsTop(before, after, beforePainters, painters, label);
			expect(after.cardBottom - after.cardTop, `${label}: card did not grow`).toBeGreaterThan(before.cardBottom - before.cardTop + 20);
			if (shots) {
				await page.evaluate(() => window.scrollTo(0, 0));
				await page.screenshot({ path: `${shots}/homepage-e2e-${vp.name}-${notes}${tallCard ? "-tall" : ""}-expanded.png` });
			}

			await page.evaluate(() => window.scrollTo(0, 0));
			await toggle(page).click();
			await expect(desc(page)).not.toHaveClass(/is-expanded/);
			const collapsed = await heroExpandGeometry(page);
			expect(Math.abs(collapsed.cardTop - before.cardTop)).toBeLessThanOrEqual(1);
			expect(Math.abs(collapsed.cardBottom - before.cardBottom)).toBeLessThanOrEqual(1);
			expect(Math.abs(collapsed.stripTop - before.stripTop)).toBeLessThanOrEqual(1);
			for (let i = 0; i < 4; i++) {
				expect(Math.abs(collapsed.stages[i] - before.stages[i]), `art [${i}] after collapse`).toBeLessThanOrEqual(1);
				expect(Math.abs(collapsed.hero[i] - before.hero[i]), `hero [${i}] after collapse`).toBeLessThanOrEqual(1);
			}
			const inline = await page.evaluate(() => ({
				heroAlign: document.querySelector<HTMLElement>(".billboard")!.style.alignItems,
				heroH: document.querySelector<HTMLElement>(".billboard")!.style.height,
				cardMargin: document.querySelector<HTMLElement>(".billboard__content")!.style.marginTop,
				descH: document.querySelector<HTMLElement>(".billboard__desc")!.style.height,
				scrollTop: document.querySelector<HTMLElement>(".billboard__desc")!.scrollTop
			}));
			expect(inline).toEqual({ heroAlign: "", heroH: "", cardMargin: "", descH: "", scrollTop: 0 });
		});
	}

	for (const vp of [edgeViewports[1], edgeViewports[2], viewports[1], viewports[2]]) {
		test(`${vp.name}, tall card: a height-only resize while expanded keeps the card top and the strip unpainted by the art; a width change collapses to the exact layout`, async ({ page }) => {
			await page.setViewportSize({ width: vp.width, height: vp.height });
			await fakeApi(page, MEDIUM_URL_DESC, true);
			await openHero(page);
			await page.evaluate(() => window.scrollTo(0, 0));
			const before = await heroExpandGeometry(page);
			await toggle(page).click();
			await expect(desc(page)).toHaveClass(/is-expanded/);

			for (const h of [vp.height - 120, vp.height + 80]) {
				await page.setViewportSize({ width: vp.width, height: h });
				await sampleCardTop(page, 4);
				await expect(desc(page)).toHaveClass(/is-expanded/);
				const resized = await heroExpandGeometry(page);
				expect(Math.abs(resized.cardTop - before.cardTop), `height ${h}: card top moved`).toBeLessThanOrEqual(1);
				// The hero may follow its viewport-relative min-height (as it would collapsed); it never shrinks under the card's collapsed foot.
				expect(resized.hero[1] + resized.hero[3], `height ${h}: hero shrank`).toBeGreaterThanOrEqual(before.hero[1] + before.hero[3] - 1);
				const art = await stripTopPainters(page);
				expect(art.filter((p) => p !== "strip" && p !== "card"), `height ${h}: art over the strip`).toEqual([]);
			}

			await page.setViewportSize({ width: vp.width, height: vp.height });
			await sampleCardTop(page, 4);
			await page.setViewportSize({ width: vp.width - 40, height: vp.height });
			await expect(desc(page)).not.toHaveClass(/is-expanded/);
			const inline = await page.evaluate(() => ({
				heroAlign: document.querySelector<HTMLElement>(".billboard")!.style.alignItems,
				cardMargin: document.querySelector<HTMLElement>(".billboard__content")!.style.marginTop
			}));
			expect(inline).toEqual({ heroAlign: "", cardMargin: "" });
			await page.setViewportSize({ width: vp.width, height: vp.height });
			await sampleCardTop(page, 4);
			await page.evaluate(() => window.scrollTo(0, 0));
			const restored = await heroExpandGeometry(page);
			expect(Math.abs(restored.cardTop - before.cardTop), "card top after width change and back").toBeLessThanOrEqual(1);
			expect(Math.abs(restored.cardBottom - before.cardBottom), "card bottom after width change and back").toBeLessThanOrEqual(1);
		});
	}
});
