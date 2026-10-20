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
			if (layout.name === "mobile") {
				// Phone: expanded text scrolls inside a cap instead of pushing Watch a screen down.
				const box = (await desc(page).boundingBox())!;
				expect(box.height).toBeLessThanOrEqual(layout.height * 0.45 + 1);
			}
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
		await expect(page.locator(".billboard__desc-more")).toHaveCount(1);
		await expect(toggle(page)).toHaveCount(0);
	});

	/**
	 * HERO-WID-001: on wide the hero is one band (min(88vh, 720px)) with the card
	 * bottom-anchored at its flex-end. A tall card (3-line title, long description,
	 * expander, chips) must not grow the hero (that pushed the card top into the
	 * search clearance and the hero bottom below the fold); expanding grows the card
	 * upward and scrolls past the band, never taller.
	 */
	const LONG_TITLE = "An invented episode title that runs long enough to wrap onto three full lines here";
	const CHIPS = ["Invented subject one", "Invented subject two", "Invented subject three", "Invented four"];
	type Geo = { heroH: number; band: number; cardTop: number; cardBottom: number; anchor: number; clearance: number; descScrolls: boolean };
	const geometry = (page: Page): Promise<Geo> => page.evaluate(() => {
		const hero = document.querySelector<HTMLElement>(".billboard")!;
		const card = document.querySelector<HTMLElement>(".billboard__content")!;
		const d = document.querySelector<HTMLElement>(".billboard__desc")!;
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
			descScrolls: d.scrollHeight - d.clientHeight > 1
		};
	});

	for (const vp of [{ width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
		test(`HERO-WID-001 @ ${vp.width}x${vp.height}: tall card stays bottom-anchored; hero keeps its band collapsed and expanded`, async ({ page }) => {
			await page.setViewportSize(vp);
			await fakeApi(page, LONG_DESC, LONG_TITLE, CHIPS);
			await page.goto("/");
			await expect(toggle(page)).toBeVisible();
			const before = await geometry(page);
			expect(before.heroH, "hero grew past its band").toBeLessThanOrEqual(before.band + 1);
			expect(Math.abs(before.cardBottom - before.anchor), "card not bottom-anchored").toBeLessThanOrEqual(1);
			expect(before.cardTop, "card pushed into the search clearance").toBeGreaterThanOrEqual(before.clearance - 2);
			expect(await lineCount(page)).toBeGreaterThanOrEqual(2);
			if (process.env.HERO_SCREENS_DIR && vp.width === 1440) {
				await page.locator(".billboard").screenshot({ path: `${process.env.HERO_SCREENS_DIR}/hero-wide-anchored-tall-card.png` });
			}

			await toggle(page).click();
			await expect(desc(page)).toHaveClass(/is-expanded/);
			const after = await geometry(page);
			expect(after.heroH, "expanding grew the hero").toBeLessThanOrEqual(before.band + 1);
			expect(Math.abs(after.cardBottom - before.cardBottom), "expanding moved the anchored bottom").toBeLessThanOrEqual(1);
			expect(after.cardTop).toBeLessThanOrEqual(before.cardTop + 0.5);
			expect(after.descScrolls, "the rest of the text should scroll inside the band").toBe(true);
			expect(await overlapsActions(page)).toBe(false);
		});
	}

	test("HERO-WID-001: short title keeps 5 lines; expanding grows the card upward, not the hero", async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 900 });
		await fakeApi(page, LONG_DESC, "Invented short title");
		await page.goto("/");
		await expect(toggle(page)).toBeVisible();
		expect(await lineCount(page)).toBe(5);
		const before = await geometry(page);
		expect(before.heroH).toBeLessThanOrEqual(before.band + 1);
		await toggle(page).click();
		await expect(desc(page)).toHaveClass(/is-expanded/);
		const after = await geometry(page);
		expect(after.heroH).toBeLessThanOrEqual(before.band + 1);
		expect(Math.abs(after.cardBottom - before.cardBottom)).toBeLessThanOrEqual(1);
		expect(after.cardTop).toBeLessThan(before.cardTop - 20);
		expect(after.cardTop).toBeGreaterThanOrEqual(after.clearance - 2);
		if (process.env.HERO_SCREENS_DIR) {
			await page.locator(".billboard").screenshot({ path: `${process.env.HERO_SCREENS_DIR}/hero-wide-anchored-expanded.png` });
		}
	});
});
