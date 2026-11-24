import { expect, test, type Page, type Route } from "@playwright/test";
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
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


type RgbaPng = { width: number; height: number; bpp: number; data: Buffer };

function decodePng(buf: Buffer): RgbaPng {
	let pos = 8;
	let width = 0;
	let height = 0;
	let bitDepth = 0;
	let colorType = 0;
	const idat: Buffer[] = [];
	while (pos < buf.length) {
		const len = buf.readUInt32BE(pos);
		const type = buf.toString("ascii", pos + 4, pos + 8);
		const data = buf.subarray(pos + 8, pos + 8 + len);
		if (type === "IHDR") {
			width = data.readUInt32BE(0);
			height = data.readUInt32BE(4);
			bitDepth = data[8];
			colorType = data[9];
		} else if (type === "IDAT") {
			idat.push(data);
		} else if (type === "IEND") {
			break;
		}
		pos += 12 + len;
	}
	const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
	if (!bpp || bitDepth !== 8) {
		throw new Error(`Unsupported PNG colorType=${colorType} bitDepth=${bitDepth}`);
	}
	const raw = inflateSync(Buffer.concat(idat));
	const stride = width * bpp;
	const out = Buffer.alloc(height * stride);
	for (let y = 0; y < height; y++) {
		const f = raw[y * (stride + 1)];
		const src = y * (stride + 1) + 1;
		const dst = y * stride;
		for (let x = 0; x < stride; x++) {
			const val = raw[src + x];
			const a = x >= bpp ? out[dst + x - bpp] : 0;
			const b = y > 0 ? out[dst - stride + x] : 0;
			const c = y > 0 && x >= bpp ? out[dst - stride + x - bpp] : 0;
			let recon = val;
			if (f === 1) recon = (val + a) & 0xff;
			else if (f === 2) recon = (val + b) & 0xff;
			else if (f === 3) recon = (val + ((a + b) >> 1)) & 0xff;
			else if (f === 4) {
				const p = a + b - c;
				const pa = Math.abs(p - a);
				const pb = Math.abs(p - b);
				const pc = Math.abs(p - c);
				const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
				recon = (val + pr) & 0xff;
			}
			out[dst + x] = recon;
		}
	}
	return { width, height, bpp, data: out };
}

function pngStats(png: RgbaPng): { meanLuma: number; maxChannel: number } {
	let sum = 0;
	let maxChannel = 0;
	let n = 0;
	for (let y = 0; y < png.height; y += 2) {
		for (let x = 0; x < png.width; x += 2) {
			const i = (y * png.width + x) * png.bpp;
			const r = png.data[i];
			const g = png.data[i + 1];
			const b = png.data[i + 2];
			const l = (r + g + b) / 3;
			sum += l;
			if (r > maxChannel) maxChannel = r;
			if (g > maxChannel) maxChannel = g;
			if (b > maxChannel) maxChannel = b;
			n++;
		}
	}
	return { meanLuma: n ? sum / n : 0, maxChannel };
}

function pngMeanAbsDiff(a: RgbaPng, b: RgbaPng): number {
	if (a.width !== b.width || a.height !== b.height) {
		return Number.POSITIVE_INFINITY;
	}
	let sum = 0;
	let n = 0;
	for (let y = 0; y < a.height; y += 2) {
		for (let x = 0; x < a.width; x += 2) {
			const ia = (y * a.width + x) * a.bpp;
			const ib = (y * b.width + x) * b.bpp;
			sum += (Math.abs(a.data[ia] - b.data[ib]) + Math.abs(a.data[ia + 1] - b.data[ib + 1]) + Math.abs(a.data[ia + 2] - b.data[ib + 2])) / 3;
			n++;
		}
	}
	return n ? sum / n : 0;
}

type ArtState = {
	loaded: boolean;
	naturalWidth: number;
	naturalHeight: number;
	bgImage: string;
	bgSize: string;
	bgPosition: string;
	objectPosition: string;
	transform: string;
	billboardH: number;
	stageDocBox: { top: number; left: number; width: number; height: number };
	slotDocBox: { top: number; left: number; width: number; height: number };
	slotViewportVisiblePx: number;
};

