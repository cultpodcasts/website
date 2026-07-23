# Zoneless readiness (cultpodcasts)

**Status (Jul 2026):** Not ready to drop `zone.js`. Stay on `provideZoneChangeDetection` until the checklist below is done.

Angular 22 marks legacy Zone-dependent components with `ChangeDetectionStrategy.Eager` (migration applied). New apps are zoneless by default; this app still opts into Zone.

## Done (prep started)

- [x] Angular / Material **22** upgrade
- [x] Cloudflare Worker `fetch` no longer uses `__zone_symbol__Promise` ([`server.ts`](../server.ts)) — native async Promise return
- [x] ~37 components already `OnPush`; list/API pages use signals
- [x] Angular 22 `Eager` applied to dialogs/send/snackbar components that still rely on Zone CD
- [x] **Wave 1** Eager → OnPush (+ signals where async UI flags): send/* (`add/edit-episode-send`, `add/edit-podcast-send`, `edit-person-send`, `edit-subject-send`), snackbars (`episode-publish-response`, `submit-url-origin-response`), `publish-homepage`, `run-search-indexer`, `privacy-policy`, `terms-and-conditions`
- [x] **Wave 2** remaining Eager → OnPush (+ signals): form dialogs (`add/edit-episode`, `add/edit-podcast`, `post-episode`, `edit-person`, `edit-subject`), thin dialogs (`send/submit-podcast`, `delete-episode`, `rename-podcast`, `manual-tweet`, `add-term`, `podcast-index`), `discovery-submit`, `discovery-schedule`, `podcast-episode`
- [x] **API-page plain-field → signals**: podcast/search/subject/outgoing/episodes/bookmarks (template-bound query/sort/filter/heading/name/error state)
- [x] **Auth0 / discovery poll**: `podcast-episode` + `PodcastsService` no longer cache auth in plain fields; `DiscoveryInfoService` roles via `toSignal` (toolbar already `toSignal(discoveryInfo)`)

## Before flipping zoneless

Do **not** call `provideZonelessChangeDetection()` or remove `zone.js` from [`angular.json`](../angular.json) / [`package.json`](../package.json) until:

1. **Eager → OnPush + signals** — **done** (no remaining `ChangeDetectionStrategy.Eager` in `src/app`).
2. **OnPush plain-field async writes** — **done** for list/API pages: podcast/search/subject/outgoing/episodes/bookmarks use signals for template-bound async state (`sortDirection`, filters, headings, names, etc.).
3. **Auth0** — **mostly done**: components use `toSignal(auth.roles)` / `toSignal(auth.isSignedIn)` / `async` pipe (toolbar); `PodcastsService` reads auth at call time via `firstValueFrom`. `AuthServiceWrapper` still bridges Auth0 → ReplaySubjects (fine).
4. **Polling** — **done**: `DiscoveryInfoService` uses `toSignal` for roles; toolbar already binds via `toSignal(discoveryInfo)`.
5. **Regression** — code audit **done** (Jul 2026); complete the smoke checklist below on Zone first, then flip.

### Regression smoke checklist (manual)

Code review notes: infinite scroll uses CDK `ScrollDispatcher` + signal updates; homepage uses `@HostListener` + `grouped.set`; drag-drop / SW share path use signals / dialogs; slot-machine uses OnPush + `columns` signal + `setTimeout`. No CDK `DragDrop` module.

On **preview** (still Zone), verify:

- [ ] Homepage loads; slot-machine counter animates (or respects reduced motion)
- [ ] Homepage infinite scroll loads more episodes near bottom
- [ ] Search / podcast / subject pages: infinite scroll appends results
- [ ] Material dialogs open/close (edit episode, post episode, manual tweet, submit podcast)
- [ ] Drag URL onto page → submit dialog (general + podcast-page target if Curator)
- [ ] Service-worker share message still opens submit (Android/share target if available)
- [ ] Discovery badge updates for Curator (~60s poll or after discovery submit refresh)
- [ ] SSR/prerender: homepage / privacy / terms render without console Zone errors
- [ ] Tweet icon → manual-tweet dialog (auth interceptor fix)

When all checked, proceed to **Flip steps**.

## Flip steps (later)

1. Replace `provideZoneChangeDetection({ eventCoalescing: true })` with `provideZonelessChangeDetection()` in [`app.config.ts`](../src/app/app.config.ts).
2. Remove `zone.js` from `angular.json` polyfills (app + test) and uninstall the package.
3. Ensure `TestBed` uses zoneless (or no `zone.js` polyfill) and `await fixture.whenStable()`.
4. Smoke local + production build + `npm run process` + Pages SSR (re-run checklist above under zoneless).

## Related

- [code-quality-audit-phase1.md](./code-quality-audit-phase1.md) — older OnPush/signals notes (partially outdated; OnPush count has grown)
