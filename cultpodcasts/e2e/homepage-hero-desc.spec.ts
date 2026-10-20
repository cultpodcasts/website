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

function homepage(description: string, title?: string, subjects = ["Invented subject"]) {
	const now = Date.now();
	const recentEpisodes = Array.from({ length: 4 }, (_, i) => ({
		id: `00000000-0000-4000-8000-00000000000${i + 1}`,
		podcastName: `Invented Show ${String.fromCharCode(65 + i)}`,
		episodeTitle: title ?? `Invented episode title ${i + 1}`,
		episodeDescription: description,
		release: new Date(now - (i + 1) * 3_600_000).toISOString(),
		duration: "01:02:03",
		services: { youtube: { url: `https://www.youtube.com/watch?v=synthetic${i}` } },
		ids: { youtube: `synthetic${i}` },
		subjects,
		image: `https://img.example.test/hero-${i}.png`
	}));
	return { recentEpisodes, episodeCount: recentEpisodes.length, totalDuration: "4:00:00" };
}

async function fakeApi(page: Page, description: string, title?: string, subjects?: string[]): Promise<void> {
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
			await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(homepage(description, title, subjects)) });
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
 * HERO-DSC-002, expanded: the hero keeps its height, the card bottom stays in the
 * viewport, the description scrolls inside the card, title + Watch/More info stay in
 * view, and the chevron is visible at both ends of the description's scroll.
 */
async function expectExpandedCapped(page: Page, collapsed: Geo, shot?: string): Promise<void> {
	const g = await geometry(page);
	expect(Math.abs(g.heroH - collapsed.heroH), "expanding changed the hero height").toBeLessThanOrEqual(1);
	expect(g.scrollY, "expanding scrolled the page").toBe(collapsed.scrollY);
	const box = await page.evaluate(() => {
		const d = document.querySelector<HTMLElement>(".billboard__desc")!;
		const c = document.querySelector(".billboard__content")!.getBoundingClientRect();
		const t = document.querySelector(".billboard__title")!.getBoundingClientRect();
		const a = document.querySelector(".billboard__actions")!.getBoundingClientRect();
		// The app's search field (dropped into the hero, or in the sticky chrome row).
		const search = document.querySelector(".chrome-search")?.getBoundingClientRect();
		return {
			cardTop: c.top, searchBottom: search?.bottom ?? 0,
			cardBottom: c.bottom, titleTop: t.top, actionsBottom: a.bottom,
			scrollable: d.scrollHeight - d.clientHeight, overflowY: getComputedStyle(d).overflowY
		};
	});
	expect(box.cardBottom, "card runs past the viewport bottom").toBeLessThanOrEqual(g.vh + 1);
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
		test(`${layout.name}: clamps to ${layout.lines} lines; expanded keeps the hero, caps the card at the viewport and scrolls inside`, async ({ page }) => {
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
			await expectExpandedCapped(page, collapsed, `hero-${layout.name}`);

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
			await expectExpandedCapped(page, collapsed, c.shot || undefined);
			const expanded = await geometry(page);
			// The card grows upward from its anchor (wide), staying below the search clearance.
			expect(Math.abs(expanded.cardBottom - collapsed.cardBottom)).toBeLessThanOrEqual(1);
			expect(expanded.cardTop).toBeLessThanOrEqual(collapsed.cardTop + 0.5);
			expect(expanded.cardTop).toBeGreaterThanOrEqual(expanded.clearance - 2);
			await toggle(page).click();
			await expectCollapsedAgain(page, collapsed);
			expectInBand(await geometry(page), "collapsed again");
		});
	}

	// Short window: the collapsed card already ends below the viewport, so expanding lifts
	// it (over the art) until its bottom and the chevron are back in view.
	test("medium, short window: the expanded card is lifted into the viewport", async ({ page }) => {
		await page.setViewportSize({ width: 900, height: 640 });
		await fakeApi(page, VERY_LONG_DESC);
		await page.goto("/");
		await toggle(page).scrollIntoViewIfNeeded();
		const collapsed = await geometry(page);
		await toggle(page).click();
		await expect(desc(page)).toHaveClass(/is-expanded/);
		await expectExpandedCapped(page, collapsed);
		await toggle(page).click();
		await expectCollapsedAgain(page, collapsed);
	});

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