async function measureArtState(page: Page, mode: "episode" | "home"): Promise<ArtState> {
	const raw = await page.evaluate((m) => {
		const billboard = document.querySelector<HTMLElement>(m === "episode" ? ".episode-billboard" : "section.billboard");
		const stage = document.querySelector<HTMLElement>(
			m === "episode" ? ".episode-backdrop" : ".billboard__stage.is-active",
		);
		const slot = document.querySelector<HTMLElement>(
			m === "episode" ? ".episode-backdrop__focus-slot" : ".billboard__stage.is-active .billboard__stage-focus-slot",
		);
		const focus = document.querySelector<HTMLElement>(
			m === "episode" ? ".episode-backdrop__focus" : ".billboard__stage.is-active .billboard__stage-focus",
		);
		if (!billboard || !stage || !slot || !focus) {
			throw new Error(`missing ${m} art nodes`);
		}
		const csFocus = getComputedStyle(focus);
		const bgMatch = /url\(["']?([^"')]+)["']?\)/.exec(csFocus.backgroundImage);
		const url = bgMatch?.[1] ?? "";
		const docBox = (el: HTMLElement) => {
			const r = el.getBoundingClientRect();
			return { top: r.top + window.scrollY, left: r.left + window.scrollX, width: r.width, height: r.height };
		};
		const sr = slot.getBoundingClientRect();
		const vh = window.innerHeight;
		const visTop = Math.max(sr.top, 0);
		const visBot = Math.min(sr.bottom, vh);
		return {
			url,
			bgImage: csFocus.backgroundImage,
			bgSize: csFocus.backgroundSize,
			bgPosition: csFocus.backgroundPosition,
			objectPosition: csFocus.objectPosition,
			transform: getComputedStyle(focus.parentElement ?? focus).transform,
			billboardH: billboard.getBoundingClientRect().height,
			stageDocBox: docBox(stage),
			slotDocBox: docBox(slot),
			slotViewportVisiblePx: Math.max(0, visBot - visTop),
			visibleStyle: csFocus.visibility !== "hidden" && csFocus.display !== "none" && Number.parseFloat(csFocus.opacity) > 0,
		};
	}, mode);

	const imgInfo = await page.evaluate(async (url) => {
		if (!url) return { complete: false, naturalWidth: 0, naturalHeight: 0 };
		const img = new Image();
		img.src = url;
		if (!img.complete) {
			await new Promise<void>((resolve) => {
				img.onload = () => resolve();
				img.onerror = () => resolve();
			});
		}
		return { complete: img.complete, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight };
	}, raw.url);

	return {
		loaded: raw.visibleStyle && imgInfo.complete && imgInfo.naturalWidth > 0,
		naturalWidth: imgInfo.naturalWidth,
		naturalHeight: imgInfo.naturalHeight,
		bgImage: raw.bgImage,
		bgSize: raw.bgSize,
		bgPosition: raw.bgPosition,
		objectPosition: raw.objectPosition,
		transform: raw.transform,
		billboardH: raw.billboardH,
		stageDocBox: raw.stageDocBox,
		slotDocBox: raw.slotDocBox,
		slotViewportVisiblePx: raw.slotViewportVisiblePx,
	};
}

function expectSameBox(
	before: { top: number; left: number; width: number; height: number },
	after: { top: number; left: number; width: number; height: number },
	label: string,
) {
	expect(Math.abs(after.top - before.top), `${label} top shifted: ${before.top} -> ${after.top}`).toBeLessThanOrEqual(1);
	expect(Math.abs(after.left - before.left), `${label} left shifted: ${before.left} -> ${after.left}`).toBeLessThanOrEqual(1);
	expect(Math.abs(after.width - before.width), `${label} width resized: ${before.width} -> ${after.width}`).toBeLessThanOrEqual(1);
	expect(Math.abs(after.height - before.height), `${label} height resized: ${before.height} -> ${after.height}`).toBeLessThanOrEqual(1);
}

async function waitFontsAndArt(page: Page, mode: "episode" | "home" = "episode"): Promise<void> {
	await page.evaluate(() => document.fonts.ready);
	await page.waitForFunction((m) => {
		const billboard = document.querySelector(m === "episode" ? ".episode-billboard" : "section.billboard");
		const art = document.querySelector<HTMLElement>(m === "episode" ? ".episode-backdrop" : ".billboard__stage.is-active");
		if (!billboard || !art) return false;
		if (!billboard.classList.contains("has-art-aspect")) return false;
		return art.getBoundingClientRect().height > 300;
	}, mode, { timeout: 10_000 });
}

