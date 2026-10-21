import { expect, test, type Page } from "@playwright/test";

/**
 * Homepage hero description: per-layout clamp, the icon expander, and
 * rotation paused while expanded. Real app (ng serve), faked /homepage.
 * Made-up shows, titles and descriptions only.
 *
 * Set HERO_SCREENS_DIR to save collapsed / expanded / expanded-scrolled screenshots.
 */

const LONG_DESC = Array.from({ length: 14 }, (_, i) =>
	`Synthetic hero sentence ${i + 1} describes an invented episode at some length.`
).join(" ");
/** Very long synthetic description with links (2,500+ chars), like a news show's notes. */
const VERY_LONG_DESC = Array.from({ length: 18 }, (_, i) =>
	`Invented paragraph ${i + 1}: a made-up correspondent explains an imaginary story in detail, ` +
	`with more background at https://news.example.test/invented/story-${i + 1}?ref=hero and a follow-up.`
).join(" ");
const SHORT_DESC = "Short synthetic description.";

// 1x1 dark PNG so the backdrop gate opens.
const PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
	"base64"
);

type Services = Record<string, { url: string }> | null;
function homepage(description: string, title?: string, subjects = ["Invented subject"], services?: Services) {
	const now = Date.now();
	const recentEpisodes = Array.from({ length: 4 }, (_, i) => ({
		id: `00000000-0000-4000-8000-00000000000${i + 1}`,
		podcastName: `Invented Show ${String.fromCharCode(65 + i)}`,
		episodeTitle: title ?? `Invented episode title ${i + 1}`,
		episodeDescription: description,
		release: new Date(now - (i + 1) * 3_600_000).toISOString(),
		duration: "01:02:03",
		...(services === undefined
			? { services: { youtube: { url: `https://www.youtube.com/watch?v=synthetic${i}` } }, ids: { youtube: `synthetic${i}` } }
			: services === null ? {} : { services }),
		subjects,
		image: `https://img.example.test/hero-${i}.png`
	}));
	return { recentEpisodes, episodeCount: recentEpisodes.length, totalDuration: "4:00:00" };
}

async function fakeApi(page: Page, description: string, title?: string, subjects?: string[], services?: Services): Promise<void> {
	await page.route("**/*", async (route) => {
		const url = route.request().url();
		if (url.startsWith("http://127.0.0.1:4173")) {
			await route.continue();
			return;
		}
		// Screenshots only: load the real web/icon fonts so the shots match production.
		// Test runs stay offline (icons then render as their ligature names).
		if (process.env.HERO_SCREENS_DIR && /^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(url)) {
			await route.continue();
			return;
		}
		if (url.includes("img.example.test")) {
			await route.fulfill({ status: 200, contentType: "image/png", body: PNG });
			return;
		}
		if (new URL(url).pathname === "/homepage") {
			await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(homepage(description, title, subjects, services)) });
			return;
		}
		await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
	});
}

const layouts = [
	{ name: "wide", width: 1440, height: 900, lines: 5 },
	{ name: "medium", width: 900, height: 1000, lines: 4 },
	{ name: "mobile", width: 390, height: 844, lines: 3 }
] as const;

const desc = (page: Page) => page.locator(".billboard__desc");
const toggle = (page: Page) => page.locator("button.billboard__desc-toggle");
const shots = process.env.HERO_SCREENS_DIR;

async function lineCount(page: Page): Promise<number> {
	return desc(page).evaluate((el) => {
		const style = getComputedStyle(el);
		return Math.round(el.clientHeight / parseFloat(style.lineHeight));
	});
}

async function overlapsActions(page: Page): Promise<boolean> {
	return page.evaluate(() => {
		const a = document.querySelector(".billboard__desc")!.getBoundingClientRect();
		const t = document.querySelector(".billboard__desc-toggle")!.getBoundingClientRect();
		const b = document.querySelector(".billboard__actions")!.getBoundingClientRect();
		const hit = (r: DOMRect) => r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top;
		return hit(a) || hit(t);
	});
}

/** Toggle vs the description box: centre against the last visible line, right edge against the text column. */
async function inlineToggle(page: Page): Promise<{ centreOffset: number; rightOffset: number }> {
	return page.evaluate(() => {
		const d = document.querySelector<HTMLElement>(".billboard__desc")!;
		const r = d.getBoundingClientRect();
		const t = document.querySelector(".billboard__desc-toggle")!.getBoundingClientRect();
		const line = parseFloat(getComputedStyle(d).lineHeight);
		return {
			centreOffset: (t.top + t.bottom) / 2 - (r.bottom - line / 2),
			rightOffset: t.right - r.right
		};
	});
}

