import { expect, test, type Page } from "@playwright/test";
import { catalogueE2eOrigin as appOrigin } from "./catalogue-origin";

/**
 * HERO-ART-001: the hero's art must paint at its final geometry on its very first frame.
 * Jon, 1 Nov 2026: on load the first image covered the whole hero, then snapped to the
 * right-hand slot once the preload had measured it. Real app (ng serve), faked /homepage,
 * slow image responses so the measure clearly lands after the art could have painted.
 * Made-up shows and titles only.
 */

// 16x9 and 1x1 dark PNGs, so both a YouTube-shaped and a square (podcast cover) art are checked.
const PNG_16_9 = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAABAAAAAJCAIAAAC0SDtlAAAAE0lEQVR4nGOQkJAhCTGMahgUGgDT9SrBp83iigAAAABJRU5ErkJggg==",
	"base64"
);
const PNG_1_1 = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAkAAAAJCAIAAABv85FHAAAAD0lEQVR42mNQwA0YhrkcAPUOHmFMBpcSAAAAAElFTkSuQmCC",
	"base64"
);
const IMAGE_DELAY_MS = 1_200;

function homepage() {
	const now = Date.now();
	const recentEpisodes = Array.from({ length: 2 }, (_, i) => ({
		id: `00000000-0000-4000-8000-00000000010${i + 1}`,
		podcastName: `Invented Show ${String.fromCharCode(65 + i)}`,
		episodeTitle: `Invented first-paint episode ${i + 1}`,
		episodeDescription: "Short synthetic description.",
		release: new Date(now - (i + 1) * 3_600_000).toISOString(),
		duration: "01:02:03",
		services: { youtube: { url: `https://www.youtube.com/watch?v=synthetic${i}` } },
		ids: { youtube: `synthetic${i}` },
		subjects: ["Invented subject"],
		image: `https://img.example.test/first-paint-${i}.png`
	}));
	return { recentEpisodes, episodeCount: recentEpisodes.length, totalDuration: "2:00:00" };
}

async function fakeApi(page: Page, png: Buffer): Promise<void> {
	await page.route("**/*", async (route) => {
		const url = route.request().url();
		if (url.startsWith(appOrigin)) {
			await route.continue();
			return;
		}
		if (url.includes("img.example.test") || route.request().resourceType() === "image") {
			await new Promise((resolve) => setTimeout(resolve, IMAGE_DELAY_MS));
			await route.fulfill({ status: 200, contentType: "image/png", body: png }).catch(() => undefined);
			return;
		}
		if (new URL(url).pathname === "/homepage") {
			await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(homepage()) });
			return;
		}
		await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
	});
}

type Paint = { edge: boolean; slotLeft: number; slotRight: number; slotW: number; heroLeft: number; heroRight: number; heroW: number };

/** Records every moment a stage's sharp art gets a background image, with its framing at that moment. */
async function recordArtPaints(page: Page): Promise<void> {
	await page.addInitScript(() => {
		const paints: unknown[] = [];
		(window as unknown as { heroArtPaints: unknown[] }).heroArtPaints = paints;
		const seen = new WeakMap<Element, string>();
		const check = (el: Element) => {
			if (!(el instanceof HTMLElement) || !el.classList.contains("billboard__stage-focus")) {
				return;
			}
			const bg = el.style.backgroundImage;
			if (!bg || seen.get(el) === bg) {
				return;
			}
			seen.set(el, bg);
			const host = el.closest(".billboard__stage")!;
			const hero = document.querySelector(".billboard")!.getBoundingClientRect();
			const slot = el.parentElement!.getBoundingClientRect();
			paints.push({
				edge: host.classList.contains("has-edge-extend"),
				slotLeft: slot.left, slotRight: slot.right, slotW: slot.width,
				heroLeft: hero.left, heroRight: hero.right, heroW: hero.width
			});
		};
		new MutationObserver((records) => {
			for (const r of records) {
				if (r.type === "attributes") {
					check(r.target as Element);
				}
				for (const node of r.addedNodes) {
					if (node instanceof Element) {
						check(node);
						node.querySelectorAll(".billboard__stage-focus").forEach(check);
					}
				}
			}
		}).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["style"] });
	});
}

const cases = [
	{ name: "16:9 art", png: PNG_16_9, minLeftFrac: 0.2 },
	{ name: "square art", png: PNG_1_1, minLeftFrac: 0.45 }
] as const;

test.describe("homepage hero art first paint (HERO-ART-001)", () => {
	for (const c of cases) {
		test(`wide 1920x1080, ${c.name}: the first painted frame is already in the right-hand slot`, async ({ page }) => {
			await page.setViewportSize({ width: 1920, height: 1080 });
			await recordArtPaints(page);
			await fakeApi(page, c.png);
			await page.goto("/");
			await expect(page.locator(".billboard__stage.is-active.has-edge-extend")).toHaveCount(1, { timeout: 30_000 });
			await expect.poll(() => page.evaluate(() => (window as unknown as { heroArtPaints: unknown[] }).heroArtPaints.length)).toBeGreaterThan(0);
			const paints = await page.evaluate(() => (window as unknown as { heroArtPaints: Paint[] }).heroArtPaints);
			const first = paints[0];
			// Before the fix the first paint had no contain framing and covered the whole hero.
			for (const p of paints) {
				expect(p.edge, `art painted before its aspect was known: ${JSON.stringify(p)}`).toBe(true);
			}
			expect(first.slotW).toBeLessThan(first.heroW * 0.85);
			expect(first.slotLeft - first.heroLeft).toBeGreaterThan(first.heroW * c.minLeftFrac);
			// Pinned right (Ken Burns may scale it a little past the edge).
			expect(Math.abs(first.slotRight - first.heroRight)).toBeLessThan(first.heroW * 0.05);
		});
	}
});
