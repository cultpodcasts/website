import { expect, test, type Page, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GuidService } from "../src/app/guid.service";
import { catalogueE2eOrigin as appOrigin } from "./catalogue-origin";

/**
 * Real-payload hero description regressions (#703).
 * Documents and YouTube stills were captured from api-preview (D1) for the
 * episodes Jon reproduced on the 5ba62750 preview. Viewports: 1160x800 and
 * 1024x768 (his screenshots) plus 1440x900 (wide overlay / homepage fitWideDesc).
 *
 * Previous containment tests used short synthetic copy, a 16x9 stub PNG, and
 * only 1440 — they passed while the real pages broke. These fixtures are the
 * real search + homepage payloads.
 */

const fx = (...parts: string[]) => join(process.cwd(), "e2e/fixtures/hero-desc-real", ...parts);
const loadJson = (name: string) => JSON.parse(readFileSync(fx(name), "utf8"));

const criticismSearch = loadJson("criticism.search.json");
const cherylSearch = loadJson("cheryl.search.json");
const gbSearch = loadJson("gb.search.json");
const criticismHome = loadJson("criticism.homepage.json");
const cherylHome = loadJson("cheryl.homepage.json");
const gbHome = loadJson("gb.homepage.json");

criticismSearch.image = criticismHome.image;
cherylSearch.image = cherylHome.image;
gbSearch.image = gbHome.image;

const stills: Record<string, Buffer> = {
	criticism: readFileSync(fx("criticism.jpg")),
	cheryl: readFileSync(fx("cheryl.jpg")),
	gb: readFileSync(fx("gb.jpg")),
};

const guids = new GuidService();
const shots = process.env.HERO_SCREENS_DIR;

const VP_1160 = { width: 1160, height: 800 };
const VP_1024 = { width: 1024, height: 768 };
const VP_1440 = { width: 1440, height: 900 };

const json = (route: Route, body: unknown) =>
	route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });

function podcastPath(seriesName: string, id: string): string {
	return `/podcast/${encodeURIComponent(seriesName)}/${guids.toBase64(id)}`;
}

function stillFor(url: string): Buffer {
	if (/cEFQEQcc1RU/i.test(url)) return stills.criticism;
	if (cherylHome.image && url.includes(new URL(cherylHome.image).pathname.split("/").at(-2)!)) return stills.cheryl;
	if (gbHome.image && url.includes(new URL(gbHome.image).pathname.split("/").at(-2)!)) return stills.gb;
	if (/cheryl|Rainfield/i.test(url)) return stills.cheryl;
	if (/Surviving|Paradise|gb/i.test(url)) return stills.gb;
	return stills.criticism;
}

async function installFakes(page: Page, opts: { item?: Record<string, unknown>; homepage?: unknown[] }): Promise<void> {
	await page.emulateMedia({ reducedMotion: "reduce" });
	await page.route("**/*", async (route) => {
		const url = route.request().url();
		if (url.startsWith(appOrigin) || /fonts\.(googleapis|gstatic)\.com/.test(url)) {
			await route.continue();
			return;
		}
		if (/i\.ytimg\.com|ytimg|img\.youtube|googleusercontent|\.(png|jpe?g|webp|gif)(\?|$)/i.test(url) || route.request().resourceType() === "image") {
			await route.fulfill({ status: 200, contentType: "image/jpeg", body: stillFor(url) });
			return;
		}
		if (url.includes("/homepage")) {
			const episodes = opts.homepage ?? [];
			await json(route, { recentEpisodes: episodes, episodeCount: episodes.length, totalDuration: "3:00:00" });
			return;
		}
		if (url.includes("/hero-curation")) {
			await json(route, { episodeIds: [], railSubjects: [], updatedAt: "2026-11-24T00:00:00.000Z" });
			return;
		}
		if (route.request().method() === "POST" && url.includes("/search")) {
			const filter = String(route.request().postDataJSON()?.filter ?? "");
			const doc = opts.item;
			const own = !!doc && filter.includes(String(doc.id)) && !filter.includes(" ne ");
			await json(route, { value: own && doc ? [doc] : [], "@search.engine": "d1" });
			return;
		}
		await json(route, {});
	});
}

