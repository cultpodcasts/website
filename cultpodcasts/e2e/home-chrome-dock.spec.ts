import { expect, test, type Page } from "@playwright/test";
import { catalogueE2eOrigin as appOrigin } from "./catalogue-origin";

/**
 * CHROME-DOCK-012: on the wide homepage the frosted (docked) header must not
 * flip dark → transparent → dark while scrolling across the dock line.
 * Real app (ng serve) with a faked /homepage; made-up episodes only.
 *
 * The rendered toolbar is taller than --site-chrome-bar-h, which used to put the
 * dock and undock lines a few px apart in opposite directions so every frame in
 * between toggled `chrome-stuck`.
 */

const PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
	"base64"
);

function homepage() {
	const now = Date.now();
	const recentEpisodes = Array.from({ length: 4 }, (_, i) => ({
		id: `00000000-0000-4000-8000-00000000001${i}`,
		podcastName: `Invented Show ${i}`,
		episodeTitle: `Invented episode ${i}`,
		episodeDescription: "Synthetic description.",
		release: new Date(now - (i + 1) * 3_600_000).toISOString(),
		duration: "01:00:00",
		services: { youtube: { url: `https://www.youtube.com/watch?v=synthetic${i}` } },
		ids: { youtube: `synthetic${i}` },
		subjects: ["Invented subject"],
		image: `https://img.example.test/dock-${i}.png`
	}));
	return { recentEpisodes, episodeCount: recentEpisodes.length, totalDuration: "4:00:00" };
}

async function fakeApi(page: Page): Promise<void> {
	await page.route("**/*", async (route) => {
		const url = route.request().url();
		if (url.startsWith(appOrigin)) {
			await route.continue();
			return;
		}
		if (url.includes("img.example.test")) {
			await route.fulfill({ status: 200, contentType: "image/png", body: PNG });
			return;
		}
		if (new URL(url).pathname === "/homepage") {
			await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(homepage()) });
			return;
		}
		await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
	});
}

test("CHROME-DOCK-012: docked header state holds frame after frame across the dock line (fractional scrollY)", async ({ page }) => {
	// ~240 scroll positions × 6 rAFs; needs headroom when the catalogue suite is under load.
	test.setTimeout(60_000);
	await page.setViewportSize({ width: 1440, height: 900 });
	await fakeApi(page);
	await page.goto("/");
	await expect(page.locator(".billboard")).toBeVisible();
	await page.waitForTimeout(500);

	const report = await page.evaluate(async () => {
		const body = document.querySelector("#body")!;
		const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
		const positions: number[] = [];
		for (let y = 50; y <= 80; y += 0.25) positions.push(y);
		for (let y = 80; y >= 50; y -= 0.25) positions.push(y);
		const flips: string[] = [];
		let dockedAt: number | null = null;
		for (const y of positions) {
			window.scrollTo(0, y);
			const states: number[] = [];
			for (let f = 0; f < 6; f++) {
				await frame();
				states.push(body.classList.contains("chrome-stuck") ? 1 : 0);
				// Extra scroll events at the same position = repeated syncs.
				window.dispatchEvent(new Event("scroll"));
			}
			const settled = states.slice(1);
			if (new Set(settled).size > 1) {
				flips.push(`${window.scrollY}:${states.join("")}`);
			}
			if (dockedAt === null && settled[settled.length - 1] === 1) {
				dockedAt = window.scrollY;
			}
		}
		return { flips, dockedAt, finalStuck: body.classList.contains("chrome-stuck") };
	});

	expect(report.flips, report.flips.join(" ")).toEqual([]);
	expect(report.dockedAt).not.toBeNull();
	// Docks at the sticky catch line (65px for the 58px bar + 12px gap), not earlier.
	expect(report.dockedAt!).toBeGreaterThanOrEqual(60);
	expect(report.dockedAt!).toBeLessThanOrEqual(66);
	expect(report.finalStuck).toBe(false);
});
