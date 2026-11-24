# Item page hero description (#703)

The item page hero (`app-playable-detail-shell`, used by the podcast episode, film, TV show episode and
news report pages) renders its description with `app-hero-description`
(`src/app/hero-description/`). It gives D1 search hits, which carry the full description, the
homepage hero's clamp and expander ([homepage-hero.md](homepage-hero.md), HERO-DSC-001 / 003 / 006).

| Contract | Behaviour |
| --- | --- |
| Clamp | 5 lines wide, 4 at <=1280px, 3 at <=700px (same as the homepage hero). |
| Expander | Only when the text overflows the clamp. Round 32px `expand_more` button on the last visible line, bottom-right of the text column, over a fade. |
| Expanded | Clamp off; the full text shows up to 60vh and the rest scrolls inside. Same column width, so nothing re-wraps. The `expand_less` button sits in a 40px band under the text and never covers a line. |
| Collapse | Back to the clamp with the first line at the top (scroll reset). A new item (text change) collapses. |
| Accessibility | `aria-expanded`, `aria-controls` (the text's id), labels "Expand description" / "Collapse description". Expanded text is focusable for keyboard scrolling. |
| Azure (#702) | Azure and missing-engine hits keep the 180-character card text, unclamped, with no expander. |
| No D1 character cap | Like the homepage hero, D1 descriptions are never cut by characters: `formatSearchDescription` returns the full trimmed text for D1 (a 50k-character description is all there when expanded and scrolls inside). Only the line clamp limits the collapsed view. |

Labels, icons and the overflow rule are shared with the homepage hero (`hero-description.ts`:
`HeroDescToggleLabel`, `HeroDescToggleIcon`, `clampOverflows`).

Tests: `hero-description.component.spec.ts`, `hero-description.spec.ts`,
`playable-detail-shell.component.spec.ts` (unit) and `e2e/item-hero-description.spec.ts` (catalogue
Playwright suite: every kind at wide / medium / mobile; `npm run test:e2e:item-hero-desc`).