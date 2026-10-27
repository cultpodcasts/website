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

/**
 * HERO-DSC-006: the description's text column and where its lines break, at the current state
 * (collapsed or expanded). `contentWidth` is the client box less the padding (the width the text
 * wraps in, past any reserved scrollbar gutter); `starts` is the character offset each line starts
 * at, found per character with Range.getClientRects (every line is laid out, also the ones past
 * the collapsed clamp, so this is independent of the clamp and the scroll offset); `lines` is
 * each line's text. `visible` is the collapsed clamp's line count (client height / line height).
 */
export interface HeroDescWrap {
	contentWidth: number;
	starts: number[];
	lines: string[];
	visible: number;
}

export function heroDescWrap(page: Page): Promise<HeroDescWrap> {
	return page.evaluate(() => {
		const d = document.querySelector<HTMLElement>(".billboard__desc")!;
		const cs = getComputedStyle(d);
		const px = (v: string) => Number.parseFloat(v) || 0;
		const lineH = px(cs.lineHeight);
		const text = d.textContent ?? "";
		const walker = document.createTreeWalker(d, NodeFilter.SHOW_TEXT);
		const nodes: Text[] = [];
		for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
		const starts: number[] = [];
		let base = 0;
		let lastTop = Number.NEGATIVE_INFINITY;
		const range = document.createRange();
		for (const node of nodes) {
			for (let i = 0; i < node.length; i++) {
				if (/\s/.test(node.data[i])) continue;
				range.setStart(node, i);
				range.setEnd(node, i + 1);
				const r = range.getClientRects()[0];
				if (!r || r.width === 0) continue;
				if (r.top > lastTop + lineH / 2) {
					starts.push(base + i);
					lastTop = r.top;
				}
			}
			base += node.length;
		}
		const lines = starts.map((s, i) => text.slice(s, i + 1 < starts.length ? starts[i + 1] : text.length).trim());
		return {
			contentWidth: d.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight),
			starts,
			lines,
			visible: Math.round(d.clientHeight / lineH),
		};
	});
}

/**
 * HERO-DSC-006: expanding never re-wraps the text. The text column is the same width (within
 * 0.5px) and every line that showed collapsed, plus where the last one broke, starts at the same
 * character expanded (the first `visible + 1` line starts match), so the visible lines wrap at
 * exactly the same words.
 */
export function expectSameWrap(collapsed: HeroDescWrap, expanded: HeroDescWrap, where: string): void {
	const n = Math.min(collapsed.visible + 1, collapsed.starts.length);
	const at = `${where}: collapsed ${JSON.stringify({ w: collapsed.contentWidth, lines: collapsed.lines.slice(0, n) })} expanded ${JSON.stringify({ w: expanded.contentWidth, lines: expanded.lines.slice(0, n) })}`;
	expect(collapsed.visible, `collapsed shows lines — ${at}`).toBeGreaterThanOrEqual(2);
	expect(Math.abs(expanded.contentWidth - collapsed.contentWidth), `text column width changed — ${at}`).toBeLessThanOrEqual(0.5);
	expect(expanded.starts.slice(0, n), `lines re-wrapped — ${at}`).toEqual(collapsed.starts.slice(0, n));
	expect(expanded.lines.slice(0, collapsed.visible), `visible lines re-wrapped — ${at}`).toEqual(collapsed.lines.slice(0, collapsed.visible));
}