/** Boxes and the last actually-painted description line (ignores overflow:hidden tails). */
async function scrollToggleIntoViewMinimally(page: Page, toggleSel: string): Promise<void> {
	await page.evaluate((sel) => {
		const btn = document.querySelector<HTMLElement>(sel);
		if (!btn) return;
		const r = btn.getBoundingClientRect();
		const margin = 24;
		if (r.bottom > window.innerHeight - margin) {
			window.scrollBy(0, r.bottom - (window.innerHeight - margin));
		}
	}, toggleSel);
}

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
	test("episode page 1160x800: expanding & collapsing keeps text/chevron on screen AND keeps the hero art painted and unchanged in size/position", async ({ page }) => {
		await page.setViewportSize(VP_1160);
		await openItem(page, criticismSearch);
		await waitFontsAndArt(page, "episode");
		await expect(itemToggle(page)).toBeVisible();
		const artBefore = await measureArtState(page, "episode");
		expect(artBefore.loaded, "episode art must be loaded (complete, naturalWidth > 0)").toBe(true);
		expect(artBefore.slotViewportVisiblePx, "collapsed art must be visible on screen").toBeGreaterThan(200);
		if (shots) await page.screenshot({ path: `${shots}/real-ep-criticism-1160-collapsed.png` });

		const beforeClip = { x: 180, y: 80, width: 800, height: 220 };
		const beforeStats = pngStats(decodePng(await page.screenshot({ clip: beforeClip })));
		expect(beforeStats.maxChannel, `collapsed art region is flat black: ${JSON.stringify(beforeStats)}`).toBeGreaterThan(40);
		expect(beforeStats.meanLuma, `collapsed art region is too dark: ${JSON.stringify(beforeStats)}`).toBeGreaterThan(18);

		await scrollToggleIntoViewMinimally(page, "app-hero-description button.hero-desc__toggle");
		await itemToggle(page).click();
		await expect(itemDesc(page)).toHaveClass(/is-expanded/);
		if (shots) await page.screenshot({ path: `${shots}/real-ep-criticism-1160-expanded.png` });
		const g = await expandGeometry(page, "app-hero-description .hero-desc__text", "app-hero-description button.hero-desc__toggle");
		const artAfter = await measureArtState(page, "episode");

		expect(g.toggle?.inView, `expanded chevron is off-screen (toggle=${JSON.stringify(g.toggle)}, scrollY=${g.scrollY})`).toBe(true);
		expect(g.lastLineInView, `expanded description is cut off at the viewport (lastLine=${JSON.stringify(g.lastLine)}, vh=${g.vh})`).toBe(true);
		expect(g.descInCard, `description overflows the episode card ${JSON.stringify(g)}`).toBe(true);
		expect(g.toggleInCard, "chevron overflows the episode card").toBe(true);

		expect(artAfter.slotViewportVisiblePx, `expanded viewport lost the artwork (visible=${artAfter.slotViewportVisiblePx}px, scrollY=${g.scrollY})`).toBeGreaterThan(200);
		const expandedClip = { x: 180, y: 80, width: 800, height: 220 };
		const afterStats = pngStats(decodePng(await page.screenshot({ clip: expandedClip })));
		expect(afterStats.maxChannel, `expanded art region is flat black: ${JSON.stringify(afterStats)}`).toBeGreaterThan(40);
		expect(afterStats.meanLuma, `expanded art region is too dark: ${JSON.stringify(afterStats)}`).toBeGreaterThan(18);
		expect(Math.abs(artAfter.billboardH - artBefore.billboardH), `episode billboard resized on expand: ${artBefore.billboardH} -> ${artAfter.billboardH}`).toBeLessThanOrEqual(1);
		expectSameBox(artBefore.stageDocBox, artAfter.stageDocBox, "episode backdrop (1160)");
		expectSameBox(artBefore.slotDocBox, artAfter.slotDocBox, "episode focus-slot (1160)");
		expect(artAfter.bgSize).toBe(artBefore.bgSize);
		expect(artAfter.bgPosition).toBe(artBefore.bgPosition);
		expect(artAfter.objectPosition).toBe(artBefore.objectPosition);

		await itemToggle(page).click();
		await expect(itemDesc(page)).not.toHaveClass(/is-expanded/);
		const artCollapsedAgain = await measureArtState(page, "episode");
		expect(Math.abs(artCollapsedAgain.billboardH - artBefore.billboardH)).toBeLessThanOrEqual(1);
		expectSameBox(artBefore.stageDocBox, artCollapsedAgain.stageDocBox, "episode backdrop collapse (1160)");
		expectSameBox(artBefore.slotDocBox, artCollapsedAgain.slotDocBox, "episode focus-slot collapse (1160)");
		expect(artCollapsedAgain.bgSize).toBe(artBefore.bgSize);
		expect(artCollapsedAgain.bgPosition).toBe(artBefore.bgPosition);
		expect(artCollapsedAgain.objectPosition).toBe(artBefore.objectPosition);
	});

	test("episode page 1440x900: expanding keeps text/chevron in card AND keeps the hero art identical in size, framing and pixels", async ({ page }) => {
		await page.setViewportSize(VP_1440);
		await openItem(page, criticismSearch);
		await waitFontsAndArt(page, "episode");
		await expect(itemToggle(page)).toBeVisible();
		const artBefore = await measureArtState(page, "episode");
		expect(artBefore.loaded, "episode art must be loaded (complete, naturalWidth > 0)").toBe(true);
		if (shots) await page.screenshot({ path: `${shots}/real-ep-criticism-1440-collapsed.png` });

		const rightArtClip = { x: 790, y: 90, width: 620, height: 620 };
		const beforePng = decodePng(await page.screenshot({ clip: rightArtClip }));
		const beforeStats = pngStats(beforePng);
		expect(beforeStats.maxChannel, `collapsed 1440 art region is flat black: ${JSON.stringify(beforeStats)}`).toBeGreaterThan(40);

		await itemToggle(page).click();
		await expect(itemDesc(page)).toHaveClass(/is-expanded/);
		if (shots) await page.screenshot({ path: `${shots}/real-ep-criticism-1440-expanded.png` });
		const g = await expandGeometry(page, "app-hero-description .hero-desc__text", "app-hero-description button.hero-desc__toggle");
		const artAfter = await measureArtState(page, "episode");

		expect(g.hasBefore, "wide episode page should paint the ::before card").toBe(true);
		expect(g.toggle?.inView, `expanded chevron is off-screen (toggle=${JSON.stringify(g.toggle)}, scrollY=${g.scrollY}, vh=${g.vh})`).toBe(true);
		expect(g.lastLineInView, `expanded description is cut off at the viewport (lastLine=${JSON.stringify(g.lastLine)}, vh=${g.vh})`).toBe(true);
		expect(g.descInCard, `description overflows the painted card ${JSON.stringify(g)}`).toBe(true);
		expect(g.toggleInCard, "chevron overflows the painted card").toBe(true);
		expect(g.lastLineInCard, "last painted line of the description sits outside the painted card").toBe(true);

		expect(Math.abs(artAfter.billboardH - artBefore.billboardH), `episode billboard resized on expand: ${artBefore.billboardH} -> ${artAfter.billboardH}`).toBeLessThanOrEqual(1);
		expectSameBox(artBefore.stageDocBox, artAfter.stageDocBox, "episode backdrop (1440)");
		expectSameBox(artBefore.slotDocBox, artAfter.slotDocBox, "episode focus-slot (1440)");
		expect(artAfter.bgSize).toBe(artBefore.bgSize);
		expect(artAfter.bgPosition).toBe(artBefore.bgPosition);
		expect(artAfter.objectPosition).toBe(artBefore.objectPosition);
		const afterPng = decodePng(await page.screenshot({ clip: rightArtClip }));
		const diff = pngMeanAbsDiff(beforePng, afterPng);
		expect(diff, `1440 right-side artwork pixels changed/re-cropped on expand (meanAbsDiff=${diff.toFixed(2)})`).toBeLessThanOrEqual(2);

		await itemToggle(page).click();
		await expect(itemDesc(page)).not.toHaveClass(/is-expanded/);
		const artCollapsedAgain = await measureArtState(page, "episode");
		expect(Math.abs(artCollapsedAgain.billboardH - artBefore.billboardH)).toBeLessThanOrEqual(1);
		expectSameBox(artBefore.stageDocBox, artCollapsedAgain.stageDocBox, "episode backdrop collapse (1440)");
		expectSameBox(artBefore.slotDocBox, artCollapsedAgain.slotDocBox, "episode focus-slot collapse (1440)");
		expect(artCollapsedAgain.bgSize).toBe(artBefore.bgSize);
		expect(artCollapsedAgain.bgPosition).toBe(artBefore.bgPosition);
		expect(artCollapsedAgain.objectPosition).toBe(artBefore.objectPosition);
		const collapsedAgainPng = decodePng(await page.screenshot({ clip: rightArtClip }));
		expect(pngMeanAbsDiff(beforePng, collapsedAgainPng), "1440 right-side pixels differed after collapse").toBeLessThanOrEqual(2);
	});

	test("homepage 1440x900 & 1160x800: expanding the criticism episode keeps the hero art identical in size, framing and pixels", async ({ page }) => {
		await page.setViewportSize(VP_1440);
		await goHome(page);
		await waitFontsAndArt(page, "home");
		await showHomeSlide(page, /When Criticism Becomes a Spiritual Threat/i);
		await waitFontsAndArt(page, "home");
		await expect(homeToggle(page)).toBeVisible();
		const home1440Before = await measureArtState(page, "home");
		expect(home1440Before.loaded).toBe(true);
		if (shots) await page.screenshot({ path: `${shots}/real-home-criticism-1440-collapsed.png` });
		const homeRightClip = { x: 790, y: 90, width: 620, height: 580 };
		const homeBeforePng = decodePng(await page.screenshot({ clip: homeRightClip }));
		await homeToggle(page).click();
		await expect(homeDesc(page)).toHaveClass(/is-expanded/);
		if (shots) await page.screenshot({ path: `${shots}/real-home-criticism-1440-expanded.png` });
		const home1440After = await measureArtState(page, "home");
		expect(Math.abs(home1440After.billboardH - home1440Before.billboardH)).toBeLessThanOrEqual(1);
		expectSameBox(home1440Before.stageDocBox, home1440After.stageDocBox, "home stage (1440)");
		expectSameBox(home1440Before.slotDocBox, home1440After.slotDocBox, "home focus-slot (1440)");
		expect(home1440After.bgSize).toBe(home1440Before.bgSize);
		expect(home1440After.bgPosition).toBe(home1440Before.bgPosition);
		expect(home1440After.objectPosition).toBe(home1440Before.objectPosition);
		const homeAfterPng = decodePng(await page.screenshot({ clip: homeRightClip }));
		expect(pngMeanAbsDiff(homeBeforePng, homeAfterPng)).toBeLessThanOrEqual(2);

		await page.setViewportSize(VP_1160);
		await goHome(page);
		await waitFontsAndArt(page, "home");
		await showHomeSlide(page, /When Criticism Becomes a Spiritual Threat/i);
		await waitFontsAndArt(page, "home");
		await expect(homeToggle(page)).toBeVisible();
		const home1160Before = await measureArtState(page, "home");
		expect(home1160Before.loaded).toBe(true);
		expect(home1160Before.slotViewportVisiblePx).toBeGreaterThan(200);
		if (shots) await page.screenshot({ path: `${shots}/real-home-criticism-1160-collapsed.png` });
		const home1160StatsBefore = pngStats(decodePng(await page.screenshot({ clip: { x: 180, y: 80, width: 800, height: 220 } })));
		expect(home1160StatsBefore.maxChannel).toBeGreaterThan(40);
		expect(home1160StatsBefore.meanLuma).toBeGreaterThan(18);
		await scrollToggleIntoViewMinimally(page, "button.billboard__desc-toggle");
		await homeToggle(page).click();
		await expect(homeDesc(page)).toHaveClass(/is-expanded/);
		if (shots) await page.screenshot({ path: `${shots}/real-home-criticism-1160-expanded.png` });
		const home1160After = await measureArtState(page, "home");
		expect(home1160After.slotViewportVisiblePx).toBeGreaterThan(200);
		const home1160StatsAfter = pngStats(decodePng(await page.screenshot({ clip: { x: 180, y: 80, width: 800, height: 220 } })));
		expect(home1160StatsAfter.maxChannel).toBeGreaterThan(40);
		expect(home1160StatsAfter.meanLuma).toBeGreaterThan(18);
		expect(Math.abs(home1160After.billboardH - home1160Before.billboardH)).toBeLessThanOrEqual(1);
		expectSameBox(home1160Before.stageDocBox, home1160After.stageDocBox, "home stage (1160)");
		expectSameBox(home1160Before.slotDocBox, home1160After.slotDocBox, "home focus-slot (1160)");
		expect(home1160After.bgSize).toBe(home1160Before.bgSize);
		expect(home1160After.bgPosition).toBe(home1160Before.bgPosition);
		expect(home1160After.objectPosition).toBe(home1160Before.objectPosition);
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
