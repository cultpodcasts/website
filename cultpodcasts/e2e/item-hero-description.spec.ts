import { expect, test, type Page, type Route } from "@playwright/test";
import { GuidService } from "../src/app/guid.service";
import { catalogueE2eOrigin as appOrigin } from "./catalogue-origin";

/**
 * Item page hero description (#703): the homepage hero's clamp and expander on the podcast episode,
 * film, TV episode and news report pages (app-playable-detail-shell → app-hero-description).
 * Real app (ng serve), faked `POST /search`. Mirrors e2e/homepage-hero-desc.spec.ts:
 * - D1 hits (`@search.engine: "d1"`, full descriptions): clamped to 5 lines wide, 4 at <=1280px,
 *   3 at <=700px; the round chevron sits inline on the last visible line (HERO-DSC-001);
 *   expanded shows the full text, scrolls inside past 60vh, keeps the same wrap (HERO-DSC-006) and
 *   moves the chevron into its own band under the text (HERO-DSC-003); collapse restores the clamp.
 * - No expander when the text fits; Azure hits stay unclamped with no expander (#702).
 * - No character cap on D1 text (like the homepage): a 50k-character description is all there.
 * Made-up shows, titles and descriptions only. Set HERO_SCREENS_DIR to save screenshots.
 */

const guids = new GuidService();
const shots = process.env.HERO_SCREENS_DIR;

/** ~2,700 characters with links: overflows every clamp and the 60vh expanded cap. */
const VERY_LONG_DESC = Array.from({ length: 18 }, (_, i) =>
	`Invented paragraph ${i + 1}: a made-up correspondent explains an imaginary story in detail, ` +
	`with more background at https://news.example.test/invented/story-${i + 1}?ref=item and a follow-up.`
).join(" ");
/** Overflows the clamp on every layout but fits the expanded cap, so it shows in full. */
const MEDIUM_DESC = Array.from({ length: 6 }, (_, i) =>
	`Synthetic item sentence ${i + 1} describes an invented episode at some considerable length.`
).join(" ");
const SHORT_DESC = "Short synthetic description.";
/** 50k+ characters (production D1 max is ~51k): never cut by characters (#703), all of it scrolls inside. */
const HUGE_DESC = Array.from({ length: 560 }, (_, i) =>
	`Invented paragraph ${i + 1}: synthetic notes at https://news.example.test/invented/story-${i + 1}?ref=item and more.`
).join(" ");

const kinds = [
	{ name: "podcast episode", kind: "Episode", id: "cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd", title: "Pilot", parent: "Show",
		path: (id: string) => `/podcast/${encodeURIComponent("Show")}/${guids.toBase64(id)}` },
	{ name: "film", kind: "Film", id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", title: "One Off", parent: "One Off",
		path: (id: string) => `/film/${encodeURIComponent("One Off")}/${guids.toCatalogueShortId(id, "Film")}` },
	{ name: "TV episode", kind: "TvShowEpisode", id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", title: "Part", parent: "Nightly",
		path: (id: string) => `/tv/${encodeURIComponent("Nightly")}/${guids.toCatalogueShortId(id, "TvShowEpisode")}` },
	{ name: "news report", kind: "NewsReport", id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", title: "Bulletin", parent: "Desk",
		path: (id: string) => `/news/${encodeURIComponent("Desk")}/${guids.toCatalogueShortId(id, "NewsReport")}` },
] as const;
type Kind = (typeof kinds)[number];

const layouts = [
	{ name: "wide", width: 1440, height: 900, lines: 5 },
	{ name: "medium", width: 900, height: 1000, lines: 4 },
	{ name: "mobile", width: 390, height: 844, lines: 3 },
] as const;

/** Chevron band under the expanded description (HERO-DSC-003), as on the homepage. */
const TOGGLE_BAND = 40;

enum Engine {
	Azure = "azure",
	D1 = "d1",
}

const json = (route: Route, body: unknown) =>
	route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

async function fakeSearch(page: Page, item: Kind, description: string, engine: Engine): Promise<void> {
	const doc = {
		id: item.id,
		title: item.title,
		seriesName: item.parent,
		description,
		contentKind: item.kind,
		release: "2026-01-02T00:00:00.000Z",
		duration: "00:51:17",
		subjects: ["Invented subject"],
	};
	await page.route("**/*", async (route) => {
		const url = route.request().url();
		if (url.startsWith(appOrigin) || (shots && /fonts\.(googleapis|gstatic)\.com/.test(url))) {
			await route.continue();
			return;
		}
		if (route.request().method() === "POST" && url.includes("/search")) {
			const filter = String(route.request().postDataJSON()?.filter ?? "");
			// Related rails ask with `id ne`; only the item's own lookup gets the hit.
			const own = filter.includes(item.id) && !filter.includes(" ne ");
			await json(route, { value: own ? [doc] : [], "@search.engine": engine });
			return;
		}
		await json(route, {});
	});
}

