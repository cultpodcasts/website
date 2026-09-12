# Streaming icon sources

Prefer **official storefront SVG**. Raster PNG is a last resort when the live
app icon is a photographic / 3D mark with no usable colourful SVG (Disney+
aurora, D+ glossy D, Max O ring).

Do not hotlink CDNs at runtime (SSR + CORS). Check files into `icon-sources/`,
then `npm run generate:svg-icons`. Do not hand-edit `svg-icon-literals.ts`.

## Official SVG tiles

| File | Source |
| --- | --- |
| `channel4-favicon.svg` | `https://www.channel4.com/favicon.svg` (class-based fill inlined) |
| `vimeo-iris.svg` | Vimeo `iris_icon_v_64.svg` on the live apple-touch charcoal |
| `play-suisse-icon.svg` | Play Suisse `ps-icon-with-srg.svg` chevron + plus on the live red tile |
| `itvx-app-icon.svg` | Vector of the live ITVX apple-touch (lime + navy X; no storefront SVG) |

Refresh Channel 4 / Vimeo / Play Suisse by re-downloading the storefront SVG,
keeping geometry, then regenerating.

## Official PNG (no colourful SVG)

Disney+ (`disney-plus-app-icon.png`), D+ (`dplus-app-icon.png`), and Max
(`max-app-icon.png`) are the live apple-touch / bamgrid app icons, resized to
96×96. Max publishes PNG/ICO only (`/dotcom/img/hbomax/apple-touch-icon.png`);
`favicon.svg` is 404. Disney+ `mask-icon` SVG is a monochrome aurora outline —
do not use it for the episode-link tile.

## Simple Icons paths

`paths.json` holds SVG path `d` attributes from [Simple Icons](https://simple-icons.org)
for marks that are already official vector glyphs (Netflix N, Paramount+
mountain). Only keep SI paths that `boxedIcon(...)` still references.

**Max / HBO Max:** do **not** re-add Simple Icons `max`. That glyph is a black
self-boxed rounded square — it disappears on dark episode-link chrome. Product
mark is the live white O ring on black.

## Hand-drawn SVG (matches live apple-touch geometry)

Prime Video (blue + `prime` / `video` + smile), TVNZ+ gradient plus, Play RTS
(`RTS` on `#AF001E`), Fawesome triangles, and the video-host C live in
`generate-svg-icon-literals.mjs`.
