import { test, expect, type Page } from "@playwright/test";
import { buildHeroLayoutDocument } from "./hero-layout/build-harness";
import { heroLayoutCases, type HeroLayoutCaseId } from "./hero-layout/fixtures";

/**
 * Geometry e2e for homepage-hero layout contracts (HERO-SCR-*).
 * Compiles real homepage-hero.component.sass into a light-DOM harness so media
 * queries and min-heights match production CSS without bootstrapping Angular.
 */

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "stacked-desktop", width: 1100, height: 800 },
] as const;

/** Short title must not leave ~2 empty title lines above meta (was min-height: 3em). */
const MAX_TITLE_TO_META_GAP_PX = 36;
/** Empty desc+subjects: meta should sit near Watch (feature gap only). */
const MAX_META_TO_ACTIONS_GAP_PX_EMPTY = 48;
/** With .has-desc, copy-body must reserve roughly 3 desc lines + chip band. */
const MIN_COPY_BODY_HAS_DESC_PX = 70;

async function openCase(page: Page, caseId: HeroLayoutCaseId): Promise<void> {
  const c = heroLayoutCases.find((x) => x.id === caseId);
  if (!c) {
    throw new Error(`Unknown hero layout case: ${caseId}`);
  }
  await page.setContent(buildHeroLayoutDocument(c), { waitUntil: "domcontentloaded" });
}

async function gapBelow(page: Page, upper: string, lower: string): Promise<number> {
  return page.evaluate(
    ({ upperSel, lowerSel }) => {
      const a = document.querySelector(upperSel)?.getBoundingClientRect();
      const b = document.querySelector(lowerSel)?.getBoundingClientRect();
      if (!a || !b) {
        return Number.POSITIVE_INFINITY;
      }
      return b.top - a.bottom;
    },
    { upperSel: upper, lowerSel: lower }
  );
}

for (const vp of viewports) {
  test.describe(`hero layout @ ${vp.name} (${vp.width}x${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("HERO-SCR-005: short title keeps meta tight under the title", async ({ page }) => {
      await openCase(page, "short-title-no-desc");
      const gap = await gapBelow(page, ".billboard__title", ".hero-meta");
      expect(gap, `title→meta gap was ${gap}px`).toBeLessThanOrEqual(MAX_TITLE_TO_META_GAP_PX);
      expect(gap).toBeGreaterThanOrEqual(0);
    });

    test("HERO-SCR-004: empty description omits desc and blank band above Watch", async ({
      page,
    }) => {
      await openCase(page, "short-title-no-desc");
      await expect(page.locator(".billboard__desc")).toHaveCount(0);
      await expect(page.locator(".billboard__copy-body")).toHaveCount(0);
      const gap = await gapBelow(page, ".hero-meta", ".billboard__actions");
      expect(gap, `meta→actions gap was ${gap}px`).toBeLessThanOrEqual(
        MAX_META_TO_ACTIONS_GAP_PX_EMPTY
      );
    });

    test("HERO-SCR-002: has-desc reserves copy-body height for short description", async ({
      page,
    }) => {
      await openCase(page, "short-title-with-desc");
      const body = page.locator(".billboard__copy-body.has-desc");
      await expect(body).toHaveCount(1);
      const box = await body.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(MIN_COPY_BODY_HAS_DESC_PX);
    });

    test("HERO-SUB-002: subjects stay above Watch actions when desc is empty", async ({
      page,
    }) => {
      await openCase(page, "empty-desc-with-subjects");
      await expect(page.locator(".billboard__desc")).toHaveCount(0);
      await expect(page.locator(".billboard__copy-body.has-desc")).toHaveCount(0);
      await expect(page.locator(".billboard__subjects")).toHaveCount(1);
      const gap = await gapBelow(page, ".billboard__subjects", ".billboard__actions");
      expect(gap).toBeGreaterThanOrEqual(0);
      expect(gap).toBeLessThanOrEqual(40);
    });

    test("HERO-SCR-005: long title still places meta below the title box", async ({ page }) => {
      await openCase(page, "long-title-with-desc");
      const gap = await gapBelow(page, ".billboard__title", ".hero-meta");
      expect(gap).toBeGreaterThanOrEqual(0);
      expect(gap).toBeLessThanOrEqual(MAX_TITLE_TO_META_GAP_PX);
    });
  });
}
