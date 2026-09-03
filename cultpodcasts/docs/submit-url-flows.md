# Submit URL flows

How the client turns an episode URL into `POST /submit`, which Worker/Azure endpoints it calls, and what each response does next.

**Auth model:** [`auth0-roles-and-permissions.md`](./auth0-roles-and-permissions.md) — roles vs permissions, `Submitter`/`submit` vs `Curator`/`curate`.

**API business rules are canonical.** Worker Vitest in sibling repo `Api` (`tests/submit-lookup.business-rules.spec.ts`) executes handlers against the case table. UI tests do not invent a parallel API.

**Fixture (copy from Api):** `Api/tests/fixtures/submit-url-contract.ts` → `src/app/submit-url-contract.ts` (keep byte-identical). Cases 1–7, actors, HTTP sequence (method/path/body/status/D1 vs Azure), and persist bodies. Check copies with `pwsh ../scripts/assert-submit-url-contract-copy.ps1` from `cultpodcasts/` when the Api repo is a sibling.

**UI business rules (Vitest):** `src/app/submit-url-flows.business-rules.spec.ts` consumes that fixture and asserts client helpers (`shouldCallSubmitUrlLookup`, `generalDropSeriesForActor`, persist body helpers) emit the **same** requests the fixture says that actor sends. Also `src/app/submit-ingest-ux.ts`, `src/app/submit-series.util.ts`, `src/app/submit-series-conflict.ts`.

**Faked-API e2e + video:** `e2e/submit-url-flows.spec.ts` (no Auth0 / Azure). Fake API (`e2e/submit-url-flows/fake-api.ts`) is a thin adapter over the same contract: lookup 401 when signed out; Submitter/Curator lookup 200; unsigned POST is D1 `{ success: "Submitted" }`; Submitter/Curator POST is Isolated `SubmitUrlResponse` + `X-Origin`. From `cultpodcasts/`:

```bash
npx playwright install chromium
npm run test:e2e:submit-url
```

Videos: `test-results/**/video.webm` (gitignored). The **video tour** (`e2e/submit-url-flows.tour.spec.ts`) is paced: each case opens with a plain-language intro that states **signed out / not Curator vs Curator**, then the homepage / Add Podcast / drop-target / confirm UI, with a live **HTTP overlay** (GET probes and gold **POST /submit** persist bodies). Homepage general drop is shown first as **signed out** (**POST /submit only** — D1; no lookup). Each tour case has a matching Vitest in `src/app/submit-url-flows.business-rules.spec.ts`.

**Siblings:** RedditPodcastPoster PR submit (`GET`/`POST` Isolated `SubmitUrl`); Api Worker `GET /submit/lookup`, `POST /submit`, `GET /podcast/{name|id}`.

## Purpose

Four ingest surfaces share one command (`POST /submit`) and optional probes. Series attach is the **exception**. The podcast-page overlay stays **two** drop targets; the other-series check is a dialog after drop, not a third zone.

## Endpoints

Client talks to the **Cloudflare Worker** (`environment.api`). The Worker proxies Azure Functions (`api-infra`). Isolated Functions have no Swagger; Worker OpenAPI is the public contract.

| Worker | Azure | Auth | Role |
|--------|--------|------|------|
| `GET /submit/lookup?url=` | `GET /api/SubmitUrl?url=` | Worker: `submit` or `curate`. Isolated accepts **`submit` OR `curate`**. | Read-only membership. **Submitter** or **Curator** only — never signed-out. |
| `POST /submit` | D1 queue, or `POST /api/SubmitUrl` if `submit`/`curate` JWT | none → D1; `submit` or `curate` → Azure | Command. Signed-out → **D1 only**. |
| `GET /podcast/{name}` | GET podcast by name | `curate` | Unique → id; missing → 404; many → **409** UUID list. |
| `GET /podcast/{id}` | GET podcast by id | `curate` | Catalogue row for conflict pickers. |

Worker **forwards** Azure 400 / 404 / 409 on POST (and lookup 400 / 404). Those are not D1-queued as success.

`POST /submit` 200 bodies:

- Signed-out (D1): `{ "success": "Submitted" }` — no `X-Origin`.
- Submitter/Curator (Azure Isolated): `{ "success": { "episode", "podcast", "episodeId", "podcastId", … } }` plus `X-Origin: true`.

`POST /submit` body always includes an absolute `http`/`https` `url`. Optional `podcastId` / `podcastName` only when the flow is attach or name-create.

Lookup **200** shapes:

- Known unique: `{ known: true, podcastId, podcastName, kind }`
- Unknown: `{ known: false, kind: "podcast-service" \| "streaming" \| "unrecognised" }`
- Ambiguous: `{ known: false, ambiguous: true, kind, podcastIds }` (**200**, not 409)

Name **409** is a **shared podcast name**, not URL membership. Do not confuse the two.

## Map

Every valid URL is matched locally, then (optionally) probed, then **one** `POST /submit`. Branching is which probes run, not a different command.

