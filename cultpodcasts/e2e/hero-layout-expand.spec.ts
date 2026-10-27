import { test, expect, type Page } from "@playwright/test";
import { buildHeroLayoutDocument } from "./hero-layout/build-harness";
import { heroLayoutCases, type HeroLayoutCaseId } from "./hero-layout/fixtures";
import { expectExpandedKeepsTop, heroExpandGeometry, stripTopPainters } from "./hero-expand-geometry";

async function openCase(page: Page, caseId: HeroLayoutCaseId): Promise<void> {
  const c = heroLayoutCases.find((x) => x.id === caseId);
  if (!c) {
    throw new Error(`Unknown hero layout case: ${caseId}`);
  }
  await page.setContent(buildHeroLayoutDocument(c), { waitUntil: "domcontentloaded" });
}

/**
 * Expanded description (HERO-DSC-002..005) on the harness: the very long show-notes fixture
 * (long unbroken URLs) expanded with the harness's mirror of HomepageHeroComponent.toggleDesc,
 * under a mock stats strip that compiles the real homepage-catalogue Sass.
 *
 * Headless Chromium hides scrollbars by default; these run with classic scrollbars shown, so the
 * "text clears the scrollbar" check measures a real scrollbar (the 16px gap also clears overlay
 * scrollbar thumbs, e.g. Windows Chrome). Set HERO_SCREENS_DIR to save screenshots.
 */
const expandViewports = [
  { name: "desktop-1024", width: 1024, height: 700 },
  { name: "desktop-1280", width: 1280, height: 800 },
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "desktop-1536", width: 1536, height: 864 },
  { name: "full-hd", width: 1920, height: 1080 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
] as const;

/** Must match the expanded `.billboard__desc` padding-right (HERO-DSC-003). */
const DESC_SCROLL_GAP_PX = 16;


/**
 * Text, scrollbar and chevron geometry of the expanded description at its current scroll offset.
 */
async function expandedDescReport(page: Page) {
  return page.evaluate(() => {
    const desc = document.querySelector<HTMLElement>(".billboard__desc")!;
    const toggle = document.querySelector<HTMLElement>(".billboard__desc-toggle")!;
    const box = desc.getBoundingClientRect();
    const cs = getComputedStyle(desc);
    const padRight = Number.parseFloat(cs.paddingRight) || 0;
    // Client box: inside the borders, left of a classic scrollbar.
    const clientLeft = box.left + desc.clientLeft;
    const clientRight = clientLeft + desc.clientWidth;
    const clientTop = box.top + desc.clientTop;
    const clientBottom = clientTop + desc.clientHeight;
    const range = document.createRange();
    range.selectNodeContents(desc);
    const lines = [...range.getClientRects()]
      .filter((r) => r.width > 0 && r.height > 0)
      // Only what shows inside the scroller (clipped to its client box).
      .map((r) => ({
        left: r.left,
        right: r.right,
        top: Math.max(r.top, clientTop),
        bottom: Math.min(r.bottom, clientBottom),
      }))
      .filter((r) => r.bottom - r.top > 0.5);
    const t = toggle.getBoundingClientRect();
    const hits = lines.filter(
      (r) => r.left < t.right && r.right > t.left && r.top < t.bottom && r.bottom > t.top
    );
    return {
      lineCount: lines.length,
      maxTextRight: Math.max(...lines.map((r) => r.right)),
      clientRight,
      boxRight: box.right,
      clientBottom,
      scrollbarW: desc.offsetWidth - desc.clientWidth - desc.clientLeft * 2,
      padRight,
      scrollWidth: desc.scrollWidth,
      clientWidth: desc.clientWidth,
      scrollHeight: desc.scrollHeight,
      toggle: { left: t.left, top: t.top, right: t.right, bottom: t.bottom },
      descBottom: box.bottom,
      chevronHits: hits.length,
    };
  });
}

// Classic scrollbars, so the scrollbar-clearance check measures a real one (file-level: a
// launch option forces its own worker).
test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

