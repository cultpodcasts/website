import { expect, test, type Page } from "@playwright/test";

/**
 * Homepage hero description: per-layout clamp, the icon expander, and
 * rotation paused while expanded. Real app (ng serve), faked /homepage.
 * Made-up shows, titles and descriptions only.
 *
 * Set HERO_SCREENS_DIR to save collapsed/expanded screenshots per layout.
 */

const LONG_DESC = Array.from({ length: 14 }, (_, i) =>
	`Synthetic hero sentence ${i + 1} describes an invented episode at some length.`
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

/** Expanded: every line is rendered in the box (no inner scroll), and the box is not clipped by the hero. */
async function expectFullTextShown(page: Page): Promise<void> {
	const r = await desc(page).evaluate((el) => {
		const d = el.getBoundingClientRect();
		const h = document.querySelector(".billboard")!.getBoundingClientRect();
		const style = getComputedStyle(el);
		return {
			overflow: el.scrollHeight - el.clientHeight,
			overflowY: style.overflowY,
			inside: d.top >= h.top - 1 && d.bottom <= h.bottom + 1
		};
	});
	expect(r.overflow, "expanded description still scrolls").toBeLessThanOrEqual(1);
	expect(r.overflowY).not.toBe("auto");
	expect(r.inside, "expanded description clipped by the hero").toBe(true);
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

test.describe("homepage hero description", () => {
	for (const layout of layouts) {
		test(`${layout.name}: clamps to ${layout.lines} lines, the expander expands in place and pauses rotation`, async ({ page }) => {
			await page.setViewportSize({ width: layout.width, height: layout.height });
			await fakeApi(page, LONG_DESC);
			await page.goto("/");
			await expect(desc(page)).toBeVisible();
			await expect(toggle(page)).toHaveAttribute("aria-label", "Expand description");
			await expect(toggle(page).locator("mat-icon")).toHaveText("expand_more");
			expect(await lineCount(page)).toBe(layout.lines);
			await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
			const controls = await toggle(page).getAttribute("aria-controls");
			expect(controls).toBe(await desc(page).getAttribute("id"));
			expect(await overlapsActions(page)).toBe(false);
			// HERO-DSC-001: inline on the last visible line, right edge of the text column (no extra row).
			const inline = await inlineToggle(page);
			expect(Math.abs(inline.centreOffset), "toggle not centred on the last line").toBeLessThanOrEqual(3);
			expect(Math.abs(inline.rightOffset), "toggle not at the end of the text column").toBeLessThanOrEqual(1);
			const dir = process.env.HERO_SCREENS_DIR;
			if (dir) {
				await page.locator(".billboard").screenshot({ path: `${dir}/hero-${layout.name}-collapsed.png` });
			}

			const collapsedHeight = (await desc(page).boundingBox())!.height;
			await toggle(page).click();
			// Drop keyboard focus so only the expanded state can be holding the slide
			// (focus inside the hero pauses it too). The pointer stays on the copy, which
			// is not a hover-pause target (HERO-CTL-003).
			await toggle(page).evaluate((el) => (el as HTMLElement).blur());
			await expect(toggle(page)).toHaveAttribute("aria-label", "Collapse description");
			await expect(toggle(page).locator("mat-icon")).toHaveText("expand_less");
			await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
			await expect(desc(page)).toHaveClass(/is-expanded/);
			expect((await desc(page).boundingBox())!.height).toBeGreaterThan(collapsedHeight);
			expect(await overlapsActions(page)).toBe(false);
			// Expanded = the whole description, never an inner scroll box (any layout).
			await expectFullTextShown(page);
			// Rotation is held while expanded.
			await expect(page.locator(".billboard")).toHaveClass(/is-paused/);
			const title = await page.locator(".billboard__title").textContent();
			if (dir) {
				await page.locator(".billboard").screenshot({ path: `${dir}/hero-${layout.name}-expanded.png` });
			}
			await page.waitForTimeout(9_000);
			await expect(page.locator(".billboard__title")).toHaveText(title!);
			await expect(desc(page)).toHaveClass(/is-expanded/);

			// Collapse; a slide change also collapses.
			await toggle(page).click();
			await expect(desc(page)).not.toHaveClass(/is-expanded/);
			await toggle(page).click();
			await expect(desc(page)).toHaveClass(/is-expanded/);
			await page.locator("button.billboard__nav--next").click();
			await expect(page.locator(".billboard__title")).not.toHaveText(title!);
			await expect(desc(page)).not.toHaveClass(/is-expanded/);
			await expect(toggle(page)).toHaveAttribute("aria-label", "Expand description");
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
	 * HERO-WID-001: on wide the hero is one band (min(88vh, 720px)) with the card
	 * bottom-anchored at its flex-end. Collapsed, a tall card (3-line title, long
	 * description, chips) must not grow the hero (that pushed the card top into the
	 * search clearance and the hero bottom below the fold). Expanded shows the full
	 * description with no inner scroll box: the card grows upward first, then the hero
	 * may grow; collapsing returns to the band exactly.
	 */
	const LONG_TITLE = "An invented episode title that runs long enough to wrap onto three full lines here";
	const TWO_LINE_TITLE = "An invented episode title that wraps onto two lines";
	const CHIPS = ["Invented subject one", "Invented subject two", "Invented subject three", "Invented four"];
	type Geo = { heroH: number; band: number; cardTop: number; cardBottom: number; anchor: number; clearance: number };
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
			clearance: parseFloat(cs.paddingTop)
		};
	});

	function expectInBand(g: Geo, what: string): void {
		expect(g.heroH, `${what}: hero not back to its band`).toBeLessThanOrEqual(g.band + 1);
		expect(Math.abs(g.cardBottom - g.anchor), `${what}: card not bottom-anchored`).toBeLessThanOrEqual(1);
		expect(g.cardTop, `${what}: card pushed into the search clearance`).toBeGreaterThanOrEqual(g.clearance - 2);
	}

	for (const c of [
		{ name: "tall card (3-line title)", title: LONG_TITLE, vp: { width: 1440, height: 900 }, shot: "hero-wide-anchored-tall-card" },
		{ name: "tall card (3-line title)", title: LONG_TITLE, vp: { width: 1920, height: 1080 }, shot: "" },
		{ name: "2-line title", title: TWO_LINE_TITLE, vp: { width: 1440, height: 900 }, shot: "hero-wide-2line" }
	]) {
		test(`HERO-WID-001 @ ${c.vp.width}x${c.vp.height}, ${c.name}: collapsed keeps the band; expanded shows the full text, growing upward first`, async ({ page }) => {
			await page.setViewportSize(c.vp);
			await fakeApi(page, LONG_DESC, c.title, CHIPS);
			await page.goto("/");
			await expect(toggle(page)).toBeVisible();
			const collapsed = await geometry(page);
			expectInBand(collapsed, "collapsed");
			expect(await lineCount(page)).toBeGreaterThanOrEqual(2);
			const dir = process.env.HERO_SCREENS_DIR;
			if (dir && c.shot) {
				await page.locator(".billboard").screenshot({ path: `${dir}/${c.shot}-collapsed.png` });
			}

			await toggle(page).click();
			await expect(desc(page)).toHaveClass(/is-expanded/);
			await expectFullTextShown(page);
			const expanded = await geometry(page);
			// Upward first: the card top rises to the clearance before the hero grows.
			expect(expanded.cardTop).toBeLessThanOrEqual(collapsed.cardTop + 0.5);
			expect(expanded.cardTop).toBeGreaterThanOrEqual(expanded.clearance - 2);
			if (expanded.heroH > collapsed.band + 1) {
				expect(expanded.cardTop, "hero grew before the card used the free space above it").toBeLessThanOrEqual(expanded.clearance + 2);
			}
			// Still anchored to the (possibly taller) hero bottom.
			expect(Math.abs(expanded.cardBottom - expanded.anchor)).toBeLessThanOrEqual(1);
			expect(await overlapsActions(page)).toBe(false);
			if (dir && c.shot) {
				await page.locator(".billboard").screenshot({ path: `${dir}/${c.shot}-expanded.png` });
			}

			await toggle(page).click();
			await expect(desc(page)).not.toHaveClass(/is-expanded/);
			const back = await geometry(page);
			expectInBand(back, "collapsed again");
			expect(Math.abs(back.heroH - collapsed.heroH)).toBeLessThanOrEqual(1);
			expect(Math.abs(back.cardTop - collapsed.cardTop)).toBeLessThanOrEqual(1);
		});
	}

	// Jon: "if I scroll to the bottom and collapse then the box becomes empty".
	for (const vp of [{ name: "wide", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
		test(`${vp.name}: scroll to the end of the expanded text, collapse, and the first line is back in the clamp`, async ({ page }) => {
			await page.setViewportSize(vp);
			await fakeApi(page, LONG_DESC, TWO_LINE_TITLE, CHIPS);
			await page.goto("/");
			await expect(toggle(page)).toBeVisible();
			await toggle(page).click();
			await expect(desc(page)).toHaveClass(/is-expanded/);
			// Scroll as a reader would: wheel over the text to its end, and push the box too.
			const box = (await desc(page).boundingBox())!;
			await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
			await page.mouse.wheel(0, 2_000);
			await desc(page).evaluate((el) => { el.scrollTop = el.scrollHeight; });
			await page.waitForTimeout(200);
			await toggle(page).click();
			await expect(desc(page)).not.toHaveClass(/is-expanded/);
			const first = await desc(page).evaluate((el) => {
				const text = el.firstChild!;
				const range = document.createRange();
				range.setStart(text, 0);
				range.setEnd(text, 1);
				const r = range.getBoundingClientRect();
				const d = el.getBoundingClientRect();
				return { scrollTop: el.scrollTop, offset: r.top - d.top, line: parseFloat(getComputedStyle(el).lineHeight) };
			});
			expect(first.scrollTop).toBe(0);
			expect(first.offset, "first line not at the top of the clamp").toBeGreaterThanOrEqual(-1);
			expect(first.offset).toBeLessThanOrEqual(first.line);
		});
	}
});
