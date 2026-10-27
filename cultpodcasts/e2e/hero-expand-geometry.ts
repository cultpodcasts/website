import { expect, type Page } from "@playwright/test";

/**
 * Shared geometry for the expanded-description specs (HERO-DSC-004 / 005), used on the real app
 * (homepage-hero-expand) and on the harness (hero-layout-expand).
 * All boxes are page-relative (scroll-independent).
 */
export interface HeroExpandGeometry {
	/** Art band (`.billboard__stages`): [left, top, width, height]. */
	stages: number[];
	/** Hero (`.billboard`): [left, top, width, height]. */
	hero: number[];
	cardTop: number;
	cardBottom: number;
	stripTop: number;
}

export function heroExpandGeometry(page: Page): Promise<HeroExpandGeometry> {
	return page.evaluate(() => {
		const y = window.scrollY;
		const x = window.scrollX;
		const r = (el: Element) => el.getBoundingClientRect();
		const b = (sel: string) => {
			const q = r(document.querySelector(sel)!);
			return [q.left + x, q.top + y, q.width, q.height];
		};
		const card = document.querySelector<HTMLElement>(".billboard__content")!;
		const c = r(card);
		return {
			stages: b(".billboard__stages"),
			hero: b(".billboard"),
			cardTop: c.top + y,
			cardBottom: c.bottom + y,
			stripTop: r(document.querySelector(".catalogue")!).top + y,
		};
	});
}

/** Who paints the strip's top band (the 28px it overlaps the hero foot) across the width. */
export function stripTopPainters(page: Page): Promise<string[]> {
	return page.evaluate(() => {
		const strip = document.querySelector<HTMLElement>(".catalogue")!;
		// Bring the strip's top band to mid-viewport so elementFromPoint can see it.
		window.scrollTo(0, Math.max(0, strip.getBoundingClientRect().top + window.scrollY - window.innerHeight / 2));
		const top = strip.getBoundingClientRect().top;
		const w = document.documentElement.clientWidth;
		const out: string[] = [];
		for (const dy of [2, 10, 20]) {
			for (let px = 4; px < w - 4; px += Math.max(8, Math.floor(w / 40))) {
				const el = document.elementFromPoint(px, top + dy);
				out.push(el?.closest(".billboard__content") ? "card" : el?.closest(".catalogue") ? "strip"
					: el ? `${el.tagName.toLowerCase()}.${[...el.classList].join(".")}` : "none");
			}
		}
		return out;
	});
}

/**
 * HERO-DSC-004 / 005: expanding keeps the card's top (within 1px: it never moves down, or up),
 * the art box, the hero box and the stats strip where they were; the card may grow down over the
 * strip, but the art never paints over it: every point of the strip's top band is the strip or
 * the card, and wherever the strip painted collapsed it is still the strip or the card.
 */
export function expectExpandedKeepsTop(
	before: HeroExpandGeometry,
	after: HeroExpandGeometry,
	beforePainters: string[],
	afterPainters: string[],
	where: string
): void {
	const at = `${where}: before ${JSON.stringify(before)} after ${JSON.stringify(after)}`;
	expect(Math.abs(after.cardTop - before.cardTop), `card top moved — ${at}`).toBeLessThanOrEqual(1);
	expect(after.cardBottom, `card did not grow down — ${at}`).toBeGreaterThan(before.cardBottom + 1);
	for (let i = 0; i < 4; i++) {
		expect(Math.abs(after.stages[i] - before.stages[i]), `art box [${i}] changed — ${at}`).toBeLessThanOrEqual(1);
		expect(Math.abs(after.hero[i] - before.hero[i]), `hero box [${i}] changed — ${at}`).toBeLessThanOrEqual(1);
	}
	expect(Math.abs(after.stripTop - before.stripTop), `stats strip moved — ${at}`).toBeLessThanOrEqual(1);
	const notStripOrCard = (p: string) => p !== "strip" && p !== "card";
	expect(beforePainters.filter(notStripOrCard), `${where}: collapsed strip top painted by`).toEqual([]);
	expect(afterPainters.filter(notStripOrCard), `${where}: art paints over the expanded strip top`).toEqual([]);
}
