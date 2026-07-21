# Public episode card footer — design contract

Shared layout for subjects, podcast-service icon buttons, and Discovery youtube-stats on public result cards.

**Source of truth:** `src/styles.scss` (`mat-card .mdc-card__actions:not(.review-actions)`), from **v1.9.973+**.

**Local eyeball aid:** open [`public-card-footer.html`](./public-card-footer.html) in a browser (static fixture — no Angular build).

Review/outgoing cards (`.review-actions`) are **out of scope**.

## Surfaces

One shared rule covers homepage, search, podcast list, podcast episode, subject, bookmarks, and Discovery. Do **not** add page-specific footer forks.

## Layout model

CSS **flex** on the actions row (`flex-wrap` + `flex-direction: row-reverse`). `mat-card-footer.subjects` and `app-subjects` use **`display: contents`** so each `.subject` and the icon host are flex items.

| Role | Behaviour |
|------|-----------|
| Icon host | `order: 3`, `flex: 0 0 auto`, `margin-right: auto` — left of last subject when coexisting; alone flush-left when wrapped below. |
| Leading subjects | `flex: 0 0 100%`, `order: 1` — full-width rows **above** the bottom row. |
| Last / only subject | `order: 2`, `flex: 1 1 var(--public-card-subject-min)`, `min-width: min(100%, var(--public-card-subject-min))` — **beside** the island when island + min-width fit; otherwise full line **above** a wrapped island. |
| Zero subjects | Icon host alone, flush left. |

`row-reverse` is what keeps **island left / subject right** on one row, while still wrapping the **island below** the subject when they cannot coexist (subject is packed first in the reversed order).

### Hard rules

1. **Coexist when there is room** — last/only subject and the button island share the bottom row when island width + `--public-card-subject-min` fit.
2. **Stack when crushed** — if coexistence would drop the subject below `--public-card-subject-min` or overlap icons (wide island, youtube-stats, narrow card), **all subjects** (including last/only) sit **above** the island; island alone on the bottom row.
3. **Never split subjects** — island must not appear between subject lines (leading labels stay above; last subject never lands below the island while another subject is above).
4. **Never overlap** — subject text must not paint over the icon/stats island.

### Configurable subject min-width

| Token | Default | Where set |
|-------|---------|-----------|
| `--public-card-subject-min` | **`100px`** | `mat-card .mdc-card__actions:not(.review-actions)` in `styles.scss` |

```css
--public-card-subject-min: 100px; /* override on card / actions / theme if needed */
```

**Contract:**

- When coexisting, the last/only subject box is never narrower than this value.
- When the island’s intrinsic width leaves less than this for the subject, flex wrap stacks subjects above the island instead of crushing.
- Override the custom property to tune (e.g. `120px` on a denser layout) — do not hard-code a different px in one-off rules.
- Measure in DevTools: either last/only `.subject` content box width ≥ computed `--public-card-subject-min` **beside** the island, or the subject is on a full-width row **above** the island.

### Subject length bands (use these in checks)

| Band | Approx. | Example label |
|------|---------|---------------|
| **Tiny** | ≤ 8 chars | `Qanon`, `NXIVM` |
| **Short** | one short phrase | `Cult Psychology`, `Purity Culture` |
| **Medium** | typical multi-word | `Human Trafficking`, `Troubled Teen Industry`, `Hustler's University` |
| **Long** | real long proper name | `The Church Of Jesus Christ Of Latter-Day Saints` |
| **Very long** | stress / wrap | `Independent Fundamentalist Baptist ABCDEF GHI JKLMN OPQRSTUVWXZY` |

Length applies to **leading** rows (full card width) and to the **last/only** cell (beside island when coexisting, ≥ min-width). Wrapping inside the last cell is OK; crushing below min-width is not — stack instead.

## Spacing tokens

| Token / rule | Value | Role |
|--------------|-------|------|
| `--public-card-desc-gap` | `8px` | Description → footer |
| `--public-card-footer-clearance` | `10px` | Icon/meta → card bottom |
| `--public-card-icon-row` | `40px` | Icon host / `.youtubemeta` height |
| `--public-card-subject-min` | `100px` | Min width of subject beside island (else stack) |
| `--public-card-subject-line` | `1.25em` | Subject line-height used for last-line mid optical offset |
| Icon `margin-right` | `25px` / `18px` / `12px` | Between service buttons — **do not squeeze** |
| Subject gaps | `6px` | Uniform between leading subjects |

## Vertical alignment

