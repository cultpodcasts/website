import { test, expect, type Page } from "@playwright/test";
import { buildChromeSearchLayoutDocument } from "./chrome-search-layout/build-harness";

/**
 * CHROME-HIT-001: the home overlay field must remain the topmost hit at its
 * centre while scrolling (not tucked under the fixed logo bar). Previous
 * checks used computed visibility/opacity, which stay "visible" when the bar
 * paints over the field.
 *
 * Compiles real app.component.sass into a light-DOM harness (no Angular).
 */

type HitReport = {
  ok: boolean;
  reason: string;
  hit: string | null;
  visibility?: string;
  opacity?: string;
  slotZIndex?: string | null;
  position?: string;
  width: number;
  top: number;
  stuck: boolean;
  scrollY: number;
};

async function openHarness(page: Page, shell: "home" | "browse" = "home"): Promise<void> {
  await page.setContent(buildChromeSearchLayoutDocument(shell), { waitUntil: "domcontentloaded" });
}

async function hit(page: Page): Promise<HitReport> {
  return page.evaluate(() => (window as unknown as { __chromeSearchHit: () => HitReport }).__chromeSearchHit());
}

test.describe("home chrome search overlay (CHROME-HIT-001)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("CHROME-HIT-001: search stays hittable and 640px-class width through dock and undock", async ({ page }) => {
    await openHarness(page);

    const rest = await hit(page);
    expect(rest.ok, `rest: ${JSON.stringify(rest)}`).toBe(true);
    expect(rest.stuck).toBe(false);
    expect(rest.position).toBe("sticky");
    expect(rest.slotZIndex).toBe("auto");
    expect(rest.width).toBeLessThanOrEqual(660);
    expect(rest.width).toBeGreaterThanOrEqual(480);

    const failures: HitReport[] = [];
    let prevTop = rest.top;
    for (let y = 0; y <= 240; y += 4) {
      await page.evaluate((sy) => window.scrollTo(0, sy), y);
      await page.evaluate(() => (window as unknown as { __chromeSearchSync: () => void }).__chromeSearchSync());
      const report = await hit(page);
      const jump = report.top - prevTop;
      // 4px scroll steps: top should ease up or hold — not teleport into the bar.
      if (!report.ok || report.width > 700 || jump > 3 || jump < -10) {
        failures.push({ ...report, reason: `${report.reason} jump=${jump}` });
      }
      prevTop = report.top;
    }
    expect(failures, failures.map((f) => JSON.stringify(f)).join("\n")).toEqual([]);

    await page.evaluate(() => window.scrollTo(0, 180));
    await page.evaluate(() => (window as unknown as { __chromeSearchSync: () => void }).__chromeSearchSync());
    const mid = await hit(page);
    expect(mid.ok, `mid: ${JSON.stringify(mid)}`).toBe(true);
    expect(mid.stuck).toBe(true);
    expect(mid.position).toBe("fixed");
    expect(mid.hit).not.toBe("app-toolbar");
    expect(mid.slotZIndex).toBe("auto");
    expect(mid.width).toBeLessThanOrEqual(660);
    expect(Math.abs(mid.width - rest.width)).toBeLessThanOrEqual(24);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(() => (window as unknown as { __chromeSearchSync: () => void }).__chromeSearchSync());
    const top = await hit(page);
    expect(top.ok, `top: ${JSON.stringify(top)}`).toBe(true);
    expect(top.stuck).toBe(false);
    expect(top.width).toBeLessThanOrEqual(660);
  });

  test("CHROME-HIT-001: a single jump past the bar still leaves the field hittable", async ({ page }) => {
    await openHarness(page);
    await page.evaluate(() => window.scrollTo(0, 96));
    await page.evaluate(() => (window as unknown as { __chromeSearchSync: () => void }).__chromeSearchSync());
    const report = await hit(page);
    expect(report.ok, JSON.stringify(report)).toBe(true);
    expect(report.stuck).toBe(true);
    expect(report.width).toBeLessThanOrEqual(660);
  });
});

test.describe("browse chrome search (CHROME-HIT-002)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("CHROME-HIT-002: wide browse/podcast search is the same 640px pin, not the logo↔actions gap", async ({ page }) => {
    await openHarness(page, "browse");
    const report = await hit(page);
    expect(report.ok, JSON.stringify(report)).toBe(true);
    expect(report.stuck).toBe(true);
    expect(report.position).toBe("fixed");
    expect(report.width).toBeLessThanOrEqual(660);
    expect(report.width).toBeGreaterThanOrEqual(480);
    expect(report.top).toBeLessThan(40);
    expect(report.hit).not.toBe("app-toolbar");
  });
});

test.describe("narrow chrome search slot (CHROME-HIT-003)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("CHROME-HIT-003: narrow home slot collapses so the hero sits under the bar", async ({ page }) => {
    await openHarness(page);
    await page.evaluate(() => {
      document.getElementById("body")?.classList.add("chrome-stuck");
      document.getElementById("chromeSearch")?.classList.add("chrome-search--docked");
    });
    const geometry = await page.evaluate(() => {
      const bar = document.getElementById("chromeBar")?.getBoundingClientRect();
      const slot = document.querySelector(".chrome-search-slot")?.getBoundingClientRect();
      const nflx = document.querySelector(".nflx")?.getBoundingClientRect();
      return {
        slotH: slot ? Math.round(slot.height) : -1,
        nflxTop: nflx ? Math.round(nflx.top) : -1,
        barBottom: bar ? Math.round(bar.bottom) : -1
      };
    });
    expect(geometry.slotH, JSON.stringify(geometry)).toBeLessThanOrEqual(1);
    expect(geometry.nflxTop, JSON.stringify(geometry)).toBeLessThanOrEqual(1);
  });
});
