# Public episode card footer — design contract

Shared layout for subjects, podcast-service icon buttons, and Discovery youtube-stats on public result cards.

**Source of truth:** `src/styles.scss` (`mat-card .mdc-card__actions:not(.review-actions)`), from **v1.9.967+**.

**Local eyeball aid:** open [`public-card-footer-permutations.html`](./public-card-footer-permutations.html) in a browser (static fixture — no Angular build).

Review/outgoing cards (`.review-actions`) are **out of scope**.

## Surfaces

One shared rule covers homepage, search, podcast list, podcast episode, subject, bookmarks, and Discovery. Do **not** add page-specific footer forks.

## Layout model

Flex **row-wrap** on the actions row. `mat-card-footer.subjects` and `app-subjects` use **`display: contents`** so each `.subject` and the icon host share one flex formatting context.

| Role | Behaviour |
|------|-----------|
| Icon host | `app-episode-links`, `app-episode-podcast-links`, or `.discovery-service-links` — one content-sized flex item (`order: 2`). **Flush left** with description (actions `padding-left` only — **no** host `margin-left`). Fixed **`height: icon-row`**; all buttons mid-align inside it. |
| Leading subjects | `order: 1`, `flex: 1 0 100%` — full-width rows above the icon island. |
| Last / only subject | `order: 2`, `flex: 1 1 0`, **natural height** — parent `align-items: center` mid-aligns it with the icon host. **Never** `min-height`/`height: icon-row` on the subject (short last lines leave a hole above the label). |
| Zero subjects | Actions still reserve `desc-gap + icon-row` min-height. |

Island width = **actual icon host width** (variable button count). Never a fixed `padding-left` / rem guess.

## Spacing tokens

| Token / rule | Value | Role |
|--------------|-------|------|
| `--public-card-desc-gap` | `8px` | Description → footer |
| `--public-card-footer-clearance` | `10px` | Icon/meta → card bottom |
| `--public-card-icon-row` | `40px` (MDC state layer) | Icon host + last/only subject + `.youtubemeta` height |
| Actions `padding-left` | `20px` / `10px` / `2px` | Shared left inset for description **and** icons |
| Icon `margin-right` | `25px` / `18px` / `12px` | Gap between service buttons — **do not squeeze** |
| Subject gaps | `6px` | Uniform between subjects — no stretch hole above last |

## Vertical alignment (non-negotiable)

1. **All service buttons** (YT, Spotify, Apple, BBC, IA, Share, …) share **one mid-line** inside the icon host.
2. **Last/only subject** mid-aligns with that icon mid-line via the actions row’s `align-items: center` (subject stays **natural height**).
3. **`.youtubemeta`** (Discovery) mid-aligns with the same icon mid-line.
4. Clearance under the icon row comes from card `padding-bottom` (~10px), not from nudging individual icons.
5. Gaps between subject lines stay **uniform** (~6px from leading `padding-bottom`) — short vs wrapped last subjects must not change that.

## What NOT to do

- Fixed island widths (`16.5rem`, `nth-of-type` left offsets).
- Extra left margin on the icon host (double-indents vs description).
- Absolute-positioning each button with guessed `left` values.
- Squeezing the 25px icon `margin-right`.
- `min-height` / `height: icon-row` on **last/only** subjects (uneven gap above short last labels; wrapped last labels hide the bug).
- `min-height` on **leading** subjects to fake align (opens uneven gaps).
- Relying on `align-items: end` from `mat-card .mdc-card__actions` for public footers.
- Page-specific forks / touching `.review-actions` for this contract.

---

## Permutation matrix / verification checklist

Check **every** cell before shipping footer CSS changes. Use the [static fixture](./public-card-footer-permutations.html) first, then a live card on preview.

### Must be true on every permutation

| Rule | Pass |
|------|------|
| Icons flush left with description left edge (no extra indent) | ☐ |
| All service icons share one horizontal mid-line (YT not lower than Share) | ☐ |
| Last/only subject mid-aligned with that icon mid-line | ☐ |
| ~8px gap description → footer | ☐ |
| ~10px clearance icons → card bottom | ☐ |
| No subject text overlapping icons | ☐ |
| Uniform ~6px gaps between subject lines (2+ subjects) — same whether last is short or wraps | ☐ |
| Leading subjects (if any) use full card width | ☐ |
| Short last subject does **not** sit in a taller box than siblings (no hole above it) | ☐ |

### Subjects × services

| # | Subjects | Service buttons | Expect |
|---|----------|-----------------|--------|
| A | **0** | YT + Share | Icon row only; flush left; mid-line shared; 8px top / 10px bottom |
| B | **1** short | YT + Share | Subject right of icons, mid-aligned; no collision |
| C | **1** long (“The Church Of Jesus Christ Of Latter-Day Saints”) | YT + Spotify + Apple + Share | Subject clears full icon cluster; may wrap within remaining width; no overlap |
| D | **2+** (“Human Trafficking” + “Hustler's University”) | YT + Share | First subject full width; last mid-aligned with icons; **uniform 6px gap** (no hole above short last) |
| D2 | **2+** short last + duplicate mid lines | YT + Share | Gaps between all subject lines equal; last not stretched |
| D3 | **2+** with **long wrapped last** subject | YT + Spotify + Apple + Share | Last may wrap beside icons; gaps above last still match sibling gaps |
| D4 | **2+** long **leading** + short last (one line) | many buttons | Leading full width; short last mid-aligned; **no extra gap** under leading before last row |
| E | **2+** | YT only | Same as D; island narrows to one button + margins |
| F | **2+** | YT + Spotify + Apple + BBC + IA + Share | Island grows; last subject still clears all icons; icons stay one mid-line |
| G | **1** | YT + Spotify + Apple | Mid-align + flush left |

### Discovery youtube-stats

| # | Subjects | Buttons + meta | Expect |
|---|----------|----------------|--------|
| H | 0 or 1+ | YT + **`.youtubemeta`** (Views / Members) + Spotify… | Meta mid-aligned with icons; same bottom clearance; subjects clear host including meta width |
| I | 2+ | YT + meta + Share | Same as H; leading subjects full width |

**Live check owed:** H/I against a Discovery run that actually populates Members/Views (fixture covers geometry only).

### Narrow widths

| # | Viewport | Expect |
|---|----------|--------|
| J | ≤600px | `padding-left` 10px; icon `margin-right` 18px; rules A–I still hold |
| K | ≤400px | `padding-left` 2px; icon `margin-right` 12px; long subject still no collision |

---

## DevTools measurement (live card)

1. Select the icon host (`app-episode-links` / `.discovery-service-links`) and the last `.subject`.
2. Compare **getBoundingClientRect().top/bottom** midpoints — should match within ~1px.
3. Compare each `mat-icon-button` midpoint inside the host — should match each other.
4. Description left vs first icon left — same content inset (actions padding).
5. Card bottom − icon bottom ≈ 10px.

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
