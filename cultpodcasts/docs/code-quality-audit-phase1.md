# Angular (cultpodcasts) — Phase 1 Identify

Identify-only debt board for Project B. No Wave 1–3 fixes applied.

**Scorecard:** `value = (prod_risk × change_freq × confidence_gain) / effort_n`  
Factors are integers 1–5. Effort column is S/M/L with numeric denominator **S=1, M=3, L=5**.

---

## Hypotheses confirmed / refuted

| Plan hypothesis | Verdict | Evidence |
|-----------------|---------|----------|
| Angular 21 + modern `@if`/`@for`, SSR on Cloudflare | **Confirmed** | `package.json`: `@angular/core` `^21.0.6`; templates across `src/app/**` use control flow; `wrangler pages` scripts + `@angular/ssr` |
| ~3 util Karma specs, no e2e | **Confirmed** | Exactly **3** `*.spec.ts`: `search-result-links.spec.ts`, `search-description.spec.ts`, `subject-language-filter.spec.ts`. No Playwright / e2e config or deps |
| Duplicated `*-send` / auth token boilerplate | **Confirmed (counts refined)** | **6** `*-send` components (near-identical spinner + bearer POST). **`getAccessTokenSilently` ×38** call sites across ~32 files (plan said ~29). `EpisodeUpdateService` centralizes auth for list toggles only; dialogs still open `*-send` |
| Add/edit episode & podcast dialog pairs | **Confirmed** | `add-episode-dialog` ~541 LOC / `edit-episode-dialog` ~506 LOC nearly twin FormGroups; `add-podcast-dialog` ~419 / `edit-podcast-dialog` ~376 |
| Almost no signals / OnPush | **Mostly confirmed (nuance)** | **OnPush: 0**. **`takeUntilDestroyed`: 0**. **`computed`: 0**. `signal()` used in **5** files (list APIs + bookmark timer). Signal `input()` essentially **only** `bookmark.component.ts`. Templates already modern |
| Hybrid `app-routing.module.ts` + `importProvidersFrom` | **Confirmed (stronger)** | `AppRoutingModule` still wraps `RouterModule.forRoot(routes)` **and** `app.config.ts` also calls `provideRouter(routes)` + `importProvidersFrom(AppRoutingModule)` — dual registration |
| `FeatureSwtichService` / `scrollDisplatcher` typos; stale README CLI 16; unused `FormBuilder` | **Confirmed** | Class name `FeatureSwtichService`; ctor param `scrollDisplatcher` in search/podcast/subject/bookmarks APIs; `README.md` still says CLI **16.2.1**; `private fb: FormBuilder` in `add-episode-dialog` + `edit-subject-dialog` with **no** `this.fb` usage |
| `rename-podcast-dialog` `tokenCtr` hack; mixed forms; `console.log` in submit paths | **Confirmed** | `tokenCtr++ > 1` gate; `ngModel` still in rename/add-term/outgoing/discovery-schedule/set-number-of-days vs reactive episode/podcast dialogs; multiple `console.log` in curator flows |

---

## Top 10 findings (ranked by value)

| # | lens | finding | evidence path(s) | prod_risk | change_freq | confidence_gain | effort | value | wave | fix type |
|---|------|---------|------------------|-----------|--------------|-----------------|--------|-------|------|----------|
| 1 | missing behavior tests | No Playwright (or other) journey coverage for curator/auth/public hot paths; only 3 pure-util Karma specs | `src/app/*.{spec.ts}` (3 files); `package.json` (no Playwright); critical surfaces: `discovery-api/`, `has-role.guard.ts`, `is-user.guard.ts`, `edit-episode-dialog/`, `search-api/`, `bookmarks-api/`, `bookmark/` | 5 | 5 | 5 | M (3) | **41.7** | 2 | Add Playwright harness + smoke journeys (see map below); keep Karma for pure utils |
| 2 | badly written | `ScrollDispatcher.scrolled()` subscribed without teardown on infinite-scroll list pages (leak / duplicate handlers on revisit) | `search-api.component.ts`, `podcast-api.component.ts`, `subject-api.component.ts`, `bookmarks-api.component.ts` (`scrollDisplatcher.scrolled().subscribe`) | 3 | 3 | 4 | S (1) | **36.0** | 1 | Unsubscribe / `takeUntilDestroyed` / single shared scroll strategy subscription |
| 3 | code smell | Auth0 bearer header assembled inline ~38×; no auth HTTP interceptor / shared client | `getAccessTokenSilently` across e.g. `discovery-api`, `*-send/*`, `*-dialog/*`, `profile.service.ts`, `episode-update.service.ts` (`getAuthHeaders`); existing interceptors only `json-date` / `json-url` in `app.config.ts` | 4 | 5 | 4 | M (3) | **26.7** | 3 | Functional auth interceptor (or extend `EpisodeUpdateService` pattern to all authenticated HTTP) |
| 4 | badly written | `rename-podcast-dialog` uses `tokenCtr` gate + nested `firstValueFrom`+`.then` anti-pattern; fragile admin rename | `rename-podcast-dialog.component.ts` (tokenCtr ~L46–56) | 3 | 2 | 4 | S (1) | **24.0** | 1 | Async/await + shared auth headers; drop tokenCtr |
| 5 | code smell | Six near-clone `*-send` spinner dialogs still used for episode/podcast/subject/person writes; service extraction only started for list episode toggles | `add-episode-send/`, `edit-episode-send/`, `add-podcast-send/`, `edit-podcast-send/`, `edit-subject-send/`, `edit-person-send/`; contrast `episode-update.service.ts` used by `episodes-api` / `outgoing-episodes-api` | 3 | 4 | 4 | M (3) | **16.0** | 3 | Collapse to services + one generic progress dialog (or MatDialog data + shared sender) |
| 6 | code smell | Add/edit episode (and podcast) dialogs are large near-duplicates (~500+ / ~400 LOC) sharing identical FormGroup shape | `add-episode-dialog.component.ts` + `.html`; `edit-episode-dialog.component.ts` + `.html`; `add-podcast-dialog/*`; `edit-podcast-dialog/*` | 4 | 4 | 4 | L (5) | **12.8** | 3 | Shared form model/component after Playwright episode save exists |
| 7 | badly written | `console.log` left in curator/API submit and list paths (noise + possible PII in bookmarks) | e.g. `toolbar.component.ts`, `bookmarks-api.component.ts`, `discovery-submit.component.ts`, `edit-subject-dialog.component.ts`, `podcast-index.component.ts`, `manual-tweet-episode-dialog.component.ts` | 2 | 3 | 2 | S (1) | **12.0** | 1 | Remove or gate behind dev logging |
| 8 | unused framework features | Angular 21 modernity gap: **0** `OnPush`, **0** `takeUntilDestroyed`, almost no signal `input()`/`computed`; Zone default CD on fat list/dialog trees | 65 `*.component.ts`; signals only in list APIs + `bookmark.component.ts`; `provideZoneChangeDetection` in `app.config.ts` | 2 | 4 | 3 | M (3) | **8.0** | 3 | Incremental OnPush + `takeUntilDestroyed` when touching list/API components; prefer signal inputs on new/edited comps |
| 9 | technical debt | Dual router bootstrap: NgModule `RouterModule.forRoot` **and** `provideRouter(routes)` | `app-routing.module.ts`; `app.config.ts` (`importProvidersFrom(AppRoutingModule)` + `provideRouter(routes)`) | 2 | 2 | 3 | M (3) | **4.0** | 3 | Drop `AppRoutingModule`; keep `routes` + `provideRouter` only |
| 10 | technical debt | Naming typos + dead DI + stale README (cheap hygiene that confuses agents/humans) | `feature-switch-service.ts` (`FeatureSwtichService`); `scrollDisplatcher` in `*-api` ctors; unused `FormBuilder` in `add-episode-dialog`, `edit-subject-dialog`; `README.md` “CLI version 16.2.1” | 1 | 2 | 2 | S (1) | **4.0** | 1 | Rename when touching files; delete unused `fb`; refresh README to Angular 21 / local ports |

