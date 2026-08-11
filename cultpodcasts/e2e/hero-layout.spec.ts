import { test, expect, type Page } from "@playwright/test";
import { buildHeroLayoutDocument } from "./hero-layout/build-harness";
import { heroLayoutCases, type HeroLayoutCaseId } from "./hero-layout/fixtures";

/**
 * Geometry e2e for homepage-hero layout contracts (HERO-SCR-* / HERO-SUB-*).
 * Compiles real homepage-hero.component.sass into a light-DOM harness so media
 * queries and min-heights match production CSS without bootstrapping Angular.
 *
 * Viewport matrix covers stacked (≤1280) and wide (≥1280) layouts plus a
 * landscape aspect ratio. Episode fixtures cover empty desc and many subjects.
 */

const viewports = [
  { name: "mobile", width: 390, height: 844, layout: "stacked" as const },
  { name: "mobile-landscape", width: 844, height: 390, layout: "stacked" as const },
  { name: "tablet", width: 768, height: 1024, layout: "stacked" as const },
  { name: "stacked-desktop", width: 1100, height: 800, layout: "stacked" as const },
  /** min-width:1280 — docked card; copy-body/desc min-height reset to 0 */
  { name: "wide", width: 1440, height: 900, layout: "wide" as const },
  /** Common full-screen desktop (matches primary authoring display). */
  { name: "full-hd", width: 1920, height: 1080, layout: "wide" as const },
] as const;

/** Short title must not leave ~2 empty title lines above meta. */
const MAX_TITLE_TO_META_GAP_PX = 36;
/** Empty desc+subjects: meta should sit near Watch (feature gap only). */
const MAX_META_TO_ACTIONS_GAP_PX_EMPTY = 48;
/** Stacked only: .has-desc reserves roughly 3 desc lines + chip band. */
const MIN_COPY_BODY_HAS_DESC_STACKED_PX = 70;
const MANY_SUBJECT_COUNT = 12;

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

/** Every chip has a non-zero box and sits above the actions block (HERO-SUB-001/002). */
async function assertAllSubjectsVisibleAboveActions(
  page: Page,
  expectedCount: number
): Promise<void> {
  const chips = page.locator(".billboard__subjects .hero-layout-chip");
  await expect(chips).toHaveCount(expectedCount);

  const report = await page.evaluate(() => {
    const subjects = document.querySelector(".billboard__subjects");
    const actions = document.querySelector(".billboard__actions");
    const chipEls = [...document.querySelectorAll(".billboard__subjects .hero-layout-chip")];
    if (!subjects || !actions) {
      return { ok: false, reason: "missing subjects or actions" };
    }
    const subjectsBox = subjects.getBoundingClientRect();
    const actionsBox = actions.getBoundingClientRect();
    if (actionsBox.top + 0.5 < subjectsBox.bottom) {
      return {
        ok: false,
        reason: `actions overlap/above subjects (actions.top=${actionsBox.top}, subjects.bottom=${subjectsBox.bottom})`,
      };
    }
    for (const el of chipEls) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) {
        return { ok: false, reason: `chip not visible: ${el.textContent}` };
      }
      if (r.bottom > actionsBox.top + 0.5) {
        return {
          ok: false,
          reason: `chip intersects actions: ${el.textContent}`,
        };
      }
    }
    return { ok: true, reason: "" };
  });

  expect(report.ok, report.reason).toBe(true);
}

for (const vp of viewports) {
  test.describe(`hero layout @ ${vp.name} (${vp.width}x${vp.height}, ${vp.layout})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("HERO-SCR-005: short title keeps meta tight under the title", async ({ page }) => {
      await openCase(page, "short-title-no-desc");
      const gap = await gapBelow(page, ".billboard__title", ".hero-meta");
      expect(gap, `title→meta gap was ${gap}px`).toBeLessThanOrEqual(MAX_TITLE_TO_META_GAP_PX);
      expect(gap).toBeGreaterThanOrEqual(0);
    });

    test("HERO-SCR-004: no description and no subjects omits blank band above Watch", async ({
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

    test("HERO-SCR-002: has-desc copy-body height (stacked reserve / wide hug)", async ({
      page,
    }) => {
      await openCase(page, "short-title-with-desc");
      const body = page.locator(".billboard__copy-body.has-desc");
      await expect(body).toHaveCount(1);
      const box = await body.boundingBox();
      const height = box?.height ?? 0;
      if (vp.layout === "stacked") {
        expect(height).toBeGreaterThanOrEqual(MIN_COPY_BODY_HAS_DESC_STACKED_PX);
      } else {
        // Wide resets min-height to 0 — short desc may hug; still must be non-empty.
        expect(height).toBeGreaterThan(20);
      }
    });

    test("HERO-SCR-004 + HERO-SUB-002: empty desc with few subjects keeps actions below chips", async ({
      page,
    }) => {
      await openCase(page, "empty-desc-with-subjects");
      await expect(page.locator(".billboard__desc")).toHaveCount(0);
      await expect(page.locator(".billboard__copy-body.has-desc")).toHaveCount(0);
      await assertAllSubjectsVisibleAboveActions(page, 3);
    });

    test("HERO-SUB-001/002: many subjects with description all render above Watch", async ({
      page,
    }) => {
      await openCase(page, "many-subjects-with-desc");
      await expect(page.locator(".billboard__desc")).toHaveCount(1);
      await assertAllSubjectsVisibleAboveActions(page, MANY_SUBJECT_COUNT);
    });

    test("HERO-SUB-001/002 + HERO-SCR-004: many subjects without description all render above Watch", async ({
      page,
    }) => {
      await openCase(page, "many-subjects-no-desc");
      await expect(page.locator(".billboard__desc")).toHaveCount(0);
      await expect(page.locator(".billboard__copy-body.has-desc")).toHaveCount(0);
      await assertAllSubjectsVisibleAboveActions(page, MANY_SUBJECT_COUNT);
    });

    test("HERO-SCR-005: long title still places meta below the title box", async ({ page }) => {
      await openCase(page, "long-title-with-desc");
      const gap = await gapBelow(page, ".billboard__title", ".hero-meta");
      expect(gap).toBeGreaterThanOrEqual(0);
      expect(gap).toBeLessThanOrEqual(MAX_TITLE_TO_META_GAP_PX);
    });

    if (vp.name === "stacked-desktop") {
      test("HERO-CTL-004: pager sits over the framed art band (not below the fold)", async ({
        page,
      }) => {
        await openCase(page, "short-title-with-desc");
        const report = await page.evaluate(() => {
          const stages = document.querySelector(".billboard__stages")?.getBoundingClientRect();
          const controls = document.querySelector(".billboard__controls")?.getBoundingClientRect();
          if (!stages || !controls) {
            return { ok: false, reason: "missing stages or controls" };
          }
          const overlapsArt =
            controls.bottom > stages.top + 4 && controls.top < stages.bottom - 4;
          const inViewport = controls.top >= 0 && controls.bottom <= window.innerHeight;
          if (!overlapsArt) {
            return {
              ok: false,
              reason: `controls not over art (controls.top=${controls.top}, stages.bottom=${stages.bottom})`,
            };
          }
          if (!inViewport) {
            return {
              ok: false,
              reason: `controls off-screen (top=${controls.top}, bottom=${controls.bottom}, vh=${window.innerHeight})`,
            };
          }
          return { ok: true, reason: "" };
        });
        expect(report.ok, report.reason).toBe(true);
      });
    }
  });
}