const desc = (page: Page) => page.locator("app-hero-description .hero-desc__text");
const toggle = (page: Page) => page.locator("app-hero-description button.hero-desc__toggle");

async function openItem(page: Page, item: Kind, description: string, engine = Engine.D1): Promise<void> {
	await fakeSearch(page, item, description, engine);
	await page.goto(item.path(item.id));
	await expect(page.locator("h1.episode-hero__title")).toHaveText(item.title);
	await expect(desc(page)).toBeVisible();
}

async function lineCount(page: Page): Promise<number> {
	return desc(page).evaluate((el) => Math.round(el.clientHeight / parseFloat(getComputedStyle(el).lineHeight)));
}

/** Toggle vs the description box: centre against the last visible line, right edge against the text column. */
async function inlineToggle(page: Page): Promise<{ centreOffset: number; rightOffset: number }> {
	return page.evaluate(() => {
		const d = document.querySelector<HTMLElement>("app-hero-description .hero-desc__text")!;
		const r = d.getBoundingClientRect();
		const t = document.querySelector("app-hero-description .hero-desc__toggle")!.getBoundingClientRect();
		const line = parseFloat(getComputedStyle(d).lineHeight);
		return { centreOffset: (t.top + t.bottom) / 2 - (r.bottom - line / 2), rightOffset: t.right - r.right };
	});
}

type Box = { top: number; bottom: number; width: number; clientHeight: number; scrollHeight: number; lineH: number; vh: number; toggleTop: number; toggleBottom: number };
async function box(page: Page): Promise<Box> {
	return page.evaluate(() => {
		const d = document.querySelector<HTMLElement>("app-hero-description .hero-desc__text")!;
		const r = d.getBoundingClientRect();
		const t = document.querySelector("app-hero-description .hero-desc__toggle")?.getBoundingClientRect();
		return {
			top: r.top, bottom: r.bottom, width: d.clientWidth, clientHeight: d.clientHeight, scrollHeight: d.scrollHeight,
			lineH: parseFloat(getComputedStyle(d).lineHeight), vh: window.innerHeight,
			toggleTop: t?.top ?? NaN, toggleBottom: t?.bottom ?? NaN,
		};
	});
}