*Strategic note:* Auth interceptor (#3) and dialog/`*-send` refactors (#5–6) unlock more work than their mid-table scores imply — do them in Wave 3 **after** Playwright (#1).

---

## Playwright journey map

No e2e harness today. Proposed behavior tests (Playwright), ordered by unlock value:

| Journey | Entry / surfaces | Risk if broken | Suggested coverage |
|---------|------------------|----------------|--------------------|
| **Discovery curation** | `/discovery` → `hasRoleGuard` (`Curator`) → `DiscoveryApiComponent` load → select items → `DiscoverySubmitComponent` POST | High — curator pipeline silent-fail / bad submit | Auth as Curator; results render; filter toggles; submit success/error UI; unauthorized redirect |
| **Auth / role gates** | `has-role.guard.ts`, `is-user.guard.ts`, routes in `app-routing.module.ts` (`discovery`, `episodes`, `outgoingEpisodes`, `bookmarks`, `unauthorised`) | High — privilege leakage or false lockout | Anonymous → `/unauthorised`; user without Curator blocked from discovery; authenticated user reaches bookmarks |
| **Episode save** | Open `EditEpisodeDialog` / `AddEpisodeDialog` → `EditEpisodeSend` / `AddEpisodeSend` POST `/episode/...` | High — data corruption / lost edits | Load form; change field; submit spinner; success close; API error path |
| **Search facets + infinite scroll** | `SearchApiComponent` facets chips + `ScrollDispatcher` paging; also podcast/subject variants | Medium — wrong filters / duplicate pages / stuck loading | Query → facet chip filter → URL/state; scroll loads next page once; no duplicate subscribe storm |
| **Bookmarks** | `BookmarkComponent` + `ProfileService` + `/bookmarks` → `BookmarksApiComponent` | Medium — lost bookmarks / auth scope bugs | Toggle bookmark when signed in; list page shows episode; remove |

**Existing tests (keep):** Karma/Jasmine util specs only — URL/image helpers, search description truncation, subject language filter builders. Do **not** expand component unit-test theater; put new confidence in Playwright.

---

## Lens coverage checklist

| Lens | Represented in top 10 |
|------|------------------------|
| 1. Code smells | #3 auth clones, #5 `*-send`, #6 add/edit dialogs |
| 2. Technical debt | #9 dual router, #10 typos / FormBuilder / README |
| 3. Badly written | #2 scroll leaks, #4 tokenCtr, #7 console.log |
| 4. Unused framework features | #8 OnPush / signals / `takeUntilDestroyed` |
| 5. Missing behavior tests | #1 Playwright journeys |

---

## Suggested wave mapping (Angular only)

| Wave | Items from this board |
|------|------------------------|
| **1** Quick wins | #2 scroll teardown, #4 rename-podcast rewrite, #7 strip console.log, #10 typos/FormBuilder/README |
| **2** Behavior harness | #1 Playwright: discovery + episode save first, then auth gates, search facets, bookmarks |
| **3** Structural | #3 auth interceptor, #5 collapse `*-send`, #6 dialog dedupe, #8 OnPush/`takeUntilDestroyed`, #9 drop NgModule router shell |

Stop after each wave for review before structural refactors.