1. All service buttons share one mid-line inside the icon host.
2. When last/only subject **coexists** on the bottom row with the island: icon-host vertical mid aligns with the **middle of the last line** of that subject (`align-self: flex-end` on both + `margin-bottom: calc((icon-row - subject-line) / 2)` on the subject) — not the top of the first line, and not the center of the whole wrapped subject block.
3. Single-line subjects optically mid-align with the icon row via the same formula.
4. Leading subjects (above the bottom row) are unchanged.
5. `.youtubemeta` mid-aligns inside the host.
6. Card `padding-bottom` ≈ 10px under the icon row.

## What NOT to do

- Flex-wrap that places the island **between** subject lines.
- Forcing last subject beside a too-wide island (crush / overlap) — stack instead.
- Putting **every** multi subject full-width above the island even when coexistence fits (loses bottom-row coexistence).
- Fixed island widths / `nth-of-type` left offsets / hardcoded button-count breakpoints.
- Extra left margin on the icon host (use `margin-right: auto` only so a wrapped island stays flush left).
- Squeezing the 25px icon `margin-right`.
- `min-height: icon-row` on subjects (uneven gaps).

---

## Permutation matrix / verification checklist

Use the [static fixture](./public-card-footer.html) first, then preview.

### Must be true

| Rule | Pass |
|------|------|
| Icons flush left with description | ☐ |
| All service icons one mid-line | ☐ |
| Island **never** between subject lines | ☐ |
| Leading subjects full width above bottom row | ☐ |
| Last/only subject **beside** island when room (≥ min-width) | ☐ |
| When island too wide: **all subjects above**, island alone below — no overlap | ☐ |
| Subject column ≥ `--public-card-subject-min` when coexisting | ☐ |
| Tiny last/only subject does **not** shrink below min-width when coexisting | ☐ |
| Long / very long last/only may wrap when coexisting — or stack above if crushed | ☐ |
| Coexisting multi-line last subject: icon mid ↔ **last-line** mid | ☐ |
| ~8px under description · ~10px card bottom | ☐ |
| Uniform ~6px gaps between leading subjects | ☐ |

### Subjects × services

| # | Subjects | Buttons | Expect |
|---|----------|---------|--------|
| A | 0 | YT + Share | Island only |
| B | 1 **short** | YT + Share | Bottom row coexist; last-line mid ↔ icon mid |
| C | 1 **long** | YT + Spotify + Apple + Share | Coexist if room (wrap OK); else stack above; last-line mid when beside |
| C2 | 1 **tiny** | YT + Share | Bottom row; column still ≥ min-width |
| C3 | 1 **very long** | YT + Spotify + Apple + Share | Coexist/wrap or stack; never one-word crush beside island |
| D | 2× **medium** | YT + Share | Leading above; **last beside icons** when room |
| D2 | 3× **medium** (dup mid) | YT + Share | First two above; **last beside icons**; uniform gaps |
| D3 | 2× **very long** | many | Leading above; last beside or stack if crushed |
| D4 | **very long** leading + **short** last | many | Leading above; short last beside when room |
| D5 | **tiny** leading + **long** last | YT + Share | Leading above; long last beside ≥ min-width when room |
| D6 | **short** + **medium** + **long** | YT + Spotify + Share | Mixed lengths; only last on bottom row when room |
| E | 2× **medium** | YT only | Same coexist; narrow island |
| F | 2× **medium** | YT…BBC…IA…Share | **Wide island → subjects above, island below**; no overlap |
| G | 1 **medium** | YT + Spotify + Apple | Bottom row coexist when room |
| H | 1 **long** + youtube-stats | YT + meta + … | Stack above if stats island too wide; else coexist ≥ min-width |
| H2 | 1 **tiny** + youtube-stats | YT + meta | Coexist ≥ min-width or stack |
| I | 2× **medium** + youtube-stats | YT + meta + Share | Leading above; last beside or stack |

**Live check owed:** H/H2/I with real Discovery Members/Views.

---

## DevTools

1. 2+ subjects: every non-last `.subject` bottom ≤ icon host top; last `.subject` either shares the icon host mid-line (last-line mid) or sits fully above the island.
2. When coexisting: last/only subject width ≥ `--public-card-subject-min`; no overlap with island.
3. When stacked: last subject bottom ≤ icon host top; island alone on bottom row, flush left.
4. Description left vs first icon left — same inset.
5. Card bottom − icon bottom ≈ 10px.

## Where to edit

| Concern | File |
|---------|------|
| Public footer contract | `src/styles.scss` |
| Subject stack (editable X) | `src/app/subjects/subjects.component.sass` |
| This checklist + fixture | `docs/public-card-footer.md`, `docs/public-card-footer.html` |