const itemDesc = (page: Page) => page.locator("app-hero-description .hero-desc__text");
const itemToggle = (page: Page) => page.locator("app-hero-description button.hero-desc__toggle");
const homeDesc = (page: Page) => page.locator(".billboard__desc");
const homeToggle = (page: Page) => page.locator("button.billboard__desc-toggle");

async function openItem(page: Page, doc: Record<string, unknown>): Promise<void> {
	await installFakes(page, { item: doc });
	await page.goto(podcastPath(String(doc.seriesName), String(doc.id)));
	await expect(page.locator("h1.episode-hero__title")).toHaveText(String(doc.title));
	await expect(itemDesc(page)).toBeVisible();
}

async function goHome(page: Page): Promise<void> {
	await installFakes(page, { homepage: [gbHome, cherylHome, criticismHome] });
	await page.goto("/");
	await expect(page.locator(".billboard__title")).toBeVisible();
	await page.locator("section.billboard").hover();
}

async function showHomeSlide(page: Page, title: RegExp): Promise<void> {
	const n = await page.locator("button.billboard__dot").count();
	expect(n, "homepage should have billed slides").toBeGreaterThan(0);
	for (let i = 0; i < n; i++) {
		await page.evaluate((i) => {
			document.querySelectorAll<HTMLButtonElement>("button.billboard__dot")[i]?.click();
		}, i);
		await page.waitForFunction((i) => {
			const dots = [...document.querySelectorAll("button.billboard__dot")];
			return !!dots[i]?.classList.contains("is-active");
		}, i, { timeout: 5_000 });
		await page.waitForTimeout(400);
		const text = (await page.locator(".billboard__title").textContent()) ?? "";
		if (title.test(text)) return;
	}
	throw new Error(`homepage slide not found: ${title}`);
}

async function clampInfo(page: Page, descSel: string): Promise<{ clamp: number | "none"; overflowPx: number; linesVar: string }> {
	return page.evaluate((sel) => {
		const el = document.querySelector<HTMLElement>(sel)!;
		const cs = getComputedStyle(el);
		const raw = cs.webkitLineClamp;
		const parsed = Number.parseInt(raw, 10);
		const host = el.closest("app-hero-description, .billboard__content, .billboard, .episode-hero") as HTMLElement | null;
		return {
			clamp: raw === "none" || raw === "" || Number.isNaN(parsed) ? "none" : parsed,
			overflowPx: el.scrollHeight - el.clientHeight,
			linesVar: host ? getComputedStyle(host).getPropertyValue("--hero-desc-lines").trim() : "",
		};
	}, descSel);
}

async function waitFontsAndArt(page: Page): Promise<void> {
	await page.evaluate(() => document.fonts.ready);
	await page.waitForFunction(() => {
		const billboard = document.querySelector(".episode-billboard");
		const art = document.querySelector<HTMLElement>(".episode-backdrop");
		if (!billboard || !art) return false;
		if (!billboard.classList.contains("has-art-aspect")) return false;
		return art.getBoundingClientRect().height > 400;
	}, { timeout: 10_000 });
}

