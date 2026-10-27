import { test, expect, type Page } from "@playwright/test";
import { buildHeroLayoutDocument } from "./hero-layout/build-harness";
import { heroLayoutCases, type HeroLayoutCaseId } from "./hero-layout/fixtures";

async function openCase(page: Page, caseId: HeroLayoutCaseId): Promise<void> {
  const c = heroLayoutCases.find((x) => x.id === caseId);
  if (!c) {
    throw new Error(`Unknown hero layout case: ${caseId}`);
  }
  await page.setContent(buildHeroLayoutDocument(c), { waitUntil: "domcontentloaded" });
}

/**
 * Expanded description (HERO-DSC-002..004) on the harness: the very long show-notes fixture
 * (long unbroken URLs) expanded with the harness's mirror of HomepageHeroComponent.toggleDesc,
 * under a mock stats strip that compiles the real homepage-catalogue Sass.
 *
 * Headless Chromium hides scrollbars by default; these run with classic scrollbars shown, so the
 * "text clears the scrollbar" check measures a real scrollbar (the 16px gap also clears overlay
 * scrollbar thumbs, e.g. Windows Chrome). Set HERO_SCREENS_DIR to save screenshots.
 */
const expandViewports = [
  { name: "desktop-1024", width: 1024, height: 700 },
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "full-hd", width: 1920, height: 1080 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
] as const;

/** Must match the expanded `.billboard__desc` padding-right (HERO-DSC-003). */
const DESC_SCROLL_GAP_PX = 16;

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/** Page-relative boxes (scroll-independent) of the art, hero and strip. */
async function heroPageBoxes(page: Page): Promise<{ stages: Box; hero: Box; strip: Box }> {
  return page.evaluate(() => {
    const box = (sel: string) => {
      const r = document.querySelector(sel)!.getBoundingClientRect();
      const y = window.scrollY;
      const x = window.scrollX;
      return {
        left: r.left + x,
        top: r.top + y,
        right: r.right + x,
        bottom: r.bottom + y,
        width: r.width,
        height: r.height,
      };
    };
    return { stages: box(".billboard__stages"), hero: box(".billboard"), strip: box(".catalogue") };
  });
}

function expectSameBox(actual: Box, expected: Box, what: string): void {
  for (const k of ["left", "top", "width", "height"] as const) {
    expect(Math.abs(actual[k] - expected[k]), `${what} ${k}: ${actual[k]} vs ${expected[k]}`).toBeLessThanOrEqual(0.5);
  }
}

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

/**
 * Sample the strip's top band (the 28px it overlaps the hero foot) across the width: every point
 * must paint either the strip or the raised card, never the art, scrim or billboard background.
 */
async function stripTopPainters(page: Page): Promise<{ x: number; painter: string }[]> {
  return page.evaluate(() => {
    const strip = document.querySelector<HTMLElement>(".catalogue")!;
    // Bring the strip's top band to mid-viewport so elementFromPoint can see it.
    const pageTop = strip.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, Math.max(0, pageTop - window.innerHeight / 2));
    const top = strip.getBoundingClientRect().top;
    const out: { x: number; painter: string }[] = [];
    const w = document.documentElement.clientWidth;
    for (const dy of [2, 10, 20]) {
      for (let x = 4; x < w - 4; x += Math.max(8, Math.floor(w / 40))) {
        const el = document.elementFromPoint(x, top + dy);
        let painter = "none";
        if (el?.closest(".billboard__content")) painter = "card";
        else if (el?.closest(".catalogue")) painter = "strip";
        else if (el) painter = `${el.tagName.toLowerCase()}.${[...el.classList].join(".")}`;
        out.push({ x, painter });
      }
    }
    return out;
  });
}

// Classic scrollbars, so the scrollbar-clearance check measures a real one (file-level: a
// launch option forces its own worker).
test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

test.describe("hero expanded description (HERO-DSC-002..004)", () => {
  for (const vp of expandViewports) {
    test.describe(`@ ${vp.name} (${vp.width}x${vp.height})`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test("expanding keeps the art box, hero box and stats strip; the strip is never painted over; collapse restores", async ({
        page,
      }) => {
        await openCase(page, "very-long-desc-with-urls");
        const toggle = page.locator(".billboard__desc-toggle");
        await expect(toggle).toHaveAttribute("aria-expanded", "false");
        if (process.env.HERO_SCREENS_DIR) {
          await page.screenshot({ path: `${process.env.HERO_SCREENS_DIR}/harness-${vp.name}-collapsed.png` });
        }
        const before = await heroPageBoxes(page);
        const beforePainters = await stripTopPainters(page);
        await page.evaluate(() => window.scrollTo(0, 0));

        await toggle.click();
        await expect(toggle).toHaveAttribute("aria-expanded", "true");
        await expect(page.locator(".billboard")).toHaveClass(/is-desc-expanded/);
        // Measure first: a full-page screenshot resizes the viewport (and drops the scrollbar).
        const expanded = await heroPageBoxes(page);
        const painters = await stripTopPainters(page);
        if (process.env.HERO_SCREENS_DIR) {
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.screenshot({ path: `${process.env.HERO_SCREENS_DIR}/harness-${vp.name}-expanded.png` });
          await page.screenshot({ path: `${process.env.HERO_SCREENS_DIR}/harness-${vp.name}-expanded-full.png`, fullPage: true });
        }
        expectSameBox(expanded.stages, before.stages, "art (.billboard__stages)");
        expectSameBox(expanded.hero, before.hero, "hero (.billboard)");
        expect(Math.abs(expanded.strip.top - before.strip.top), "stats strip top").toBeLessThanOrEqual(0.5);

        // HERO-DSC-004: only the card may sit over the strip; the art never does. Every point
        // the strip painted collapsed is the strip or the card expanded.
        const art = painters.filter((p) => p.painter !== "strip" && p.painter !== "card");
        expect(art, `strip top painted by: ${JSON.stringify(art.slice(0, 5))}`).toEqual([]);
        const lost = painters.filter(
          (p, i) => beforePainters[i]?.painter === "strip" && p.painter !== "strip" && p.painter !== "card"
        );
        expect(lost).toEqual([]);
        // Where the card does not reach, the strip still shows.
        const card = await page.locator(".billboard__content").boundingBox();
        const vw = vp.width;
        if (card && (card.x > 24 || card.x + card.width < vw - 24)) {
          expect(painters.some((p) => p.painter === "strip"), "strip visible beside the card").toBe(true);
        }

        await page.evaluate(() => window.scrollTo(0, 0));
        await toggle.click();
        await expect(toggle).toHaveAttribute("aria-expanded", "false");
        const collapsed = await heroPageBoxes(page);
        expectSameBox(collapsed.stages, before.stages, "art after collapse");
        expectSameBox(collapsed.hero, before.hero, "hero after collapse");
        expect(Math.abs(collapsed.strip.top - before.strip.top)).toBeLessThanOrEqual(0.5);
        expect(await page.locator(".billboard__desc").evaluate((d) => d.scrollTop)).toBe(0);
      });

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