```mermaid
flowchart LR
  E[Entry] --> M{Matcher}
  M -->|fail| X[Reject URL]
  M -->|ok| P[Probes if the entry needs them]
  P --> S[POST /submit]
  S -->|200| O[Snackbar then Add or Edit Episode]
  S -->|409 without podcastId| Pick[Pick series by id then POST again]
  S -->|400 / 404| Err[Send error]
```

Which probes:

| Entry | Lookup | GET podcast by name | GET podcast by id |
| --- | --- | --- | --- |
| General drop / share | **Submitter or Curator** | no | only if POST 409 |
| Add Podcast | **Submitter or Curator** (series picker **Curator** only) | if Save needs a name | if lookup or name is ambiguous |
| Submit to this page | after page id (Curator) | yes — must already exist | no (confirm dialog instead) |

### General drop / share — signed out / not Curator (D1)

```mermaid
flowchart LR
  U[Valid URL] --> S["POST { url } — Worker D1"]
```

No `GET /submit/lookup`. Overlay: *Drop episode link to submit* (never the two-target podcast-page cards).

### General drop / share — Curator

```mermaid
flowchart LR
  U[Valid URL] --> L[GET /submit/lookup]
  L -->|known unique or unknown podcast-service| S["POST { url }"]
  L -->|unknown streaming + extracted name| Sn["POST { url, podcastName }"]
  L -->|unknown streaming without name / error| S
```

### URL-only (Add Podcast known / unknown podcast-service)

```mermaid
flowchart LR
  U[Valid URL] --> L{Lookup?}
  L -->|known or unknown podcast-service| S["POST { url }"]
```

### Add Podcast when Series is in play

```mermaid
flowchart TD
  L[GET /submit/lookup]
  L -->|unknown streaming + typed name| N[GET /podcast/name]
  L -->|ambiguous| I[GET /podcast/id then picker]
  N -->|200| Sid["POST { url, podcastId }"]
  N -->|404| Sname["POST { url, podcastName }"]
  N -->|409| I
  I -->|pick| Sid
  I -->|cancel| Stop[Stay on form]
```

### Submit to this page

```mermaid
flowchart TD
  N[GET /podcast/pageName — must have id]
  N -->|404 / cancel| Stop[Do not create]
  N -->|200 page id| L[GET /submit/lookup]
  L -->|known other series| C{Yes?}
  C -->|No| Stop
  C -->|Yes| Spage["POST { url, page podcastId }"]
  L -->|same / unknown / ambiguous / error| Spage
```

### After a successful POST

```mermaid
flowchart LR
  S[POST 200] --> SB[Snackbar]
  SB -->|Created| AE[Add Episode]
  SB -->|Enriched or AlreadyExists| EE[Edit Episode]
  AE -->|new series| AP[Add Podcast defaults]
```

## What each response does

| Call | Response | Next |
| --- | --- | --- |
| **GET `/submit/lookup`** | `known: true` | Add Podcast: URL-only POST, Series read-only. General drop: URL-only POST. Page drop: if **other** `podcastId` → confirm; if **same** → POST to page. |
| | `known: false`, `kind: podcast-service` | Add Podcast / general drop: URL-only POST. Page drop: POST to page (no picker). |
| | `known: false`, `kind: streaming` | Add Podcast Curator: Series picker. General drop / public Add Podcast: use extracted `podcastName` on POST when present (no picker). Page drop: POST to page. |
| | `ambiguous: true` + `podcastIds` | Add Podcast: load ids, picker, then POST with chosen id. Page drop: **ignore picker**, POST to page. |
| | `kind: unrecognised` or 400 | Reject URL. |
| | error / 500 | Add Podcast: fall back to host class (`submitSeriesUiFromLookup`). Page drop: still POST to page. |
| **GET `/podcast/{name}`** | 200 one row | Attach `podcastId`. |
| | 404 | Name-only create (**Add Podcast** only). Page attach treats 404 as error (do not create). |
| | 409 UUID list | Load each id, curator picks. |
| **POST `/submit`** | 200, `episode: Created` | Snackbar **Edit** → **Add Episode** (podcast name frozen). If `podcast: Created` → then **Add Podcast** defaults. |
| | 200, `Enriched` / `EpisodeAlreadyExists` | **Edit Episode**. |
| | 409 UUID list and **no** `podcastId` on the request | Same picker as name conflict, then POST again with `podcastId` + same `url`. |
| | 400 / 404 | Send-dialog error. 404 = missing `podcastId`. |

## Entry points

### Add Podcast (toolbar)

Curator Series field is driven by lookup (`submitSeriesUiFromLookup` / `submitDialogResult`). Public users never see Series.