/** Boxes and the last actually-painted description line (ignores overflow:hidden tails). */
async function expandGeometry(page: Page, descSel: string, toggleSel: string) {
	return page.evaluate(({ descSel, toggleSel }) => {
		const desc = document.querySelector<HTMLElement>(descSel);
		const toggle = document.querySelector<HTMLElement>(toggleSel);
		const hero = document.querySelector<HTMLElement>(".episode-hero, .billboard__content");
		const billboard = document.querySelector<HTMLElement>(".episode-billboard, section.billboard");
		if (!desc || !hero || !billboard) {
			throw new Error("missing hero nodes");
		}
		const vh = window.innerHeight;
		const box = (el: HTMLElement | null) => {
			if (!el) return null;
			const b = el.getBoundingClientRect();
			const vis = Math.max(0, Math.min(b.bottom, vh) - Math.max(b.top, 0));
			return {
				top: b.top,
				bottom: b.bottom,
				left: b.left,
				right: b.right,
				vis,
				inView: b.top < vh - 8 && b.bottom > 8 && vis > 0,
			};
		};
		const range = document.createRange();
		range.selectNodeContents(desc);
		const client = desc.getBoundingClientRect();
		const lines = [...range.getClientRects()].filter(
			(x) => x.height > 0 && x.top >= client.top - 1 && x.bottom <= client.bottom + 1,
		);
		const last = lines[lines.length - 1];
		const cs = getComputedStyle(hero, "::before");
		const hr = hero.getBoundingClientRect();
		const hasBefore = cs.content !== "none" && cs.position === "absolute";
		const card = hasBefore
			? {
				top: hr.top + (Number.parseFloat(cs.top) || 0),
				bottom: hr.bottom - (Number.parseFloat(cs.bottom) || 0),
				left: hr.left + (Number.parseFloat(cs.left) || 0),
				right: hr.right - (Number.parseFloat(cs.right) || 0),
			}
			: box(hero)!;
		const insideCard = (b: { top: number; bottom: number; left: number; right: number } | null) =>
			!!b && b.top >= card.top - 2 && b.bottom <= card.bottom + 2 && b.left >= card.left - 2 && b.right <= card.right + 2;
		const lastBox = last
			? { top: last.top, bottom: last.bottom, left: last.left, right: last.right }
			: null;
		return {
			scrollY: window.scrollY,
			vh,
			hasBefore,
			card,
			desc: box(desc),
			toggle: box(toggle),
			hero: box(hero),
			billboard: box(billboard),
			lastLine: lastBox,
			lastLineInView: !!lastBox && lastBox.top < vh - 8 && lastBox.bottom > 8,
			descInCard: insideCard(box(desc)),
			toggleInCard: insideCard(box(toggle)),
			lastLineInCard: insideCard(lastBox),
		};
	}, { descSel, toggleSel });
}

