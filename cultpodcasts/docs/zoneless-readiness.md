# Zoneless readiness (cultpodcasts)

**Status (Jul 2026):** **Zoneless enabled.** App uses `provideZonelessChangeDetection()`; `zone.js` removed from polyfills and dependencies.

Angular 22 marks legacy Zone-dependent components with `ChangeDetectionStrategy.Eager` (migration applied). This app completed Eager → OnPush + signals prep, then flipped.

## Done

- [x] Angular / Material **22** upgrade
- [x] Cloudflare Worker `fetch` no longer uses `__zone_symbol__Promise` ([`server.ts`](../server.ts)) — native async Promise return
- [x] ~37+ components `OnPush`; list/API pages use signals
- [x] **Wave 1–2** Eager → OnPush (+ signals)
- [x] **API-page plain-field → signals**: podcast/search/subject/outgoing/episodes/bookmarks
- [x] **Auth0 / discovery poll**: `toSignal` / call-time auth; `DiscoveryInfoService` roles via `toSignal`
- [x] Hotspot audit (scroll / SW share / drag / slot-machine) — signal-friendly
- [x] **Flip**: `provideZonelessChangeDetection()`; remove `zone.js` polyfills + package; TestBed uses zoneless

## Regression smoke (Zone, before flip)

Verified on preview (read-only where possible — preview uses production data):

- [x] Homepage loads; slot-machine present
- [x] Homepage infinite scroll loads more episodes
- [x] Search infinite scroll appends results
- [x] Material dialogs open/close (edit episode, manual tweet)
- [x] SSR content page: privacy policy renders (build `882953c`)
- [x] Tweet icon → manual-tweet dialog; Tweet link `target="_blank"` + `rel="noopener noreferrer"`
- [ ] Drag URL / SW share / discovery badge poll timing — not fully exercised (avoid prod writes)

## After flip

1. Preview build succeeds without `zone.js`.
2. Re-smoke homepage, search scroll, dialogs, tweet → manual dialog (read-only: open dialog only; do not clear/remove/delete production flags).
3. Watch for stale UI after async updates (OnPush + missing `.set()` / signal updates).

## Flip steps (completed)

1. Replace `provideZoneChangeDetection` with `provideZonelessChangeDetection()` in [`app.config.ts`](../src/app/app.config.ts).
2. Remove `zone.js` from [`angular.json`](../angular.json) polyfills (app + test) and uninstall the package.
3. TestBed: `provideZonelessChangeDetection()` in specs that configure Angular testing modules.

## Related

- [code-quality-audit-phase1.md](./code-quality-audit-phase1.md) — older OnPush/signals notes (partially outdated)
- [dependency-updates.md](./dependency-updates.md) — package bump notes
