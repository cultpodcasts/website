# Episode OG / Twitter share image

Episode pages can use artwork from page-details (shortener KV / search) for
`og:image` and `twitter:image` instead of the site icon.

## Feature switch (default OFF)

| Switch | Location | Default |
|--------|----------|---------|
| `FeatureSwitch.episodeOgShareImage` | [`feature-switch.enum.ts`](../src/app/feature-switch.enum.ts) / [`feature-switch-service.ts`](../src/app/feature-switch-service.ts) | **`false`** |

When OFF, SEO keeps `/assets/sq-image.png` and `twitter:card=summary` even if
page-details returns `image` / `imageAspect`.

When ON, SSR uses page-details image (Api `/og-image` branded URL when present)
and may set `summary_large_image` for wide art.

## Dependencies

- **Api** creates shortener KV share-image metadata on `/pagedetails` miss and
  exposes `/og-image` (shipped with Api worker; not gated by this client switch).
- **Indexer** may write the same metadata when posting (short-URL-only social
  posts are separately gated in RedditPodcastPoster config).

## Preview test plan (ON and OFF)

Deploy website **preview** against Api **preview** that includes share-image
page-details.

### OFF (default — production-safe)

1. Leave `FeatureSwitch.episodeOgShareImage` = `false`.
2. Open an episode page on the preview host (View Source / curl SSR HTML).
3. Expect `og:image` → site icon (`…/assets/sq-image.png`).
4. Expect `twitter:card` → `summary`.

### ON (preview-only flip)

1. Temporarily set `FeatureSwitch.episodeOgShareImage` → `true` in
   `feature-switch-service.ts`, deploy preview only (do not flip production).
2. Open an episode that has shortener KV art (or trigger page-details miss so
   Api creates KV from search).
3. Expect `og:image` / `twitter:image` → episode art (often Api `/og-image?…`).
4. Wide YouTube-style art → `twitter:card=summary_large_image`.
5. Revert switch to `false` before production release unless intentionally
   enabling the feature.

## Config / secrets

No new Pages env vars for the switch itself (compile-time FeatureSwitch).
Api may need CF Images / existing Worker bindings already documented for
`/og-image` — list any **new** secret names in the Api PR body under
`## Config / secrets` for preview **and** production.

PR bodies **must** keep a `## Config / secrets` section (names only). At
production switchover, read that section and confirm sibling Api / RPP config
checklists before enabling this switch in a production build.

## Production switchover checklist

1. [ ] Website PR `## Config / secrets` reviewed (usually N/A for this switch)
2. [ ] Api PR: `/og-image` + shortener bindings confirmed on **api-preview** and top-level **`api`**
3. [ ] RPP PR: `twitter__ShortUrlOnlyWhenShareImage` /
       `bluesky__ShortUrlOnlyWhenShareImage` present on Function Apps (leave **`false`**
       until short-URL-only social posts are intentionally enabled)
4. [ ] Ship website with `FeatureSwitch.episodeOgShareImage` = **`false`** unless
       intentionally enabling SEO episode art in production
5. [ ] Only after preview ON path validated: flip client switch and/or RPP short-URL-only flags