type Geo = {
	heroH: number; band: number; cardTop: number; cardBottom: number; anchor: number; clearance: number;
	vh: number; scrollY: number;
};
/** Hero/card geometry; card offsets are relative to the hero top. */
const geometry = (page: Page): Promise<Geo> => page.evaluate(() => {
	const hero = document.querySelector<HTMLElement>(".billboard")!;
	const card = document.querySelector<HTMLElement>(".billboard__content")!;
	const cs = getComputedStyle(hero);
	const h = hero.getBoundingClientRect();
	const c = card.getBoundingClientRect();
	return {
		heroH: h.height,
		band: parseFloat(cs.minHeight),
		cardTop: c.top - h.top,
		cardBottom: c.bottom - h.top,
		// Card bottom when anchored: hero bottom - bottom padding + docked overhang (negative margin).
		anchor: h.height - parseFloat(cs.paddingBottom) - parseFloat(getComputedStyle(card).marginBottom),
		clearance: parseFloat(cs.paddingTop),
		vh: window.innerHeight,
		scrollY: window.scrollY
	};
});

/** The chevron is in the viewport and nothing covers its centre. */
async function expectToggleVisible(page: Page, when: string): Promise<void> {
	const r = await toggle(page).evaluate((button) => {
		const b = button.getBoundingClientRect();
		const hit = document.elementFromPoint((b.left + b.right) / 2, (b.top + b.bottom) / 2);
		return { top: b.top, bottom: b.bottom, vh: window.innerHeight, onTop: !!hit && button.contains(hit) };
	});
	expect(r.top, `${when}: chevron above the viewport`).toBeGreaterThanOrEqual(0);
	expect(r.bottom, `${when}: chevron below the viewport`).toBeLessThanOrEqual(r.vh);
	expect(r.onTop, `${when}: chevron covered`).toBe(true);
}

/**
 * HERO-DSC-002, expanded: the hero keeps its height and the page does not move; the card
 * fills down to the viewport foot (within 16px), overlaying whatever follows the hero
 * (stats strip, rails) without being covered by it; its top stays put (lifted only if the
 * collapsed card ended below the foot) and below the search field; the description scrolls
 * inside; title + Watch/More info stay in view; the chevron is visible at both scroll ends.
 */
