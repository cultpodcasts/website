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
2. **Prepare** (when implemented) owns HTML fetch; membership does not scrape.
3. **Submit** uses server-side prefetched meta after prepare — client does not POST HTML/meta.
4. Spotify / Apple / YouTube stay on existing podcast-service flows (APIs) — out of this contract.

## Tests / fakes

| Artifact | Role |
|----------|------|
| `streaming-submit-contract.business-rules.spec.ts` | Consumer locks permutations from the copied fixture |
| `e2e/submit-url-flows/fake-api.ts` | Merges `streamingLookupByUrl` for streaming specimen URLs |
| `submit-url-contract.ts` | Existing actor/D1 case table (separate; keep in sync via its own assert) |

## Related

- UX map: [`submit-url-flows.md`](./submit-url-flows.md)
- Design canvases (workspace): `submit-url-itvx-vs-non-itvx`, `submit-url-sequence-diagrams`
