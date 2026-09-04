# Streaming submit orchestration (website)

Client rules for streaming catalogue URL ingest. **Canonical wire contract and process** live in the Api repo:

- [`Api/docs/streaming-submit-orchestration.md`](../../../Api/docs/streaming-submit-orchestration.md)
- Fixture (copy): [`src/app/streaming-submit-contract.ts`](../src/app/streaming-submit-contract.ts) ← `Api/tests/fixtures/streaming-submit-contract.ts`

Assert:

```powershell
# from website git root
pwsh ./scripts/assert-streaming-submit-contract-copy.ps1
```

## What the SPA must honour

1. **Lookup** returns streaming `service` (`ServiceKeys` string). Do not invent a parallel provider enum.
   The SPA may re-export `StreamingServiceKey` as `SubmitUrlStreamingService`; do not duplicate the literal list.
2. **Prepare** — after unknown streaming lookup, SPA calls `POST /submit/prepare` (`SubmitUrlPrepareService`). Worker owns HTML fetch (BR or Azure prepare); membership does not scrape.
3. **Submit** uses server-side prefetched meta after prepare — client does not POST HTML/meta.
4. Spotify / Apple / YouTube stay on existing podcast-service flows (APIs) — out of this contract.

Gate: `shouldCallSubmitUrlPrepare` in `submit-ingest-ux.ts` (unknown streaming only). Wired from general drop (`app.component`) and Add Podcast (`submit-podcast.component`).

## Tests / fakes

| Artifact | Role |
|----------|------|
| `streaming-submit-contract.business-rules.spec.ts` | Consumer locks permutations from the copied fixture; bridges bodies to `SubmitUrlLookupResponse`; smokes fake-api merge for URLs only in `streamingLookupByUrl` (e.g. itvx) |
| `e2e/submit-url-flows/fake-api.ts` | Merges `streamingLookupByUrl`; handles `POST /submit/prepare` |
| `submit-url-prepare.service.spec.ts` | Prepare HTTP POST + auth scope |
| `submit-ingest-ux.spec.ts` | `shouldCallSubmitUrlPrepare` arms |
| `submit-url-contract.ts` | Existing actor/D1 case table (separate; keep in sync via its own assert) |

## Assert script (local / sibling Api)

`pwsh ./scripts/assert-streaming-submit-contract-copy.ps1` is sibling-local (parity with `assert-submit-url-contract-copy.ps1`). **CI does not run this** — it needs a sibling Api checkout. Workflow `cultpodcasts-tests.yml` includes `scripts/**` in `paths:` so script edits still trigger `test:all`.

## Related

- UX map: [`submit-url-flows.md`](./submit-url-flows.md)
- Design canvases (workspace): `submit-url-itvx-vs-non-itvx`, `submit-url-sequence-diagrams`