async function expectExpandedFills(page: Page, collapsed: Geo, shot?: string): Promise<void> {
	const g = await geometry(page);
	expect(Math.abs(g.heroH - collapsed.heroH), "expanding changed the hero height").toBeLessThanOrEqual(1);
	expect(g.scrollY, "expanding scrolled the page").toBe(collapsed.scrollY);
	const box = await page.evaluate(() => {
		const d = document.querySelector<HTMLElement>(".billboard__desc")!;
		const card = document.querySelector<HTMLElement>(".billboard__content")!;
		const c = card.getBoundingClientRect();
		const h = document.querySelector(".billboard")!.getBoundingClientRect();
		const t = document.querySelector(".billboard__title")!.getBoundingClientRect();
		const a = document.querySelector(".billboard__actions")!.getBoundingClientRect();
		// The app's search field (dropped into the hero, or in the sticky chrome row).
		const search = document.querySelector(".chrome-search")?.getBoundingClientRect();
		const chromeBar = parseFloat(getComputedStyle(document.querySelector(".billboard")!).getPropertyValue("--site-chrome-bar-h")) || 52;
		const stats = document.querySelector(".catalogue")?.getBoundingClientRect();
		// What paints at the card's lower area: the card itself, not the stats strip below the hero.
		const probeY = c.bottom - 6;
		const probe = document.elementFromPoint(c.left + 12, probeY);
		// And over the stats strip where the card overlays it (if it does here).
		const overTop = stats ? Math.max(stats.top, h.bottom) : Infinity;
		const overY = overTop + 2 < c.bottom - 2 ? overTop + 2 : null;
		const over = overY === null ? null : document.elementFromPoint(c.left + 12, overY);
		return {
			cardTop: c.top, cardBottom: c.bottom, heroBottom: h.bottom, searchBottom: search?.bottom ?? 0,
			// The card's top limit: below the search field and 12px clear of the sticky chrome row.
			topLimit: Math.max(search?.bottom ?? 0, chromeBar + 12),
			titleTop: t.top, actionsBottom: a.bottom,
			lowerIsCard: !!probe && card.contains(probe),
			overStats: overY === null ? null : !!over && card.contains(over),
			scrollable: d.scrollHeight - d.clientHeight, overflowY: getComputedStyle(d).overflowY
		};
	});
	expect(box.cardBottom, "card runs past the viewport foot").toBeLessThanOrEqual(g.vh + 1);
	expect(box.cardBottom, "card does not fill down to the viewport foot").toBeGreaterThanOrEqual(g.vh - 16);
	expect(box.lowerIsCard, "card's lower area is covered").toBe(true);
	if (box.overStats !== null) {
		expect(box.overStats, "stats strip paints over the expanded card").toBe(true);
	}
	// The top stays where it was collapsed (unless lifted to fit, or held below the search).
	const heroTop = box.heroBottom - g.heroH;
	const lift = Math.max(0, heroTop + collapsed.cardBottom - (g.vh - 12));
	const keptTop = heroTop + collapsed.cardTop - lift;
	if (keptTop >= box.topLimit) {
		expect(Math.abs(box.cardTop - keptTop), "card top moved").toBeLessThanOrEqual(2);
	} else {
		// Would sit under the search / sticky chrome: held just below it instead.
		expect(box.cardTop, "card top above its limit").toBeGreaterThanOrEqual(box.topLimit - 1);
		expect(box.cardTop - box.topLimit, "card top not held at its limit").toBeLessThanOrEqual(24);
	}
	expect(box.titleTop, "title pushed out of view").toBeGreaterThanOrEqual(0);
	expect(box.cardTop, "expanded card covers the search field").toBeGreaterThanOrEqual(box.searchBottom - 1);
	expect(box.actionsBottom, "Watch / More info pushed below the viewport").toBeLessThanOrEqual(g.vh + 1);
	expect(box.overflowY).toBe("auto");
	expect(box.scrollable, "long description should scroll inside the card").toBeGreaterThan(20);
	expect(await overlapsActions(page)).toBe(false);
	await expectToggleVisible(page, "description at the top");
	if (shots && shot) {
		await page.screenshot({ path: `${shots}/${shot}-expanded.png` });
	}
	await desc(page).evaluate((el) => { el.scrollTop = el.scrollHeight; });
	expect(await desc(page).evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
	await expectToggleVisible(page, "description scrolled to the end");
	if (shots && shot) {
		await page.screenshot({ path: `${shots}/${shot}-expanded-scrolled.png` });
	}
}

/** Collapsed again: first line at the top of the clamp and the exact collapsed layout. */
async function expectCollapsedAgain(page: Page, collapsed: Geo): Promise<void> {
	await expect(desc(page)).not.toHaveClass(/is-expanded/);
	const first = await desc(page).evaluate((el) => {
		const range = document.createRange();
		range.setStart(el.firstChild!, 0);
		range.setEnd(el.firstChild!, 1);
		const r = range.getBoundingClientRect();
		return { scrollTop: el.scrollTop, offset: r.top - el.getBoundingClientRect().top, line: parseFloat(getComputedStyle(el).lineHeight) };
	});
	expect(first.scrollTop).toBe(0);
	expect(first.offset, "first line not at the top of the clamp").toBeGreaterThanOrEqual(-1);
	expect(first.offset).toBeLessThanOrEqual(first.line);
	const g = await geometry(page);
	expect(Math.abs(g.heroH - collapsed.heroH)).toBeLessThanOrEqual(1);
	expect(Math.abs(g.cardTop - collapsed.cardTop)).toBeLessThanOrEqual(1);
	expect(Math.abs(g.cardBottom - collapsed.cardBottom)).toBeLessThanOrEqual(1);
}

test.describe("homepage hero description", () => {
	for (const layout of layouts) {
		test(`${layout.name}: clamps to ${layout.lines} lines; expanded keeps the hero, fills the card to the viewport foot and scrolls inside`, async ({ page }) => {
			await page.setViewportSize({ width: layout.width, height: layout.height });
			await fakeApi(page, VERY_LONG_DESC);
			await page.goto("/");
			await expect(desc(page)).toBeVisible();
			expect(VERY_LONG_DESC.length).toBeGreaterThan(2_500);
			await expect(toggle(page)).toHaveAttribute("aria-label", "Expand description");
			await expect(toggle(page).locator("mat-icon")).toHaveText("expand_more");
			expect(await lineCount(page)).toBe(layout.lines);
			await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
			expect(await toggle(page).getAttribute("aria-controls")).toBe(await desc(page).getAttribute("id"));
			expect(await overlapsActions(page)).toBe(false);
			// HERO-DSC-001: inline on the last visible line, right edge of the text column (no extra row).
			const inline = await inlineToggle(page);
			expect(Math.abs(inline.centreOffset), "toggle not centred on the last line").toBeLessThanOrEqual(3);
			expect(Math.abs(inline.rightOffset), "toggle not at the end of the text column").toBeLessThanOrEqual(1);
			if (shots) {
				await page.screenshot({ path: `${shots}/hero-${layout.name}-collapsed.png` });
			}
			const collapsed = await geometry(page);

			await toggle(page).click();
			// Drop keyboard focus so only the expanded state can be holding the slide
			// (focus inside the hero pauses it too). HERO-CTL-003: copy is not a hover target.
			await toggle(page).evaluate((el) => (el as HTMLElement).blur());
			await expect(toggle(page)).toHaveAttribute("aria-label", "Collapse description");
			await expect(toggle(page).locator("mat-icon")).toHaveText("expand_less");
			await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
			await expect(desc(page)).toHaveClass(/is-expanded/);
			await expectExpandedFills(page, collapsed, `hero-${layout.name}`);

			// Rotation is held while expanded.
			await expect(page.locator(".billboard")).toHaveClass(/is-paused/);
			const title = await page.locator(".billboard__title").textContent();
			await page.waitForTimeout(9_000);
			await expect(page.locator(".billboard__title")).toHaveText(title!);
			await expect(desc(page)).toHaveClass(/is-expanded/);

			// Collapse (from the scrolled end) restores the exact collapsed layout.
			await toggle(page).click();
			await expectCollapsedAgain(page, collapsed);
			// A slide change also collapses.
			await toggle(page).click();
			await expect(desc(page)).toHaveClass(/is-expanded/);
			await page.locator("button.billboard__nav--next").click();
			await expect(page.locator(".billboard__title")).not.toHaveText(title!);
			await expect(desc(page)).not.toHaveClass(/is-expanded/);
			await expect(toggle(page)).toHaveAttribute("aria-label", "Expand description");
			expect(await desc(page).evaluate((el) => el.scrollTop)).toBe(0);
		});
	}

	// HERO-SVC-001: the episode page's service links sit in the action row on every layout.
	const ALL_SERVICES = {
		internetArchive: { url: "https://archive.org/details/invented-hero" },
		bbcSounds: { url: "https://www.bbc.co.uk/sounds/play/m000inv9" },
		apple: { url: "https://podcasts.apple.com/gb/podcast/invented/id1?i=9" },
		spotify: { url: "https://open.spotify.com/episode/inventedHero" },
		youtube: { url: "https://www.youtube.com/watch?v=inventedHero" }
	};
	const serviceLinks = (page: Page) => page.locator(".billboard__actions app-episode-links a");
	for (const layout of [...layouts, { name: "1024x460", width: 1024, height: 460, lines: 4 }]) {
		test(`${layout.name}: service links for the episode's services, in the action row (HERO-SVC-001)`, async ({ page }) => {
			await page.setViewportSize({ width: layout.width, height: layout.height });
			await fakeApi(page, VERY_LONG_DESC, undefined, undefined, ALL_SERVICES);
			await page.goto("/");
			await expect(serviceLinks(page)).toHaveCount(5);
			const links = await serviceLinks(page).evaluateAll((els) => els.map((a) => ({
				label: a.getAttribute("aria-label"), href: (a as HTMLAnchorElement).href,
				target: a.getAttribute("target"), rel: a.getAttribute("rel")
			})));
			expect(links.map((l) => l.label)).toEqual(["YouTube", "Spotify", "Apple Podcasts", "BBC Sounds", "Internet Archive"]);
			expect(links.map((l) => l.href)).toEqual([
				ALL_SERVICES.youtube.url, ALL_SERVICES.spotify.url, ALL_SERVICES.apple.url,
				ALL_SERVICES.bbcSounds.url, ALL_SERVICES.internetArchive.url
			]);
			for (const l of links) {
				expect(l.target).toBe("_blank");
				expect(l.rel).toBe("noopener noreferrer");
			}
			// Inside the card, clear of the description / chevron, and (except stacked mobile
			// buttons) on the same row as More info.
			const geo = await page.evaluate(() => {
				const r = (s: string) => document.querySelector(s)!.getBoundingClientRect();
				const host = r(".billboard__services"), more = r(".billboard__more"), card = r(".billboard__content");
				return { host: { top: host.top, bottom: host.bottom, left: host.left, right: host.right }, more: { top: more.top, bottom: more.bottom }, card: { left: card.left, right: card.right }, vw: window.innerWidth };
			});
			expect(geo.host.right).toBeLessThanOrEqual(Math.min(geo.card.right, geo.vw) + 1);
			if (layout.name !== "mobile") {
				const mid = (geo.host.top + geo.host.bottom) / 2;
				expect(mid, "service links wrapped onto their own row").toBeGreaterThan(geo.more.top);
				expect(mid).toBeLessThan(geo.more.bottom);
			}
			expect(await overlapsActions(page)).toBe(false);
			if (shots) {
				await page.locator(".billboard__actions").scrollIntoViewIfNeeded();
				await page.screenshot({ path: `${shots}/hero-${layout.name}-services-collapsed.png` });
			}
			// Expanded still fills to the foot with the chevron visible, links and all.
			await page.locator(".billboard__content").evaluate((el) => el.scrollIntoView({ block: "end" }));
			const collapsed = await geometry(page);
			await toggle(page).click();
			await expect(desc(page)).toHaveClass(/is-expanded/);
			await expectExpandedFills(page, collapsed, shots ? `hero-${layout.name}-services` : undefined);
			await expect(serviceLinks(page)).toHaveCount(5);
		});
	}

	test("no service links when the episode has none (HERO-SVC-001)", async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await fakeApi(page, SHORT_DESC, undefined, undefined, null);
		await page.goto("/");
		await expect(page.locator(".billboard__more")).toBeVisible();
		await expect(serviceLinks(page)).toHaveCount(0);
	});

	test("only the services the episode has (HERO-SVC-001)", async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await fakeApi(page, SHORT_DESC, undefined, undefined, { spotify: ALL_SERVICES.spotify });
		await page.goto("/");
		await expect(serviceLinks(page)).toHaveCount(1);
		await expect(serviceLinks(page).first()).toHaveAttribute("aria-label", "Spotify");
		await expect(serviceLinks(page).first()).toHaveAttribute("href", ALL_SERVICES.spotify.url);
	});

	test("no expander when the description fits the clamp", async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await fakeApi(page, SHORT_DESC);
		await page.goto("/");
		await expect(desc(page)).toHaveText(SHORT_DESC);
		await expect(page.locator(".billboard__desc-wrap")).toHaveCount(1);
		await expect(toggle(page)).toHaveCount(0);
	});

	/**
	 * HERO-WID-001 (collapsed): on wide the hero is one band (min(88vh, 720px)) with the
	 * card bottom-anchored at its flex-end; a tall card fits by dropping desc lines (5 → 2)
	 * instead of growing the hero. HERO-DSC-002 (expanded) then keeps that band too.
	 */
	const LONG_TITLE = "An invented episode title that runs long enough to wrap onto three full lines here";
	const TWO_LINE_TITLE = "An invented episode title that wraps onto two lines";
	const CHIPS = ["Invented subject one", "Invented subject two", "Invented subject three", "Invented four"];

	function expectInBand(g: Geo, what: string): void {
		expect(g.heroH, `${what}: hero not in its band`).toBeLessThanOrEqual(g.band + 1);
		expect(Math.abs(g.cardBottom - g.anchor), `${what}: card not bottom-anchored`).toBeLessThanOrEqual(1);
		expect(g.cardTop, `${what}: card pushed into the search clearance`).toBeGreaterThanOrEqual(g.clearance - 2);
	}

	for (const c of [
		{ name: "tall card (3-line title)", title: LONG_TITLE, vp: { width: 1440, height: 900 }, shot: "hero-wide-anchored-tall-card" },
		{ name: "tall card (3-line title)", title: LONG_TITLE, vp: { width: 1920, height: 1080 }, shot: "" },
		{ name: "2-line title", title: TWO_LINE_TITLE, vp: { width: 1440, height: 900 }, shot: "hero-wide-2line" }
	]) {
		test(`HERO-WID-001 @ ${c.vp.width}x${c.vp.height}, ${c.name}: collapsed band; expanded keeps it and scrolls inside`, async ({ page }) => {
			await page.setViewportSize(c.vp);
			await fakeApi(page, VERY_LONG_DESC, c.title, CHIPS);
			await page.goto("/");
			await expect(toggle(page)).toBeVisible();
			const collapsed = await geometry(page);
			expectInBand(collapsed, "collapsed");
			expect(await lineCount(page)).toBeGreaterThanOrEqual(2);
			if (shots && c.shot) {
				await page.screenshot({ path: `${shots}/${c.shot}-collapsed.png` });
			}
			await toggle(page).click();
			await expect(desc(page)).toHaveClass(/is-expanded/);
			await expectExpandedFills(page, collapsed, c.shot || undefined);
			const expanded = await geometry(page);
			// The card keeps its top (it fits) and grows down past the band, over the stats strip.
			expect(Math.abs(expanded.cardTop - collapsed.cardTop)).toBeLessThanOrEqual(1);
			expect(expanded.cardBottom).toBeGreaterThan(collapsed.cardBottom);
			await toggle(page).click();
			await expectCollapsedAgain(page, collapsed);
			expectInBand(await geometry(page), "collapsed again");
		});
	}

	// Short window: the collapsed card already ends below the viewport, so expanding lifts
	// it (over the art) until its bottom and the chevron are back in view.
	// Jon's case (~1024x460, scrolled so the stats strip shows under the hero): the card
	// fills to the viewport foot over the strip, rather than stopping at the hero bottom.
	test("1024x460, stats strip in view: the expanded card fills to the viewport foot over it", async ({ page }) => {
		await page.setViewportSize({ width: 1024, height: 460 });
		await fakeApi(page, VERY_LONG_DESC);
		await page.goto("/");
		await expect(toggle(page)).toBeVisible();
		await expect(page.locator(".catalogue")).toBeVisible();
		// Hero bottom at ~70% of the viewport, the strip below it.
		await page.evaluate(() => {
			const h = document.querySelector(".billboard")!.getBoundingClientRect();
			window.scrollBy(0, h.bottom - window.innerHeight * 0.7);
		});
		await expect.poll(() => toggle(page).evaluate((el) => el.getBoundingClientRect().bottom < window.innerHeight)).toBe(true);
		if (shots) {
			await page.screenshot({ path: `${shots}/hero-wide-1024x460-collapsed.png` });
		}
		const collapsed = await geometry(page);
		const stripTop = await page.locator(".catalogue").evaluate((el) => el.getBoundingClientRect().top);
		expect(stripTop, "strip not in view below the hero").toBeLessThan(collapsed.vh - 40);
		await toggle(page).click();
		await expect(desc(page)).toHaveClass(/is-expanded/);
		await expectExpandedFills(page, collapsed, "hero-wide-1024x460");
		const covered = await page.evaluate(() => {
			const c = document.querySelector(".billboard__content")!.getBoundingClientRect();
			return c.bottom - document.querySelector(".catalogue")!.getBoundingClientRect().top;
		});
		expect(covered, "card does not overlay the strip").toBeGreaterThan(30);
		await toggle(page).click();
		await expectCollapsedAgain(page, collapsed);
	});

	test("medium, short window: the expanded card is lifted into the viewport", async ({ page }) => {
		await page.setViewportSize({ width: 900, height: 640 });
		await fakeApi(page, VERY_LONG_DESC);
		await page.goto("/");
		await toggle(page).scrollIntoViewIfNeeded();
		const collapsed = await geometry(page);
		await toggle(page).click();
		await expect(desc(page)).toHaveClass(/is-expanded/);
		await expectExpandedFills(page, collapsed);
		await toggle(page).click();
		await expectCollapsedAgain(page, collapsed);
	});

	// Jon (6e002b7): the card re-fitted to the viewport on every page scroll (changing shape
	// while the text inside stood still) and collapsed once the hero went behind the header,
	// with text still on screen. The fit is measured once, when expanding: page scroll then
	// carries the card like any content: same shape, same inner scroll, never collapsed.
	for (const vp of [{ name: "1024x460", width: 1024, height: 460 }, { name: "1440x900", width: 1440, height: 900 }]) {
		test(`${vp.name}: page scroll while expanded moves the card with the page; no re-fit, no collapse`, async ({ page }) => {
			await page.setViewportSize(vp);
			await fakeApi(page, VERY_LONG_DESC);
			await page.goto("/");
			await expect(toggle(page)).toBeVisible();
			// Like a reader: scroll until the whole card is just in view.
			await page.locator(".billboard__content").evaluate((el) => el.scrollIntoView({ block: "end" }));
			const collapsed = await geometry(page);
			await toggle(page).click();
			await expect(desc(page)).toHaveClass(/is-expanded/);
			await expectExpandedFills(page, collapsed);
			const read = () => page.evaluate(() => {
				const h = document.querySelector(".billboard")!.getBoundingClientRect();
				const c = document.querySelector(".billboard__content")!.getBoundingClientRect();
				const d = document.querySelector<HTMLElement>(".billboard__desc")!;
				return {
					scrollY: window.scrollY, cardH: c.height, cardInHero: c.top - h.top, cardBottom: c.bottom,
					descH: d.clientHeight, descScroll: d.scrollTop, expanded: d.classList.contains("is-expanded")
				};
			});
			// Scroll inside the description first (wheel over the text).
			const box = (await desc(page).boundingBox())!;
			await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
			await page.mouse.wheel(0, 100);
			await expect.poll(async () => (await read()).descScroll).toBeGreaterThan(0);
			const start = await read();
			expect(start.scrollY, "wheel over the description scrolled the page").toBe(collapsed.scrollY);
			// Page wheel off to the side, down until the card has left the viewport, then back.
			await page.mouse.move(vp.width - 30, vp.height / 2);
			let steps = 0;
			for (; steps < 12; steps++) {
				await page.mouse.wheel(0, vp.height / 5);
				await page.waitForTimeout(150);
				const now = await read();
				expect(now.expanded, `collapsed while the card was on screen (step ${steps})`).toBe(true);
				expect(Math.abs(now.cardH - start.cardH), "card changed shape on page scroll").toBeLessThanOrEqual(1);
				expect(Math.abs(now.cardInHero - start.cardInHero), "card did not move with the page").toBeLessThanOrEqual(1);
				expect(now.descScroll, "inner scroll changed on page scroll").toBe(start.descScroll);
				if (now.cardBottom < 0) {
					break;
				}
			}
			expect((await read()).scrollY).toBeGreaterThan(start.scrollY);
			for (let i = 0; i <= steps + 2; i++) {
				await page.mouse.wheel(0, -vp.height / 5);
				await page.waitForTimeout(150);
			}
			await page.evaluate((y) => window.scrollTo(0, y), start.scrollY);
			await expect.poll(async () => (await read()).scrollY).toBe(start.scrollY);
			const back = await read();
			expect(back.expanded).toBe(true);
			expect(Math.abs(back.cardH - start.cardH)).toBeLessThanOrEqual(1);
			expect(back.descScroll).toBe(start.descScroll);
			await expectToggleVisible(page, "back where it was expanded");
			await toggle(page).click();
			await expectCollapsedAgain(page, collapsed);
		});
	}

	// Jon: "if I scroll to the bottom and collapse then the box becomes empty".
	for (const vp of [{ name: "wide", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
		test(`${vp.name}: scroll to the end of the expanded text, collapse, and the first line is back in the clamp`, async ({ page }) => {
			await page.setViewportSize(vp);
			await fakeApi(page, VERY_LONG_DESC, TWO_LINE_TITLE, CHIPS);
			await page.goto("/");
			await expect(toggle(page)).toBeVisible();
			const collapsed = await geometry(page);
			await toggle(page).click();
			await expect(desc(page)).toHaveClass(/is-expanded/);
			// Scroll as a reader would: wheel over the text to its end.
			const box = (await desc(page).boundingBox())!;
			await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
			await page.mouse.wheel(0, 20_000);
			await expect.poll(() => desc(page).evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
			// overscroll-behavior: contain — the page itself did not scroll.
			expect(await page.evaluate(() => window.scrollY)).toBe(collapsed.scrollY);
			await toggle(page).click();
			await expectCollapsedAgain(page, collapsed);
		});
	}
});
