# Simple Icons path extracts

`paths.json` holds SVG path `d` attributes from [Simple Icons](https://simple-icons.org)
(used by `generate-svg-icon-literals.mjs` to build boxed 24×24 streaming marks).

Refresh a slug (example ITVX from jsDelivr):

```powershell
Invoke-WebRequest "https://cdn.jsdelivr.net/npm/simple-icons@v16/icons/itvx.svg" -OutFile itvx.svg
# then extract `<path d="…">` into paths.json under the matching key
```

## Hygiene

- Only keep SI paths that the generator still references (`boxedIcon(...)`).
- **Max / HBO Max:** do **not** re-add Simple Icons `max`. That glyph is a black self-boxed
  rounded square — it disappears on dark episode-link chrome. Product mark is hand-drawn
  stacked light `HBO` (O with inner circle) / `max` on a near-black `rx=5.4` tile in the
  generator.

## Official storefront PNGs

Disney+ (`disney-plus-app-icon.png`) and D+ (`dplus-app-icon.png`) are the live
apple-touch / bamgrid app icons, resized to 96×96. The generator embeds them as
data URIs inside the shared 24×24 rounded clip — do not hotlink the CDN at runtime
(SSR + CORS). Refresh by downloading the current apple-touch, resizing, then
`npm run generate:svg-icons`.

## Hand-drawn (not in paths.json)

Fawesome, TVNZ+ (gradient plus), Play Suisse (`>+` on dark), Amazon Prime
(navy + `prime` + cyan smile), and HBO Max (see above) live in
`generate-svg-icon-literals.mjs` — edit there, then `npm run generate:svg-icons`.
