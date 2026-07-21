# Public episode card footer — design contract

Shared layout for subjects, podcast-service icon buttons, and Discovery youtube-stats on public result cards.

**Source of truth:** `src/styles.scss` (`mat-card .mdc-card__actions:not(.review-actions)`), from **v1.9.970+**.

**Local eyeball aid:** open [`public-card-footer-permutations.html`](./public-card-footer-permutations.html) in a browser (static fixture — no Angular build).

Review/outgoing cards (`.review-actions`) are **out of scope**.

## Surfaces

One shared rule covers homepage, search, podcast list, podcast episode, subject, bookmarks, and Discovery. Do **not** add page-specific footer forks.

## Layout model

CSS **grid** on the actions row (not flex-wrap). `mat-card-footer.subjects` and `app-subjects` use **`display: contents`** so each `.subject` and the icon host are grid items.

```css
grid-template-columns:
  fit-content(calc(100% - var(--public-card-subject-min)))
  minmax(var(--public-card-subject-min), 1fr);
```

| Role | Behaviour |
|------|-----------|
| Icon host | `grid-column: 1`, `order: 2` — left cell of the **bottom** row. Flush left. Height `icon-row`. Width grows with buttons/stats but is **capped** so the subject column keeps its minimum. |
| Leading subjects | `grid-column: 1 / -1`, `order: 1` — full-width rows **above** the bottom row. |
| Last / only subject | `grid-column: 2`, `order: 2` — **shares the bottom row** with the icon island; mid-aligned; not crushed below `--public-card-subject-min`. |
| Zero subjects | Icon host alone in column 1. |

### Hard rules

1. **Coexist when there is room** — last/only subject and the button island share the bottom row.
2. **Never split subjects** — island must not appear between subject lines (leading labels stay above the bottom row).
3. **Never crush** — subject column minimum is `--public-card-subject-min` (default **100px**, configurable). The island track is `fit-content(100% - min)` so labels keep that floor.

### Configurable subject min-width

```css
--public-card-subject-min: 100px; /* override on card/actions/theme if needed */
```

## Spacing tokens

| Token / rule | Value | Role |
|--------------|-------|------|
| `--public-card-desc-gap` | `8px` | Description → footer |
| `--public-card-footer-clearance` | `10px` | Icon/meta → card bottom |
| `--public-card-icon-row` | `40px` | Icon host / `.youtubemeta` height |
| `--public-card-subject-min` | `100px` | Min width of subject column beside island |
| Icon `margin-right` | `25px` / `18px` / `12px` | Between service buttons — **do not squeeze** |
| Subject gaps | `6px` | Uniform between leading subjects |

## Vertical alignment

1. All service buttons share one mid-line inside the icon host.
2. Last/only subject mid-aligns with that mid-line (`align-items: center` on the grid).
3. `.youtubemeta` mid-aligns inside the host.
4. Card `padding-bottom` ≈ 10px under the icon row.

## What NOT to do

- Flex-wrap that places the island **between** subject lines.
- Putting **every** multi subject full-width above the island (loses bottom-row coexistence).
- Fixed island widths / `nth-of-type` left offsets.
- Extra left margin on the icon host.
- Squeezing the 25px icon `margin-right`.
- `min-height: icon-row` on subjects (uneven gaps).
- Crushing the subject column below `--public-card-subject-min`.

---

## Permutation matrix / verification checklist

Use the [static fixture](./public-card-footer-permutations.html) first, then preview.

### Must be true

| Rule | Pass |
|------|------|
| Icons flush left with description | ☐ |
| All service icons one mid-line | ☐ |
| Island **never** between subject lines | ☐ |
| Leading subjects full width above bottom row | ☐ |
| Last/only subject **beside** island on bottom row | ☐ |
| Subject column ≥ `--public-card-subject-min` | ☐ |
| ~8px under description · ~10px card bottom | ☐ |
| Uniform ~6px gaps between leading subjects | ☐ |

### Subjects × services

| # | Subjects | Buttons | Expect |
|---|----------|---------|--------|
| A | 0 | YT + Share | Island only |
| B | 1 short | YT + Share | Bottom row coexist |
| C | 1 long | YT + Spotify + Apple + Share | Bottom row; ≥ min-width; may wrap within column |
| D | 2+ short | YT + Share | Leading above; **last beside icons** |
| D2 | 3 short | YT + Share | First two above; **last beside icons** |
| D3 | 2+ long | many | Leading above; last beside (wraps in column) |
| D4 | long leading + short last | many | Leading above; short last beside |
| E | 2+ | YT only | Same coexist |
| F | 2+ | YT…BBC…IA…Share | Same — wide island **capped**; last still beside, not between |
| G | 1 | YT + Spotify + Apple | Bottom row coexist |
| H | 1 + youtube-stats | YT + meta + … | Bottom row; subject ≥ min-width (not one-word column) |
| I | 2+ + youtube-stats | YT + meta + Share | Leading above; last beside host |

**Live check owed:** H/I with real Discovery Members/Views.

---

## DevTools

1. 2+ subjects: every non-last `.subject` bottom ≤ icon host top; last `.subject` shares the icon host mid-line.
2. Last/only subject width ≥ `--public-card-subject-min`.
3. Description left vs first icon left — same inset.
4. Card bottom − icon bottom ≈ 10px.

## Where to edit

| Concern | File |
|---------|------|
| Public footer contract | `src/styles.scss` |
| Subject stack (editable X) | `src/app/subjects/subjects.component.sass` |
| This checklist + fixture | `docs/public-card-footer.md`, `docs/public-card-footer-permutations.html` |