test.describe("real-payload hero description (#703)", () => {
	test("episode page 1160x800: expanding the Leaving the Message criticism episode keeps the text and chevron on screen in the card", async ({ page }) => {
		await page.setViewportSize(VP_1160);
		await openItem(page, criticismSearch);
		await waitFontsAndArt(page);
		await expect(itemToggle(page)).toBeVisible();
		if (shots) await page.screenshot({ path: `${shots}/real-ep-criticism-1160-collapsed.png` });
		await itemToggle(page).click();
		await expect(itemDesc(page)).toHaveClass(/is-expanded/);
		if (shots) await page.screenshot({ path: `${shots}/real-ep-criticism-1160-expanded.png` });
		const g = await expandGeometry(page, "app-hero-description .hero-desc__text", "app-hero-description button.hero-desc__toggle");
		expect(g.toggle?.inView, `expanded chevron is off-screen (toggle=${JSON.stringify(g.toggle)}, scrollY=${g.scrollY}, lastLine=${JSON.stringify(g.lastLine)})`).toBe(true);
		expect(g.lastLineInView, `expanded description is cut off at the viewport with the chevron gone (lastLine=${JSON.stringify(g.lastLine)}, vh=${g.vh})`).toBe(true);
		expect(g.descInCard, `description overflows the episode card ${JSON.stringify(g)}`).toBe(true);
		expect(g.toggleInCard, "chevron overflows the episode card").toBe(true);
	});

	test("episode page 1440x900: expanding the criticism episode keeps the text and chevron on screen inside the painted card", async ({ page }) => {
		await page.setViewportSize(VP_1440);
		await openItem(page, criticismSearch);
		await waitFontsAndArt(page);
		await expect(itemToggle(page)).toBeVisible();
		if (shots) await page.screenshot({ path: `${shots}/real-ep-criticism-1440-collapsed.png` });
		await itemToggle(page).click();
		await expect(itemDesc(page)).toHaveClass(/is-expanded/);
		if (shots) await page.screenshot({ path: `${shots}/real-ep-criticism-1440-expanded.png` });
		const g = await expandGeometry(page, "app-hero-description .hero-desc__text", "app-hero-description button.hero-desc__toggle");
		expect(g.hasBefore, "wide episode page should paint the ::before card").toBe(true);
		// Previous geometric tests passed because the chevron and last lines sat inside
		// a card that had grown *below the fold*. The real page looks broken: the text
		// is cut off at the bottom of the viewport and the chevron is gone. Homepage
		// expand at this width keeps the chevron in view and the card in the band.
		expect(g.toggle?.inView, `expanded chevron is off-screen (toggle=${JSON.stringify(g.toggle)}, scrollY=${g.scrollY}, vh=${g.vh})`).toBe(true);
		expect(g.lastLineInView, `expanded description is cut off at the viewport (lastLine=${JSON.stringify(g.lastLine)}, vh=${g.vh})`).toBe(true);
		expect(g.descInCard, `description overflows the painted card ${JSON.stringify(g)}`).toBe(true);
		expect(g.toggleInCard, "chevron overflows the painted card").toBe(true);
		expect(g.lastLineInCard, "last painted line of the description sits outside the painted card").toBe(true);
	});

	test("homepage 1024x768: after a long overflowing slide, the short Cheryl Rainfield description has no expander", async ({ page }) => {
		await page.setViewportSize(VP_1024);
		await goHome(page);
		await showHomeSlide(page, /When Criticism Becomes a Spiritual Threat/i);
		await expect(homeToggle(page)).toBeVisible();
		await showHomeSlide(page, /Gaslight us the Way Cult did/i);
		await expect(homeDesc(page)).toContainText(/Cult created personalities who would gaslight us the way cult did/i);
		if (shots) await page.screenshot({ path: `${shots}/real-home-cheryl-1024.png` });
		await expect(homeToggle(page), "expander shown for a short Cheryl description that fits the clamp").toHaveCount(0);
		const info = await clampInfo(page, ".billboard__desc");
		expect(info.overflowPx, `Cheryl description is not overflowing (${info.overflowPx}px) so the chevron must hide`).toBeLessThanOrEqual(1);
	});

	test("homepage 1440x900: the short Cheryl Rainfield description has no expander (it fits in 3 of 5 lines)", async ({ page }) => {
		await page.setViewportSize(VP_1440);
		await goHome(page);
		await showHomeSlide(page, /When Criticism Becomes a Spiritual Threat/i);
		await expect(homeToggle(page)).toBeVisible();
		await showHomeSlide(page, /Gaslight us the Way Cult did/i);
		await expect(homeDesc(page)).toContainText(/Cult created personalities who would gaslight us the way cult did/i);
		if (shots) await page.screenshot({ path: `${shots}/real-home-cheryl-1440.png` });
		await expect(homeToggle(page), "expander shown for Cheryl's short description at 1440").toHaveCount(0);
		const info = await clampInfo(page, ".billboard__desc");
		expect(info.overflowPx).toBeLessThanOrEqual(1);
	});

	test("1440x900: homepage and episode page use the same clamp and expander for the Surviving Paradise GB update", async ({ page }) => {
		await page.setViewportSize(VP_1440);
		await goHome(page);
		await showHomeSlide(page, /Governing Body Update: More Moldy Food/i);
		await expect(page.locator(".billboard__title")).toContainText(/Governing Body Update: More Moldy Food/i);
		if (shots) await page.screenshot({ path: `${shots}/real-home-gb-1440.png` });
		const home = await clampInfo(page, ".billboard__desc");
		const homeToggleCount = await homeToggle(page).count();

		await openItem(page, gbSearch);
		if (shots) await page.screenshot({ path: `${shots}/real-ep-gb-1440.png` });
		const item = await clampInfo(page, "app-hero-description .hero-desc__text");
		const itemToggleCount = await itemToggle(page).count();

		expect(home.clamp, `homepage clamp ${home.clamp} (linesVar ${home.linesVar}) vs episode clamp ${item.clamp}`).toEqual(item.clamp);
		expect(homeToggleCount, `homepage expander count ${homeToggleCount} vs episode ${itemToggleCount}`).toBe(itemToggleCount);
	});
});
