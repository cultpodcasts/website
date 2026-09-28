import { expect, test } from "@playwright/test";
import { buildRailLayoutDocument } from "./rail-layout/build-harness";

/**
 * Homepage rail art boxes. A square cover has no wide image, so the tile must
 * be narrower until its 1:1 box matches the 16:9 still beside it. A tall bitmap
 * must not stretch the card.
 */
test.describe("homepage rail art height", () => {
	test("a portrait cover matches the wide still height", async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 800 });
		await page.setContent(buildRailLayoutDocument(), { waitUntil: "domcontentloaded" });

		const boxes = await page.evaluate(() => {
			const arts = [...document.querySelectorAll(".episode-poster__art")].map((el) => {
				const box = el.getBoundingClientRect();
				return { width: box.width, height: box.height };
			});
			const tiles = [...document.querySelectorAll(".rail-poster")].map((el) => el.getBoundingClientRect().width);
			return { arts, tiles };
		});

		expect(boxes.arts).toHaveLength(2);
		const [square, wide] = boxes.arts;
		expect(wide.width).toBeGreaterThan(square.width);
		expect(Math.abs(square.height - wide.height)).toBeLessThanOrEqual(1);
		expect(Math.abs(square.height / square.width - 1)).toBeLessThanOrEqual(0.02);
		expect(Math.abs(wide.width / wide.height - 16 / 9)).toBeLessThanOrEqual(0.02);
	});
});
