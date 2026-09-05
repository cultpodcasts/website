# Simple Icons path extracts

`paths.json` holds SVG path `d` attributes from [Simple Icons](https://simple-icons.org)
(used by `generate-svg-icon-literals.mjs` to build boxed 24×24 streaming marks).

Refresh a slug (example ITVX from jsDelivr):

```powershell
Invoke-WebRequest "https://cdn.jsdelivr.net/npm/simple-icons@v16/icons/itvx.svg" -OutFile itvx.svg
# then extract `<path d="…">` into paths.json under the matching key
```

Missing brands (Disney+, discovery+, Fawesome, TVNZ+, Play Suisse, Prime Video smile)
are hand-drawn in the generator — not listed here.
