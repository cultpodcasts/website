---
name: add-streaming-service
description: >-
  Mirror a new streaming ServiceKey in website service-catalog, URL matcher,
  icon, and streaming-submit-contract copy. Use with RedditPodcastPoster
  add-streaming-service skill, or when the user asks to add a streaming service
  / scraper / new *.tv URL on the client.
---

# Add streaming service (website)

Full plugin procedure: sibling RPP skill

`cultpodcasts/RedditPodcastPoster/.cursor/skills/add-streaming-service/SKILL.md`

Api owns the contract TS source: `Api/tests/fixtures/streaming-submit-contract.ts`.

## When to use

- New streaming key needs SPA catalog / submit regex / icon parity
- User says add-streaming-service

## Steps (this repo)

1. Copy Api contract TS → `cultpodcasts/src/app/streaming-submit-contract.ts` (byte-identical).
2. `cultpodcasts/src/app/service-catalog.ts`:
   - `SERVICE_CATALOG` row (`key` must be a `StreamingServiceKey` / `KnownServiceKey`)
   - `resolveServiceKey` host branch (return the wire key literal)
   - Keep catalog streaming keys ≡ `streamingServiceKeys` (spec enforces set equality)
3. `cultpodcasts/src/app/podcast-url-matcher.ts` — series + episode regex (streaming kind).
4. `cultpodcasts/tools/icon-sources/paths.json` — path data for `icon` slug; regenerate if the icon pipeline requires it.
5. Update `service-catalog.spec.ts` / matcher specs.
6. Bump `cultpodcasts/package.json` + lockfile patch when shipping client code.
7. Assert: from website git root `pwsh ./scripts/assert-streaming-submit-contract-copy.ps1`
8. Before push: `cd cultpodcasts && npm run test:all`

Do **not** invent a parallel PascalCase streamer enum — wire strings are the enum (`StreamingServiceKey`).

## Safety

- Never `wrangler pages deploy` / `npm run deploy` unless user names that exact deploy
- Never merge PRs
- Do not fork streamer enums — copy from Api fixture

## Related

- `cultpodcasts/docs/submit-url-flows.md`
- `cultpodcasts/docs/streaming-submit-orchestration.md` (if present) / Api orchestration doc
