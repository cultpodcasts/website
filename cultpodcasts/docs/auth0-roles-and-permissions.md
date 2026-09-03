# Auth0 roles and permissions

Authoritative map of Cult Podcasts Auth0 **roles** (ID token) and **permissions** (access token) across the Angular SPA, Cloudflare API Worker, and Azure `api-infra` Functions.

**Audience:** agents and developers changing auth gates, submit flows, curation UI, or API proxies.

## Overview

Cult Podcasts uses Auth0 RBAC with two parallel claim surfaces:

| Surface | Where read | Claim | Used for |
|---------|------------|-------|----------|
| **Roles** | ID token (SPA `user$`) | `https://api.cultpodcasts.com/roles` — string array | **Website UI only** — route guards, toolbar menus, template `@if` gates |
| **Permissions** | Access token (Bearer JWT) | `permissions[]` and/or space-delimited OAuth `scope` | **Worker** (`hasPermission`) and **Azure** (`ClientPrincipal.HasScope`) |

Roles and permissions are assigned in Auth0 (API `https://api.cultpodcasts.com/`). Typical pairings:

| Auth0 role | Typical permissions | Notes |
|------------|---------------------|-------|
| **Submitter** | `submit` | URL ingest only — no curation UI |
| **Curator** | `curate` (often also `submit`) | Discovery, episode/podcast/subject curation |
| **Admin** | `admin` (often also `curate`) | Operational tools — indexer, homepage publish, title rules, languages, discovery schedule, episode delete |

The SPA requests all API scopes at login (`app.config.ts`):

```text
openid profile email offline_access curate admin submit
```

Per-request calls may request a **subset** via `getAccessTokenSilently({ authorizationParams: { scope } })` or the `AUTH_SCOPE` HTTP context token (`auth.interceptor.ts`).

**Important:** Backend code never reads the ID-token roles claim. A user with role `Curator` but no `curate` permission in the access token will pass UI guards yet get **403** from the Worker/Azure. Conversely, permissions without matching UI role checks may reach APIs but stay hidden in the client.

---

## Summary table

| Role (ID token) | Typical JWT permissions | UI features gated | Worker routes gated | Azure Functions gated |
|-----------------|---------------------------|-------------------|----------------------|------------------------|
| *(signed out)* | — | Public browse; Add Podcast / drop → D1 queue only | `POST /submit` → D1; no lookup | — |
| **Submitter** | `submit` | Submit URL flows (Add Podcast, drop/share, lookup). Series picker remains Curator-only. | `GET /submit/lookup`, Azure `POST /submit` when JWT has `submit` or `curate` | `GET/POST api/SubmitUrl` — `submit` **or** `curate` |
| **Curator** | `curate` (+ often `submit`) | Discovery, Review Episodes, Outgoing, Curate menu, hero pin/promote, episode/subject/podcast edit affordances, Series picker on submit | All `curate`-gated proxies; submit/lookup when `canCallAzureSubmitBackend` passes (**today:** `curate` only) | Episode, Podcast, Subject, Person, DiscoveryCuration, Publish, Outgoing, … — `curate` |
| **Admin** | `admin` (+ often `curate`) | Admin menu (indexer, publish homepage, title casing, ignored subjects, supported languages, discovery schedule); push-notification prompt; episode delete affordances | `admin`-gated proxies | Publish, SearchIndex, SupportedLanguages, TitleCasingRules, DiscoverySchedule, PushSubscription, Episode delete, Podcast rename — `admin` |
| *(any signed-in user)* | Valid JWT `sub` (no special permission) | `/bookmarks`, bookmark buttons, profile avatar | `GET/POST/DELETE /bookmark(s)` — authenticated `sub` only | — |

Bookmarks and profile endpoints require **authentication** only — no `submit` / `curate` / `admin` permission.

---

## Permissions (access token)

Checked by `Api/src/hasPermission.ts` (Worker) and `ClientPrincipal.HasScope` (Azure). Both accept `permissions[]` **or** OAuth `scope`.

### `submit`

**Purpose:** Episode URL ingest — queue to Azure Isolated submit backend and read-only URL membership lookup.

