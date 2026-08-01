# Flix UI (apex cutover)

The Flix homepage UI is **production** on **`cultpodcasts.com`** via the Cloudflare Pages project **`website`** (`website-83e.pages.dev`), production branch **`main`**.

## Branch map (Jul 2026 cutover)

| Branch | Role |
|--------|------|
| `main` | Flix UI (was `design/visual-refresh-v1`) |
| `old-ui` | Former production UI (renamed from `main`; preserved, not deleted) |

## `flix.cultpodcasts.com`

Retired as a separate app host. It **301-redirects** to `https://cultpodcasts.com` with path and query preserved (Pages `_redirects` on the parked **`flix`** project; custom domain kept so the redirect origin remains attached).

The **`flix`** Pages project is **parked**: git deployments and preview builds are disabled. Do not delete the project.

## Deploy

```bash
npm run deploy
```

Targets the **`website`** Pages project (apex). There is no `deploy:flix`.

Feature / PR previews build on **`website`** (`*.website-83e.pages.dev`). `old-ui` remains previewable there for emergency comparison.

## Homepage curation (Curator role)

Stored in the API worker `Curated` KV via `GET`/`PUT /hero-curation`:

| Field | UI |
|-------|----|
| `episodeIds` | Star on any rail card; **Manage hero** panel (reorder / remove) |
| `railSubjects` | Pin on subject rail headings; **Manage rails** panel (reorder subjects + relative day slots `n` / `n−1` / …; days cannot be removed) |

Pinned rails that drop below the week's episode threshold fall out. Only pinned subjects appear as rails — there is no popularity autofill. Hero picks that leave the current week prune the same way.

## Auth0 / API (soak)

Keep `https://flix.cultpodcasts.com` (and `*.flix-ac4.pages.dev` if still used) on production Auth0 allowlists and API `AllowedOrigins` during soak; remove in a later cleanup once traffic has moved fully to the apex.