test.describe("item page hero description (#703)", () => {
	for (const item of kinds) {
		for (const layout of layouts) {
			test(`${item.name} @ ${layout.name}: clamps to ${layout.lines} lines; inline chevron; expands to the full text (scrolls inside past 60vh); collapses back`, async ({ page }) => {
				await page.setViewportSize({ width: layout.width, height: layout.height });
				await openItem(page, item, VERY_LONG_DESC);
				expect(VERY_LONG_DESC.length).toBeGreaterThan(2_500);
				await expect(desc(page)).toHaveClass(/is-clamped/);
				await expect(desc(page)).toHaveText(VERY_LONG_DESC);
				await expect(toggle(page)).toBeVisible();
				await expect(toggle(page)).toHaveAttribute("aria-label", "Expand description");
				await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
				await expect(toggle(page).locator("mat-icon")).toHaveText("expand_more");
				expect(await toggle(page).getAttribute("aria-controls")).toBe(await desc(page).getAttribute("id"));
				expect(await lineCount(page)).toBe(layout.lines);
				expect(await desc(page).evaluate((d) => d.scrollWidth - d.clientWidth), "long URLs overflow sideways").toBeLessThanOrEqual(0);
				// HERO-DSC-001: inline on the last visible line, at the end of the text column.
				const inline = await inlineToggle(page);
				expect(Math.abs(inline.centreOffset), "toggle not centred on the last line").toBeLessThanOrEqual(3);
				expect(Math.abs(inline.rightOffset), "toggle not at the end of the text column").toBeLessThanOrEqual(1);
				await expect(page.locator("app-hero-description .hero-desc__fade")).toHaveCount(1);
				if (shots) {
					await page.screenshot({ path: `${shots}/item-${item.kind}-${layout.name}-collapsed.png` });
				}
				const collapsed = await box(page);

				await toggle(page).click();
				await expect(toggle(page)).toHaveAttribute("aria-label", "Collapse description");
				await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
				await expect(toggle(page).locator("mat-icon")).toHaveText("expand_less");
				await expect(desc(page)).toHaveClass(/is-expanded/);
				await expect(page.locator("app-hero-description .hero-desc__fade")).toHaveCount(0);
				const expanded = await box(page);
				expect(Math.abs(expanded.top - collapsed.top), "description top moved").toBeLessThanOrEqual(1);
				expect(expanded.clientHeight, "expanded did not grow").toBeGreaterThan(collapsed.clientHeight + expanded.lineH);
				expect(expanded.clientHeight, "expanded past the 60vh cap").toBeLessThanOrEqual(expanded.vh * 0.6 + 1);
				expect(expanded.scrollHeight, "very long text should scroll inside").toBeGreaterThan(expanded.clientHeight);
				// HERO-DSC-006: same column, so expanding never re-wraps.
				expect(Math.abs(expanded.width - collapsed.width), "text column width changed").toBeLessThanOrEqual(1);
				// HERO-DSC-003: chevron in its own band under the text, never over a line.
				expect(expanded.toggleTop, "chevron covers the text").toBeGreaterThanOrEqual(expanded.bottom - 1);
				expect(expanded.toggleBottom, "chevron outside its band").toBeLessThanOrEqual(expanded.bottom + TOGGLE_BAND + 1);
				await desc(page).evaluate((d) => d.scrollTo(0, d.scrollHeight));
				if (shots) {
					await page.screenshot({ path: `${shots}/item-${item.kind}-${layout.name}-expanded.png` });
				}

				// Collapse from the scrolled end: the clamp and the first line come back.
				await toggle(page).click();
				await expect(desc(page)).not.toHaveClass(/is-expanded/);
				await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
				await expect(toggle(page)).toHaveAttribute("aria-label", "Expand description");
				expect(await desc(page).evaluate((d) => d.scrollTop)).toBe(0);
				expect(await lineCount(page)).toBe(layout.lines);
				const again = await box(page);
				expect(Math.abs(again.clientHeight - collapsed.clientHeight), "collapsed height drifted").toBeLessThanOrEqual(1);
			});
		}

		test(`${item.name}: a 50k-character D1 description is all there when expanded (no character cap) and scrolls inside to its last word`, async ({ page }) => {
			await page.setViewportSize({ width: 1440, height: 900 });
			expect(HUGE_DESC.length).toBeGreaterThan(50_000);
			await openItem(page, item, HUGE_DESC);
			await expect(desc(page)).toHaveText(HUGE_DESC);
			await toggle(page).click();
			await expect(desc(page)).toHaveClass(/is-expanded/);
			const expanded = await box(page);
			expect(expanded.clientHeight, "expanded past the 60vh cap").toBeLessThanOrEqual(expanded.vh * 0.6 + 1);
			expect(expanded.scrollHeight, "50k text should scroll inside").toBeGreaterThan(expanded.clientHeight * 10);
			// Scroll to the end: the last sentence is reachable inside the box, the page did not grow by 50k of text.
			const end = await desc(page).evaluate((d) => {
				d.scrollTo(0, d.scrollHeight);
				const r = d.getBoundingClientRect();
				const range = document.createRange();
				const node = d.firstChild!;
				range.setStart(node, node.textContent!.length - 1);
				range.setEnd(node, node.textContent!.length);
				const last = range.getBoundingClientRect();
				return { atEnd: Math.abs(d.scrollTop + d.clientHeight - d.scrollHeight) <= 1, lastInside: last.bottom <= r.bottom + 1 && last.top >= r.top - 1, pageH: document.documentElement.scrollHeight };
			});
			expect(end.atEnd, "scroller did not reach the end").toBe(true);
			expect(end.lastInside, "last character not visible at the end of the scroller").toBe(true);
			expect(end.pageH, "the page grew with the text instead of scrolling inside").toBeLessThan(expanded.scrollHeight);
		});

		test(`${item.name}: medium text expands in full (no inner scroll)`, async ({ page }) => {
			await page.setViewportSize({ width: 1440, height: 900 });
			await openItem(page, item, MEDIUM_DESC);
			await expect(toggle(page)).toBeVisible();
			await toggle(page).click();
			await expect(desc(page)).toHaveClass(/is-expanded/);
			const expanded = await box(page);
			expect(expanded.scrollHeight - expanded.clientHeight, "medium text should show in full").toBeLessThanOrEqual(1);
		});

		test(`${item.name}: no expander when the description fits the clamp`, async ({ page }) => {
			await page.setViewportSize({ width: 1440, height: 900 });
			await openItem(page, item, SHORT_DESC);
			await expect(desc(page)).toHaveText(SHORT_DESC);
			await expect(desc(page)).toHaveClass(/is-clamped/);
			await expect(toggle(page)).toHaveCount(0);
			await expect(page.locator("app-hero-description .hero-desc__fade")).toHaveCount(0);
		});

		test(`${item.name}: an Azure hit stays unclamped with no expander (#702)`, async ({ page }) => {
			await page.setViewportSize({ width: 1440, height: 900 });
			await openItem(page, item, VERY_LONG_DESC, Engine.Azure);
			await expect(desc(page)).not.toHaveClass(/is-clamped/);
			await expect(toggle(page)).toHaveCount(0);
			const text = (await desc(page).textContent()) ?? "";
			expect(text.length, "Azure keeps the 180-character card cap").toBeLessThanOrEqual(180);
			expect(text.endsWith("\u2026")).toBe(true);
		});
	}
});