| Layer | Gate |
|-------|------|
| **Worker** | `canCallAzureSubmitBackend` → `hasPermission(payload, "submit")` **or** `hasPermission(payload, "curate")` for `GET /submit/lookup` and Azure path of `POST /submit`. |
| **Azure** | `SubmitUrlController` — `GET api/SubmitUrl`, `POST api/SubmitUrl` accept **`curate` OR `submit`** (OR semantics in `HandleRequest`). |
| **UI (target)** | Users with **`Submitter`** role (or `submit` permission) call lookup and get Azure persist on `POST /submit`. Scope: `submit` via `AUTH_SCOPE` / `getAccessTokenSilently`. |

Signed-out and JWT without `submit`/`curate` (per Worker rules): `POST /submit` persists to Worker **D1** only (`{ success: "Submitted" }`, no `X-Origin`).

See [submit-url-flows.md](./submit-url-flows.md) for persist bodies and UX cases.

### `curate`

**Purpose:** Catalogue curation — discovery pipeline, episodes, podcasts, subjects, people, hero curation, publish-to-catalogue.

| Layer | Gate |
|-------|------|
| **Worker** | `proxyToAzure(..., { permission: "curate" })` on curation routes; `heroCuration.ts` uses `hasPermission(..., "curate")`; `getDiscoveryInfo` / `getLanguages` require `curate` (or `admin` for languages). |
| **Azure** | Most catalogue controllers: `EpisodeController`, `PodcastController` (except rename), `SubjectController`, `PersonController`, `DiscoveryCurationController`, `PublishController` (catalogue publish). |
| **UI** | **`Curator`** role via `hasRoleGuard`, toolbar Curate section, `@if (authRoles().includes('Curator'))`. API calls use `AUTH_SCOPE` **`curate`**. |

Does **not** include admin-only ops (search reindex, homepage R2 publish, title-casing CRUD, supported-languages CRUD, discovery schedule, episode delete, podcast rename).

### `admin`

**Purpose:** Operational / configuration mutations.

| Layer | Gate |
|-------|------|
| **Worker** | `permission: "admin"` on `/searchindex/run`, `/publish/homepage`, `/supported-languages*`, `/title-casing-rules/*`, `/discovery-schedule`, `/pushsubscription`, `/podcast/name/:name` (rename), episode **DELETE** routes. |
| **Azure** | `PublishController`, `SearchIndexController`, `SupportedLanguagesController`, `TitleCasingRulesController`, `DiscoveryScheduleController`, `PushSubscriptionController`, `EpisodeController` delete, `PodcastController` rename. |
| **UI** | **`Admin`** role — Admin toolbar menu; `getAccessTokenSilently` with scope **`admin`**. |

---

## Roles (ID token)

Read from `user["https://api.cultpodcasts.com/roles"]` in `AuthServiceWrapper` → `roles` ReplaySubject. Guards and templates use this array; they do **not** inspect JWT permissions directly.

### `Submitter`

**Target product role** for trusted URL contributors who may call Azure submit/lookup but must **not** see curation UI.

| Area | Behaviour |
|------|-----------|
| **UI (target)** | Add Podcast, homepage general drop / share-to-submit; `GET /submit/lookup` when saving ambiguous URLs; `POST /submit` with Azure response + optional post-submit episode dialogs. **No** podcast-page attach drop (Curator-only — see below), Discovery, Review Episodes, Outgoing, hero curation, or Curate menu. |
| **UI (today)** | Lookup + general drop wired for **`Submitter`** or **`Curator`** (`shouldCallSubmitUrlLookup`). Series picker remains **`Curator`** only. **`Submitter` is rejected** from Curator-only routes (`has-role.guard.spec.ts`). |
| **JWT** | Should carry **`submit`** permission (Auth0 role → permission mapping). |
| **Backend** | Azure already accepts `submit`; Worker/UI alignment pending. |

### `Curator`

Human catalogue editors.

| Area | Behaviour |
|------|-----------|
| **Route guards** | `hasRoleGuard` with `data.roles: ["Curator"]` — `/discovery`, `/episodes/:episodeIds`, `/outgoingEpisodes`. |
| **Toolbar** | Discovery link, Curate submenu (Create Subject, Review Outgoing). |
| **Submit UX** | Full submit-url flows including lookup, Series picker, **podcast-page drop/attach** (Curator-only — binds episode to an existing catalogue row via `podcastId`), page-attach confirm, post-submit Add/Edit Episode dialogs. |
| **Inline curation** | Homepage hero pin/promote; subject/podcast/episode edit entry points; discovery badge (`GET /discovery-info` with `curate`). |
| **JWT** | **`curate`** scope on curation API calls; submit flows currently also use **`curate`** for lookup (`SubmitUrlLookupService` → `AUTH_SCOPE: 'curate'`). |