1. **Submitter or Curator:** debounced `GET /submit/lookup` after a valid parsed URL. Signed-out never calls lookup (`shouldCallSubmitUrlLookup`).
2. Curator Save waits until lookup finished for **this** href (`submitSaveReady`). Non-Curator Save needs a valid URL only.
3. Known unique → POST `{ url }` only (never leftover `podcastName`).
4. Unknown podcast-service → POST `{ url }` only (platform metadata creates the show).
5. Unknown streaming + typed name → `GET /podcast/{name}` then POST with id or name.
6. Ambiguous lookup → `GET /podcast/{id}` for each id, picker, then POST with chosen id.

### General drop and share

Homepage (and share-target). Overlay: *Drop episode link to submit* (never the two-target podcast-page cards).

1. Matcher. **`GET /submit/lookup` when Submitter or Curator.** Signed-out persist `{ url }` to D1.
2. Curator + podcast-service (Spotify / Apple / YouTube): persist `generalDropSeries(lookup)` → `{ url }` (known unique or unknown).
3. Curator + streaming (BBC, Netflix, Prime, Vimeo, iPlayer, Internet Archive, …): if lookup returned an extracted `podcastName` (adapter `ShowName`), persist `{ url, podcastName }`. No Series picker on the homepage.
4. Lookup error / no extracted name / not Curator → `{ url }` only. POST 409 still opens the name picker only when a name was sent.

### Submit to this podcast (page drop)

Curator, podcast route only. Overlay copy: *Link this episode to the podcast shown on this page.*

1. `GET /podcast/{name}` via `resolveSeriesForAttach` — must already exist (`podcastId` required).
2. `GET /submit/lookup`.
3. `pageDropPlan`: other series → confirm (*This URL is already on {other}. Submit to {page} anyway?*). Only explicit Yes continues.
4. Always POST `{ url, podcastId }` of the **page**. Lookup never replaces the page id. Ambiguous lookup does not open the 409 picker.

Same confirm when the **podcast-page submit dialog** attaches to the page with an empty Series field.

### Add Episode / Edit Episode

Not a submit-URL entry. They open **after** POST from the origin snackbar (`postSubmitEpisodeDialog`). Add Episode does **not** pick a series. Extra service URLs/images belong on that form.

## Sequence: Add Podcast, unknown streaming + typed name

```mermaid
sequenceDiagram
  actor Curator
  participant UI as Add Podcast
  participant W as Worker
  participant Az as api-infra

  Curator->>UI: paste URL
  UI->>W: GET /submit/lookup?url=
  W->>Az: GET /api/SubmitUrl?url=
  Az-->>W: 200 known false kind streaming
  W-->>UI: show Series picker
  Curator->>UI: Save with name
  UI->>W: GET /podcast/{name}
  W->>Az: GET podcast by name
  alt unique
    Az-->>UI: 200 id
    UI->>W: POST /submit url + podcastId
  else missing
    Az-->>UI: 404
    UI->>W: POST /submit url + podcastName
  else many names
    Az-->>UI: 409 ids
    UI->>W: GET /podcast/{id} each
    Curator->>UI: pick
    UI->>W: POST /submit url + podcastId
  end
  Az-->>UI: 200 episode Created / Enriched / ...
```

## Sequence: Submit to this page, URL already on another series

```mermaid
sequenceDiagram
  actor Curator
  participant UI as Page drop
  participant W as Worker
  participant Az as api-infra

  Curator->>UI: drop on Submit to page
  UI->>W: GET /podcast/{pageName}
  Az-->>UI: 200 page podcastId
  UI->>W: GET /submit/lookup?url=
  Az-->>UI: 200 known true other podcastId
  UI->>Curator: confirm other series
  alt No / dismiss
    UI-->>Curator: stop
  else Yes
    UI->>W: POST /submit url + page podcastId
    Az-->>UI: 200
  end
```

## Key files

| Path | Role |
|------|------|
| `src/app/submit-ingest-ux.ts` | General drop body, page-drop plan, post-submit dialog kind |
| `src/app/submit-series.util.ts` | Add Podcast Series UI + Save plan + POST body |
| `src/app/submit-series-conflict.ts` | Name probe, attach, 409 picker, other-series confirm |
| `src/app/submit-url-contract.ts` | Copied case table from Api `tests/fixtures/submit-url-contract.ts` |
| `src/app/submit-url-flows.business-rules.spec.ts` | One Vitest per fixture case; asserts client requests match the table |
| `e2e/submit-url-flows/fake-api.ts` | Thin adapter over the same fixture (lookup/POST/auth) |
| `src/app/submit-url-lookup.service.ts` | `GET /submit/lookup` |
| `src/app/submit-podcast/` | Add Podcast dialog |
| `src/app/send-podcast/` | `POST /submit` + 409 retry |
| `src/app/app.component.ts` | Drop overlay |
| `src/app/podcast-api/` | Page submit dialog attach |
| `src/app/submit-url-origin-response-snackbar/` | Created / Enriched / already exists → episode dialogs |

## Overlay layout

Podcast-page overlay keeps **exactly two** targets (`CHROME-DOCK-DROP`). Do not add a third drop zone for warnings; the other-series check is a **dialog after drop**.