test.describe("hero expanded description (HERO-DSC-002..005)", () => {
  for (const vp of expandViewports) {
    test.describe(`@ ${vp.name} (${vp.width}x${vp.height})`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      for (const caseId of ["very-long-desc-with-urls", "medium-desc-with-urls", "medium-desc-tall-card"] as const) {
      test(`HERO-DSC-005 (${caseId}): expanding keeps the card top (it grows down, over the strip if need be); the art never covers the strip; collapse restores`, async ({
        page,
      }) => {
        await openCase(page, caseId);
        const toggle = page.locator(".billboard__desc-toggle");
        await expect(toggle).toHaveAttribute("aria-expanded", "false");
        if (process.env.HERO_SCREENS_DIR) {
          await page.screenshot({ path: `${process.env.HERO_SCREENS_DIR}/harness-${vp.name}-${caseId}-collapsed.png` });
        }
        const before = await heroExpandGeometry(page);
        const beforePainters = await stripTopPainters(page);
        await page.evaluate(() => window.scrollTo(0, 0));

        await toggle.click();
        await expect(toggle).toHaveAttribute("aria-expanded", "true");
        await expect(page.locator(".billboard")).toHaveClass(/is-desc-expanded/);
        // Measure first: a full-page screenshot resizes the viewport (and drops the scrollbar).
        const expanded = await heroExpandGeometry(page);
        const painters = await stripTopPainters(page);
        if (process.env.HERO_SCREENS_DIR) {
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.screenshot({ path: `${process.env.HERO_SCREENS_DIR}/harness-${vp.name}-${caseId}-expanded.png` });
          await page.screenshot({ path: `${process.env.HERO_SCREENS_DIR}/harness-${vp.name}-${caseId}-expanded-full.png`, fullPage: true });
        }
        expectExpandedKeepsTop(before, expanded, beforePainters, painters, vp.name);
        // The card really grew (the description expanded), within the 60vh cap.
        expect(expanded.cardBottom - expanded.cardTop).toBeGreaterThan(before.cardBottom - before.cardTop + 20);
        const descH = await page.locator(".billboard__desc").evaluate((d) => d.getBoundingClientRect().height);
        expect(descH).toBeLessThanOrEqual(vp.height * 0.6 + 1);

        await page.evaluate(() => window.scrollTo(0, 0));
        await toggle.click();
        await expect(toggle).toHaveAttribute("aria-expanded", "false");
        const collapsed = await heroExpandGeometry(page);
        for (const k of ["cardTop", "cardBottom", "stripTop"] as const) {
          expect(Math.abs(collapsed[k] - before[k]), `${k} after collapse`).toBeLessThanOrEqual(0.5);
        }
        for (let i = 0; i < 4; i++) {
          expect(Math.abs(collapsed.stages[i] - before.stages[i]), `art [${i}] after collapse`).toBeLessThanOrEqual(0.5);
          expect(Math.abs(collapsed.hero[i] - before.hero[i]), `hero [${i}] after collapse`).toBeLessThanOrEqual(0.5);
        }
        expect(await page.locator(".billboard__desc").evaluate((d) => d.scrollTop)).toBe(0);
      });
      }

      test("HERO-DSC-003: text clears the scrollbar, long URLs wrap, the chevron never covers text", async ({ page }) => {
        await openCase(page, "very-long-desc-with-urls");
        const desc = page.locator(".billboard__desc");
        // Collapsed: long URLs wrap inside the clamp too.
        const collapsedOverflow = await desc.evaluate((d) => d.scrollWidth - d.clientWidth);
        expect(collapsedOverflow).toBeLessThanOrEqual(0);

        await page.locator(".billboard__desc-toggle").click();
        await expect(desc).toHaveClass(/is-expanded/);
        // The fixture is long enough to scroll inside the expanded box.
        const { scrollHeight, clientHeight } = await desc.evaluate((d) => ({
          scrollHeight: d.scrollHeight,
          clientHeight: d.clientHeight,
        }));
        expect(scrollHeight).toBeGreaterThan(clientHeight + 40);

        for (const at of [0, 0.5, 1]) {
          await desc.evaluate((d, f) => {
            d.scrollTop = (d.scrollHeight - d.clientHeight) * f;
          }, at);
          const r = await expandedDescReport(page);
          const where = `scroll ${at}: ${JSON.stringify(r)}`;
          expect(r.lineCount, where).toBeGreaterThan(2);
          // A classic scrollbar is really there (launch option), right of the client box.
          expect(r.scrollbarW, where).toBeGreaterThan(0);
          // Text ends at least the padding left of the scrollbar.
          expect(r.padRight, where).toBeGreaterThanOrEqual(DESC_SCROLL_GAP_PX);
          expect(r.maxTextRight, where).toBeLessThanOrEqual(r.clientRight - DESC_SCROLL_GAP_PX + 0.5);
          // No horizontal overflow: long URLs wrap (overflow-wrap: anywhere).
          expect(r.scrollWidth, where).toBeLessThanOrEqual(r.clientWidth);
          // The chevron sits in its own band under the scroller: never over a text line.
          expect(r.chevronHits, where).toBe(0);
          expect(r.toggle.top, where).toBeGreaterThanOrEqual(r.descBottom - 0.5);
        }
        if (process.env.HERO_SCREENS_DIR) {
          await desc.evaluate((d) => {
            d.scrollTop = (d.scrollHeight - d.clientHeight) / 3;
          });
          await page.locator(".billboard__desc-wrap").screenshot({
            path: `${process.env.HERO_SCREENS_DIR}/harness-${vp.name}-expanded-desc-closeup.png`,
          });
        }
        // The page never scrolls sideways.
        const pageOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        expect(pageOverflow).toBeLessThanOrEqual(0);
      });
    });
  }
});