### `Admin`

Operators with destructive or infra-adjacent tools. Often also assigned **Curator** for day-to-day editing.

| Area | Behaviour |
|------|-----------|
| **Toolbar Admin menu** | Run Search Indexer, Publish Homepage, Title casing, Ignored subjects, Supported languages, Discovery Schedule. |
| **Other UI** | Web push subscription prompt on sign-in; episode **Delete** on review grids; podcast **Rename** where exposed. |
| **JWT** | **`admin`** scope on those API calls. |
| **Routes** | No dedicated `/admin` route — features are dialog/menu driven. |

---

## OAuth scope request map (SPA)

Default login scopes (`app.config.ts`): `openid profile email offline_access curate admin submit`.

Per-feature token requests:

| Scope | Request mechanism | Features |
|-------|-------------------|----------|
| **`curate`** | `AUTH_SCOPE` on `HttpClient` or explicit `getAccessTokenSilently` | Discovery load/submit, episodes/outgoing, episode/podcast/subject/person CRUD, hero curation, submit lookup (`SubmitUrlLookupService`), submit series resolve, Add Podcast (Curator path), curation submit service, episode update service |
| **`admin`** | explicit `getAccessTokenSilently` | Search indexer, publish homepage, title casing rules, language ignored subjects, supported languages, discovery schedule, delete episode, rename podcast, push subscription |
| **`submit`** | explicit `getAccessTokenSilently` in `SendPodcastComponent` when actor is **not** Curator | Share / drop POST `/submit` (non-Curator signed-in path) |
| **`''` (empty)** | explicit `getAccessTokenSilently` | Bookmarks list/mutate, profile — authenticated API identity without elevating scope |
| *(none)* | No `AUTH_SCOPE`; interceptor skips Bearer | Public homepage, search, page details, unsigned `POST /submit` |

`auth.interceptor.ts`: only requests with `HttpContext` `AUTH_SCOPE` set attach a Bearer token. Callers must opt in.

---

## Worker route permission reference

`hasPermission` in `Api/src/hasPermission.ts`. Submit backend gate: `canCallAzureSubmitBackend` in `submitAccess.ts`.

| Permission | Representative Worker routes |
|------------|------------------------------|
| **`submit`** / Azure submit | **Target:** gates Azure for `GET /submit/lookup`, `POST /submit`. **Today:** gated by **`curate`** via `canCallAzureSubmitBackend`. |
| **`curate`** | `/discovery-curation`, `/episode/*`, `/episodes/outgoing`, `/podcast/*` (most), `/subject/*`, `/person/*`, `/publish` (catalogue), `/hero-curation/*`, `/flairs`, `/people`, `/subjects` (curator variants), `/languages` (with admin), proxy to Azure submit when curate present |
| **`admin`** | `/searchindex/run`, `/publish/homepage`, `/supported-languages*`, `/title-casing-rules/*`, `/discovery-schedule`, `/pushsubscription`, `/podcast/name/:name`, `DELETE /episode/*` |
| **Auth only (`sub`)** | `/bookmarks`, `/bookmark/:episodeId` |
| **Public** | `/homepage`, `/search`, `/pagedetails/*`, `/og-image`, `/public/episode/:id`, unsigned `POST /submit` (D1) |

Worker OpenAPI descriptions for submit routes note Curator/`curate` today; align with this doc when correcting to `submit`.

---

## Azure Functions permission reference

`HandleRequest(req, roles, …)` in `Cloud/Api/BaseHttpFunction.cs` — **OR** across the `roles` array; first matching scope in JWT authorizes.

| Permission array | Controller / functions |
|------------------|------------------------|
| **`["curate", "submit"]`** | `SubmitUrlController` — GET lookup, POST submit |
| **`["curate"]`** | `EpisodeController` (except delete), `PodcastController` (except rename), `SubjectController`, `PersonController`, `DiscoveryCurationController`, `PublishController` |
| **`["admin"]`** | `EpisodeController` delete, `PodcastController` rename, `SearchIndexController`, `SupportedLanguagesController`, `TitleCasingRulesController`, `DiscoveryScheduleController`, `PushSubscriptionController`, `PublishController` (homepage publish path via Worker maps here) |

