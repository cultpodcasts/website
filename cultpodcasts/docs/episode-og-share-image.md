# Episode OG / Twitter share image

Episode pages can use episode artwork for `og:image` and `twitter:image`
instead of the site icon.

## Feature switch (default ON)

| Switch | Location | Default |
|--------|----------|---------|
| `FeatureSwitch.episodeOgShareImage` | [`feature-switch.enum.ts`](../src/app/feature-switch.enum.ts) / [`feature-switch-service.ts`](../src/app/feature-switch-service.ts) | **`true`** |

When ON, SSR prefers shortener page-details image (Api `/og-image` branded URL
when present) and sets `twitter:card=summary_large_image` for both wide and
square episode art (`summary` only for the site-icon fallback).

When page-details has no `image` (common for streaming-only episodes), SSR
enriches from search via the same `episodeImageUrl` / `episodeArtAspect` path as
the episode hero, with HTML-entity decode (`&amp;` → `&`) so crawler meta matches
a usable CDN URL. On a full KV miss, SSR also uses search for title / release /
duration (`pageDetailsFromSearchEpisode`).

When OFF (rollback), SEO keeps `/assets/sq-image.png` and
`twitter:card=summary` even if page-details or search returns `image` /
`imageAspect`.

## Dependencies

- **Api** creates shortener KV share-image metadata on `/pagedetails` miss and
  exposes `/og-image` (shipped with Api worker; not gated by this client switch).
- **Indexer** may write the same metadata when posting (short-URL-only social
  posts are separately gated in RedditPodcastPoster config).

## Preview test plan (ON and OFF)

Deploy website **preview** against Api **preview** that includes share-image
page-details.

### ON (current default)

1. Confirm `FeatureSwitch.episodeOgShareImage` = `true`.
2. Open an episode that has shortener KV art (or trigger page-details miss so
   Api creates KV from search).
3. Expect `og:image` / `twitter:image` → episode art (often Api `/og-image?…`).
4. Expect `twitter:card=summary_large_image` for wide and square episode art.
5. For streaming-only art with no KV image: expect SSR `og:image` from search
   CDN art (decoded entities), matching the hero.

### OFF (rollback)

1. Temporarily set `FeatureSwitch.episodeOgShareImage` → `false` in
   `feature-switch-service.ts`, deploy preview only.
2. Open an episode page on the preview host (View Source / curl SSR HTML).
3. Expect `og:image` → site icon (`…/assets/sq-image.png`).
4. Expect `twitter:card` → `summary`.
5. Revert switch to `true` before production release unless intentionally
   rolling back.

## Config / secrets

No new Pages env vars for the switch itself (compile-time FeatureSwitch).
Api may need CF Images / existing Worker bindings already documented for
`/og-image` — list any **new** secret names in the Api PR body under
`## Config / secrets` for preview **and** production.

PR bodies **must** keep a `## Config / secrets` section (names only). At
production switchover, read that section and confirm sibling Api / RPP config
checklists.

## Production checklist

1. [ ] Website PR `## Config / secrets` reviewed (usually N/A for this switch)
2. [ ] Api PR: `/og-image` + shortener bindings confirmed on **api-preview** and top-level **`api`**
3. [ ] RPP PR: `twitter__ShortUrlOnlyWhenShareImage` /
       `bluesky__ShortUrlOnlyWhenShareImage` present on Function Apps (leave **`false`**
       until short-URL-only social posts are intentionally enabled)
4. [ ] Ship website with `FeatureSwitch.episodeOgShareImage` = **`true`** (current
       default). Set **`false`** only for an intentional SEO rollback.
5. [ ] Preview validates: KV branded `/og-image` path **and** search/`episodeImageUrl`
       fallback when page-details has no image
