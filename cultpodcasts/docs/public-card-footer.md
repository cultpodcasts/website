# Public episode card footer — design contract

Shared layout for subjects, podcast-service icon buttons, and Discovery youtube-stats on public result cards.

**Source of truth:** `src/styles.scss` (`mat-card .mdc-card__actions:not(.review-actions)`), from **v1.9.969+**.

**Local eyeball aid:** open [`public-card-footer-permutations.html`](./public-card-footer-permutations.html) in a browser (static fixture — no Angular build).

Review/outgoing cards (`.review-actions`) are **out of scope**.

## Surfaces

One shared rule covers homepage, search, podcast list, podcast episode, subject, bookmarks, and Discovery. Do **not** add page-specific footer forks.

## Layout model

Flex **row-wrap** on the actions row. `mat-card-footer.subjects` and `app-subjects` use **`display: contents`** so each `.subject` and the icon host share one flex formatting context.

| Role | Behaviour |
|------|-----------|
| Icon host | Content-sized (`order: 2`). **Flush left**. Fixed **`height: icon-row`**. |
| **2+ subjects** | Every subject `order: 1`, `flex: 1 0 100%` — full-width rows **above** the icon island. |
| **Only-child** | `order: 2`, `flex: 1 1 var(--public-card-subject-min)`, **`min-width: var(--public-card-subject-min)`** (default **100px**, configurable). Shares the icon row when there is room; if the island leaves less than min-width, **`flex-wrap: wrap-reverse`** stacks the subject **above** the island (never a crushed skinny column). |
| Zero subjects | Actions still reserve `desc-gap + icon-row` min-height. |

Island width = **actual icon host width** (variable button count). Never a fixed rem guess.

### Configurable subject min-width

```css
--public-card-subject-min: 100px; /* override on actions / theme if needed */
```

Only-child must not shrink below this beside the island. Override the custom property to tune.

### Hard rule: never split subjects

The icon island must **never** appear between subject lines (e.g. subject₁ → icons → subject₂). That was a flex-wrap failure when the island was wide and last subject shared `order` with the icons. With 2+ subjects, stack all labels first; icons come after.

## Spacing tokens

| Token / rule | Value | Role |
|--------------|-------|------|
| `--public-card-desc-gap` | `8px` | Description → footer |
| `--public-card-footer-clearance` | `10px` | Icon/meta → card bottom |
| `--public-card-icon-row` | `40px` (MDC state layer) | Icon host + only-child / `.youtubemeta` height |
| Actions `padding-left` | `20px` / `10px` / `2px` | Shared left inset for description **and** icons |
| Icon `margin-right` | `25px` / `18px` / `12px` | Gap between service buttons — **do not squeeze** |
| `--public-card-subject-min` | `100px` | Min width for only-child beside the island; else stack above |

## Vertical alignment (non-negotiable)

1. **All service buttons** share **one mid-line** inside the icon host.
2. **Only-child** mid-aligns with that icon mid-line (natural height; parent `align-items: center`).
3. **2+ subjects:** icons sit on a row **below** the subject stack (left-aligned); subjects are not mid-aligned beside a wide island.
4. **`.youtubemeta`** mid-aligns with the icon mid-line inside the host.
5. Clearance under the icon row = card `padding-bottom` (~10px).
6. Gaps between subject lines stay **uniform** (~6px).

## What NOT to do

- Crushing only-child into a sub-`--public-card-subject-min` column beside a wide island (youtube-stats, many buttons).
- Let the icon island wrap **between** subject lines.
- Fixed island widths (`16.5rem`, `nth-of-type` left offsets).
- Extra left margin on the icon host (double-indents vs description).
- Absolute-positioning each button with guessed `left` values.
- Squeezing the 25px icon `margin-right`.
- `min-height` / `height: icon-row` on subjects (uneven gaps).
- Putting last-of-many on `order: 2` with the icon host (wide islands re-split the list on wrap).
- Page-specific forks / touching `.review-actions` for this contract.

---

## Permutation matrix / verification checklist

Check **every** cell before shipping footer CSS changes. Use the [static fixture](./public-card-footer-permutations.html) first, then a live card on preview.

### Must be true on every permutation

| Rule | Pass |
|------|------|
| Icons flush left with description left edge | ☐ |
| All service icons share one horizontal mid-line | ☐ |
| Icon island **never** between subject lines | ☐ |
| ~8px gap description → footer | ☐ |
| ~10px clearance icons → card bottom | ☐ |
| No subject text overlapping icons | ☐ |
| Uniform ~6px gaps between subject lines (2+) | ☐ |
| Leading / multi subjects use full card width | ☐ |
| Only-child mid-aligned with icons when room; else full-width above island (≥ min-width) | ☐ |
| Only-child never crushed to one-word-per-line beside a wide island | ☐ |

### Subjects × services

| # | Subjects | Service buttons | Expect |
|---|----------|-----------------|--------|
| A | **0** | YT + Share | Icon row only; flush left; 8px top / 10px bottom |
| B | **1** short | YT + Share | Subject right of icons, mid-aligned |
| C | **1** long (Latter-Day Saints) | YT + Spotify + Apple + Share | Clears full cluster; may wrap in remaining width |
| D | **2+** short | YT + Share | **All subjects stacked full width; icons underneath** |
| D2 | **3** short | YT + Share | Uniform gaps; icons under entire stack |
| D3 | **2+** long labels | many buttons | Subjects stacked full width (may wrap within row); icons underneath — **not** between |
| D4 | long leading + short last | many buttons | Both above; icons underneath |
| E | **2+** | YT only | Same stack-then-icons |
| F | **2+** | YT + Spotify + Apple + BBC + IA + Share | Same — wide island still **under** subjects, never between |
| G | **1** | YT + Spotify + Apple | Mid-align + flush left |

### Discovery youtube-stats

| # | Subjects | Buttons + meta | Expect |
|---|----------|----------------|--------|
| H | 0 or 1 | YT + **`.youtubemeta`** + … | Meta mid-aligned in host; only-child keeps ≥`--public-card-subject-min` or stacks **above** island |
| I | 2+ | YT + meta + Share | Subjects stacked; host (with meta) underneath |

**Live check owed:** H/I against Discovery with real Members/Views.

### Narrow widths

| # | Viewport | Expect |
|---|----------|--------|
| J | ≤600px | Rules A–I still hold |
| K | ≤400px | Long subjects still no collision / no split |

---

## DevTools measurement (live card)

1. With 2+ subjects: every `.subject` top edge is **above** the icon host top — no subject below the host.
2. Only-child: subject and icon host midpoints match within ~1px.
3. Description left vs first icon left — same content inset.
4. Card bottom − icon bottom ≈ 10px.

---

## Where to edit

| Concern | File |
|---------|------|
| Public footer contract | `src/styles.scss` |
| Subject stack (editable X) | `src/app/subjects/subjects.component.sass` |
| Episode buttons | `src/app/episode-links/*` |
| Podcast/bookmark buttons | `src/app/episode-podcast-links/*` |
| Discovery + youtube-stats | `src/app/discovery-item/*` |
| This checklist + fixture | `docs/public-card-footer.md`, `docs/public-card-footer-permutations.html` |
