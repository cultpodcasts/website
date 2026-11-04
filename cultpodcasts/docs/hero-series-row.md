# Hero series row — design brief

Shared by the **homepage billboard** and the **playable item page** (podcast / news / TV / film) under `.hero-show`.

Subject chips (coloured topic pills under the description) are a **different** system — see [homepage-hero.md](./homepage-hero.md) HERO-SUB-\*. Do not reuse series-pill metrics for chips.

## What sits on the row

| Piece | When | Look |
|-------|------|------|
| Kind badge (`app-content-kind-badge`) | News / TV / Film only | Accent text + Material icon (`newspaper` / `live_tv` / `movie`). No border, no fill. |
| Series pill (`a.hero-pill`) | Parent catalogue page exists (podcast / news org / TV show) | Bordered translucent pill, uppercase label, links to the parent. |

Film: badge only. Podcast: pill only. News / TV: badge then pill.

Homepage only: an eyebrow (“Now featuring”) sits **above** this row on its own line — never beside the pill.

## Layout contracts

| ID | Rule |
|----|------|
| **HERO-SER-001** | One horizontal flex row: `display: flex` (block-level, not `inline-flex`), `width: 100%`, `flex-wrap: nowrap`, `align-items: center`, `gap: 12px`. Homepage `.billboard__copy` is a **column flex** and the eyebrow is block `flex` (not `inline-flex`) so Firefox cannot keep “Now featuring” beside the pill. |
| **HERO-SER-002** | Kind badge and series pill are **vertically centred** to each other (midpoints within 3px). The pill is usually taller (padding); the badge centres to it. |
| **HERO-SER-003** | **Never wrap** label text inside the pill or the kind badge. `white-space: nowrap` on both. |
| **HERO-SER-004** | Long series names **truncate with an ellipsis** (`overflow: hidden; text-overflow: ellipsis`). The pill may shrink (`flex: 0 1 auto; min-width: 0`); the kind badge does **not** shrink (`flex-shrink: 0`). Full name stays on `title` for hover. |
| **HERO-SER-005** | Gap between the kind badge box and the pill box is **12px** (±1px). No overlapping boxes. |
| **HERO-SER-006** | Kind icon is **not** repeated inside the pill (same as HERO-KND-001). |
| **HERO-SER-007** | `app-content-kind-badge` host is a real flex item (`inline-flex`), **not** `display: contents` — Firefox mis-sizes `contents` children in flex and wraps the pill. |

## Spacing map

```
[eyebrow — homepage only]
        ↕ 8px (eyebrow margin-bottom)
[.kind-badge]  ↔12px↔  [series pill …]
        ↕ 10px (.hero-show margin-bottom)
[title]
```

Subject chips below the description keep their own **8px** wrap gap — independent of the 12px series-row gap.

## Truncation / line-break policy

| Element | Narrow card / long name | Never |
|---------|-------------------------|--------|
| Kind badge (“News”, “TV”, “Film”) | Stays full; does not shrink | Wrap, ellipsis |
| Series pill | Single line; ellipsis when the row runs out of width | Soft wrap to 2+ lines (breaks the pill silhouette — Firefox regression, Nov 2026) |
| Subject chips | Single line + ellipsis (existing chip styles) | — |

## Vertical align

`align-items: center` on `.hero-show`. Assert midY(badge) ≈ midY(pill) (≤3px). Do **not** baseline-align: the pill’s border box is taller than the accent label.

## Tests (must stay green)

| Layer | What |
|-------|------|
| Sass / style contracts | `hero-series-row.contract.spec.ts` — flex not inline-flex, gap 12px, nowrap + ellipsis on `.hero-pill`, no `display: contents` on the kind-badge host |
| Unit | Homepage + playable-detail / podcast-episode: DOM order, kind+pill co-location, `title` on the pill, no kind icon in the pill |
| Catalogue e2e | Homepage kind slides + item-page news/TV heroes: single-line pill height, gap ≥11px, midpoints ≤3px, no horizontal overlap |

## Related

- Kind membership / links: HERO-KND-001 in [homepage-hero.md](./homepage-hero.md)
- Global CSS: `src/styles.scss` (`.hero-show`, `.hero-pill`)
- Kind badge: `src/app/content-kind-badge/`
