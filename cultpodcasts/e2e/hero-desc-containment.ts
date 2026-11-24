/**
 * Shared assertions for the homepage hero and the item-page hero: a short description
 * has no expander; a tall one has an expander; once expanded, the text (and chevron)
 * stay inside the card and do not paint over the artwork or following content.
 */
import { expect, type Page } from "@playwright/test";

type Containment = {
	card: string;
	desc: string;
	toggle: string;
	/** Content below the hero (homepage `.catalogue`, item page `app-episode-rail, app-film-trailers`). */
	following: string;
	/**
	 * When the visual card is an absolutely positioned `::before` (wide episode hero),
	 * measure that box instead of the element's border box.
	 */
	cardBefore?: boolean;
};

function boxes(page: Page, sel: Containment) {
	return page.evaluate((s) => {
		const desc = document.querySelector<HTMLElement>(s.desc)!;
		const toggle = document.querySelector<HTMLElement>(s.toggle);
		const following = document.querySelector<HTMLElement>(s.following);
		const host = document.querySelector<HTMLElement>(s.card)!;
		const hr = host.getBoundingClientRect();
		let card = { top: hr.top, bottom: hr.bottom, left: hr.left, right: hr.right };
		if (s.cardBefore) {
			const cs = getComputedStyle(host, "::before");
			const hasBefore = cs && cs.content !== "none" && cs.position === "absolute";
			if (hasBefore) {
				card = {
					top: hr.top + (Number.parseFloat(cs.top) || 0),
					bottom: hr.bottom - (Number.parseFloat(cs.bottom) || 0),
					left: hr.left + (Number.parseFloat(cs.left) || 0),
					right: hr.right - (Number.parseFloat(cs.right) || 0),
				};
			}
		}
		const dr = desc.getBoundingClientRect();
		const tr = toggle?.getBoundingClientRect();
		const fr = following?.getBoundingClientRect();
		const inside = (r: DOMRect) =>
			r.top >= card.top - 2 && r.bottom <= card.bottom + 2 && r.left >= card.left - 2 && r.right <= card.right + 2;
		const overlap = (a: { top: number; bottom: number; left: number; right: number }, b: DOMRect) =>
			a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
		return {
			descInside: inside(dr),
			toggleInside: tr ? inside(tr) : true,
			descOverFollow: !!(fr && overlap(dr, fr)),
			toggleOverFollow: !!(tr && fr && overlap(tr, fr)),
			cardCoversFollowOverlap: !!(fr && overlap(card, fr)),
			desc: { top: dr.top, bottom: dr.bottom, left: dr.left, right: dr.right },
			card,
			followTop: fr?.top ?? null,
		};
	}, sel);
}

/** Expanded: the card contains the text and chevron; neither spills over the art or following content. */
export async function expectExpandedContained(page: Page, sel: Containment): Promise<void> {
	const r = await boxes(page, sel);
	expect(r.descInside, `description overflows the card (desc ${JSON.stringify(r.desc)} card ${JSON.stringify(r.card)})`).toBe(true);
	expect(r.toggleInside, "chevron overflows the card").toBe(true);
	// Text may sit over following content only if the card itself covers that overlap (homepage may cover the stats strip).
	if (r.descOverFollow || r.toggleOverFollow) {
		expect(r.cardCoversFollowOverlap, "expanded text overlaps following content outside the card").toBe(true);
	}
}

export const homepageContainment: Containment = {
	card: ".billboard__content",
	desc: ".billboard__desc",
	toggle: "button.billboard__desc-toggle",
	following: ".catalogue",
};

export const itemHeroContainment: Containment = {
	card: ".episode-hero",
	desc: "app-hero-description .hero-desc__text",
	toggle: "app-hero-description button.hero-desc__toggle",
	following: "app-episode-rail, app-film-trailers, app-film-youtube-alternates",
	cardBefore: true,
};
