import { expect, test, type Page } from "@playwright/test";
import { catalogueE2eOrigin as appOrigin } from "./catalogue-origin";

/**
 * Homepage hero, expanded description on the real app (ng serve, faked /homepage) with classic
 * scrollbars shown (headless Chromium hides them by default):
 * - HERO-DSC-004: expanding leaves the art box, the hero box and the stats strip where they
 *   were, and the art never paints over the strip's top (only the raised card may sit over it).
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

async function fakeApi(page: Page): Promise<void> {
	const now = Date.now();
	const recentEpisodes = Array.from({ length: 4 }, (_, i) => ({
		id: `00000000-0000-4000-8000-00000000001${i + 1}`,
		podcastName: `Invented Show ${String.fromCharCode(65 + i)}`,
		episodeTitle: `Invented episode title ${i + 1}`,
		episodeDescription: LONG_URL_DESC,
		release: new Date(now - (i + 1) * 3_600_000).toISOString(),
		duration: "00:51:17",
		services: { youtube: { url: `https://www.youtube.com/watch?v=synthetic${i}` } },
		ids: { youtube: `synthetic${i}` },
		subjects: ["Invented subject"],
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

type Boxes = { stages: number[]; hero: number[]; stripTop: number };
/** Page-relative (scroll-independent) boxes: [left, top, width, height]. */
const boxes = (page: Page): Promise<Boxes> => page.evaluate(() => {
	const b = (sel: string) => {
		const r = document.querySelector(sel)!.getBoundingClientRect();
		return [r.left + window.scrollX, r.top + window.scrollY, r.width, r.height];
	};
	return { stages: b(".billboard__stages"), hero: b(".billboard"), stripTop: b(".catalogue")[1] };
});

/** Who paints the strip's top band (the 28px it overlaps the hero) across the width. */
const stripTopPainters = (page: Page): Promise<string[]> => page.evaluate(() => {
	const strip = document.querySelector<HTMLElement>(".catalogue")!;
	window.scrollTo(0, Math.max(0, strip.getBoundingClientRect().top + window.scrollY - window.innerHeight / 2));
	const top = strip.getBoundingClientRect().top;
	const w = document.documentElement.clientWidth;
	const out: string[] = [];
	for (const dy of [2, 10, 20]) {
		for (let x = 4; x < w - 4; x += Math.max(8, Math.floor(w / 40))) {
			const el = document.elementFromPoint(x, top + dy);
			out.push(el?.closest(".billboard__content") ? "card" : el?.closest(".catalogue") ? "strip"
				: el ? `${el.tagName.toLowerCase()}.${[...el.classList].join(".")}` : "none");
		}
	}
	return out;
});

const desc = (page: Page) => page.locator(".billboard__desc");
const toggle = (page: Page) => page.locator("button.billboard__desc-toggle");
const shots = process.env.HERO_SCREENS_DIR;

test.describe("homepage hero: expanded description vs stats strip, scrollbar and long URLs", () => {
	for (const vp of [
		{ name: "desktop-1024", width: 1024, height: 700 },
		{ name: "desktop-1440", width: 1440, height: 900 },
		{ name: "tablet-768", width: 768, height: 1024 },
		{ name: "mobile-390", width: 390, height: 844 }
	]) {
		test(`${vp.name}: art and strip stay put and unpainted; text clears the scrollbar; URLs wrap; chevron off the text (HERO-DSC-003/004)`, async ({ page }) => {
			await page.setViewportSize({ width: vp.width, height: vp.height });
			await fakeApi(page);
			await page.goto("/");
			await expect(toggle(page)).toBeVisible();
			await expect(page.locator(".catalogue")).toBeVisible();
			expect(await desc(page).evaluate((d) => d.scrollWidth - d.clientWidth), "collapsed URLs overflow").toBeLessThanOrEqual(0);
			const before = await boxes(page);
			const beforePainters = await stripTopPainters(page);
			expect(beforePainters.filter((p) => p !== "strip" && p !== "card"), "collapsed strip top").toEqual([]);
			await page.evaluate(() => window.scrollTo(0, 0));
			await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

			await toggle(page).click();
			await toggle(page).evaluate((el) => (el as HTMLElement).blur());
			await expect(desc(page)).toHaveClass(/is-expanded/);
			const after = await boxes(page);
			for (let i = 0; i < 4; i++) {
				expect(Math.abs(after.stages[i] - before.stages[i]), `art box [${i}] changed`).toBeLessThanOrEqual(1);
				expect(Math.abs(after.hero[i] - before.hero[i]), `hero box [${i}] changed`).toBeLessThanOrEqual(1);
			}
			expect(Math.abs(after.stripTop - before.stripTop), "stats strip moved").toBeLessThanOrEqual(1);
			const painters = await stripTopPainters(page);
			expect(painters.filter((p) => p !== "strip" && p !== "card"), "art paints over the stats strip").toEqual([]);
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
			const collapsed = await boxes(page);
			expect(Math.abs(collapsed.stripTop - before.stripTop)).toBeLessThanOrEqual(1);
			expect(Math.abs(collapsed.stages[3] - before.stages[3])).toBeLessThanOrEqual(1);
		});
	}
});