Azure does **not** read ID-token roles — only access-token `permissions` / `scope`. See [discovery-curation-api.md](../../../cultpodcasts/RedditPodcastPoster/docs/discovery-curation-api.md) for discovery endpoints.

---

## Common mistakes and incident notes

### Curator/`curate`-only lookup gate (Sep 2026 — fixed)

**Previously wrong:** Treating lookup as Curator-only in UI and `curate`-only on the Worker.

**Current model (Sep 2026):**

- **`submit`** permission (and **`Submitter`** role in UI) gates submit/lookup **backend** endpoints.
- **`curate`** / **`Curator`** gates **curation** UI and catalogue APIs — plus full submit UX (series picker).
- Azure `SubmitUrlController` accepts **`curate` OR `submit`**.
- Worker `canCallAzureSubmitBackend` accepts **`submit` OR `curate`**; lookup service requests **`submit`** scope.

Assign **`Submitter`** in Auth0 with **`submit`** permission for users who ingest URLs but must not access Discovery or episode editors.

### Roles without permissions (or the reverse)

UI role checks pass but API returns **403** when Auth0 role assignment omits the matching API permission. Fix in Auth0 role → permission mapping, not in the SPA alone.

### Refresh token scope freeze

Sessions minted before `submit` was added to the SPA scope string need an **interactive re-login** to pick up new permissions (`auth0-preview-hosts.md`).

### `getDiscoveryInfo` vs `hasPermission`

Worker `getDiscoveryInfo.ts` checks `auth0Payload.permissions.includes("curate")` only — not OAuth `scope`. Prefer `hasPermission` for parity with M2M and scope-only tokens.

### Bookmarks are not role-gated

Any authenticated user with a valid JWT `sub` may use bookmarks. Do not require `curate` or a Curator role for bookmark API calls. (Episode cards show bookmark menu styling for Curators only — cosmetic/UI choice.)

---

## Implementation notes (Sep 2026)

| Area | Behaviour |
|------|-----------|
| **Submitter in submit UI** | `shouldCallSubmitUrlLookup` checks **`Submitter`** or **`Curator`** Auth0 roles. |
| **Worker submit gate** | `Api/src/submitAccess.ts` — `submit` **or** `curate`. |
| **Lookup scope** | `submit-url-lookup.service.ts` — **`submit`**. |
| **Podcast-page drop / attach** | **`Curator`** only (`canSubmitUrlForPodcast`). Attaching to the page’s catalogue row is curation — requires **`curate`**, not merely **`submit`**. Submitter gets general drop only (`shouldCallSubmitUrlLookup`). |
| **Series picker** | **`Curator`** only (`showSubmitSeriesPicker`). |

---

## Cross-links

| Doc | Relevance |
|-----|-----------|
| [submit-url-flows.md](./submit-url-flows.md) | End-to-end submit UX, D1 vs Azure persist, fixture cases |
| [discovery-curation-api.md](../../../cultpodcasts/RedditPodcastPoster/docs/discovery-curation-api.md) | Discovery GET/POST (`curate`) |
| [auth0-preview-hosts.md](./auth0-preview-hosts.md) | Preview Auth0 app, callback URLs, refresh-token scope |
| [preview-production-secrets.md](./preview-production-secrets.md) | Pages env vars / Auth0 client IDs |
| [worker-secrets.md](../../../Api/docs/worker-secrets.md) | Worker secrets for Azure proxy endpoints |
| [Api `hasPermission.ts`](../../../Api/src/hasPermission.ts) | Worker permission helper |
| [Api `submitAccess.ts`](../../../Api/src/submitAccess.ts) | Submit Azure gate (pending correction) |

---

## Auth0 configuration checklist

When adding a new gated feature:

1. Define whether it is **UI role**, **JWT permission**, or **authenticated-only**.
2. Add Auth0 **permission** on API `https://api.cultpodcasts.com/` if backends must enforce it.
3. Map permission to **role(s)** in Auth0.
4. SPA: route guard (`hasRoleGuard` / `isUserGuard`) and/or template `@if`, plus correct **`AUTH_SCOPE`** or `getAccessTokenSilently` scope.
5. Worker: `hasPermission` or `canCallAzureSubmitBackend` as appropriate.
6. Azure: `HandleRequest(..., ["permission"], ...)`.
7. Document in this file and link from PR **`## Config / secrets`** only if new env/secrets — not for Auth0 dashboard-only RBAC changes.
