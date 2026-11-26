# Cult Podcasts client (agent notes)

Angular PWA / Bubblewrap client for [cultpodcasts.com](https://cultpodcasts.com). It consumes the Cult Podcasts API (`api-infra`) via the Cloudflare API worker.

## No Api / website deploys (HARD)

**Never** run `npm run deploy` / `wrangler pages deploy` (or Api `wrangler deploy`) unless the user
explicitly names that exact deploy in the current conversation. When the user asks to **push** a PR
branch, push is OK — Pages **preview** may build from git; do not run deploy CLIs.

- Rule: [`../.cursor/rules/no-api-website-deploys.mdc`](../.cursor/rules/no-api-website-deploys.mdc)

## CQRS (HARD)

A command changes state and returns an acknowledgement (empty 202) or a command outcome. It does not return the resource read model. A query returns the read model and changes nothing.

Do not bind UI from an acknowledgement. GET the resource and bind that body. A command response that is the resource read model is a CQRS breach.

Authoritative: `RedditPodcastPoster/Cloud/Api/architecture.md` § CQRS.

## Auth0 roles and permissions

ID-token **roles** (`Curator`, `Submitter`, `Admin`) gate SPA UI; access-token **permissions** (`submit`, `curate`, `admin`) gate the Worker and Azure APIs.

- Docs: [`docs/auth0-roles-and-permissions.md`](docs/auth0-roles-and-permissions.md)
- Submit UX detail: [`docs/submit-url-flows.md`](docs/submit-url-flows.md)

## Planned catalogue content types epic (not scheduled)

Search cards, facets, and detail routes by `contentKind` (`Episode | TvShowEpisode | Film | NewsReport`). Film = made-as-film one-off (cinema or TV; no parent). Routes: `/podcast/{name}/{shortId}` (unprefixed 22-char id; full GUID URLs 301 once to it), `/film/{slug}/{shortId}`, `/tv/{slug}`, `/tv/{slug}/{shortId}`, `/news/{slug}`, `/news/{slug}/{shortId}`. Submit lookup will generalize `parentName` + kind hint (Film: title only) — **planning only** until a phase is explicitly started. Phase 0 sign-off 2026-09-23.

- Epic + ADRs: [`RedditPodcastPoster/docs/catalogue-content-types-epic.md`](../../../cultpodcasts/RedditPodcastPoster/docs/catalogue-content-types-epic.md)
- Search storage impact: [`RedditPodcastPoster/docs/catalogue-content-types-search-storage-impact.md`](../../../cultpodcasts/RedditPodcastPoster/docs/catalogue-content-types-search-storage-impact.md)

## Preview ↔ production secrets (HARD)

Any new Pages / Auth0 / build secret for preview/staging **must** also be planned for production. PR body **must** include `## Config / secrets` with **key names** (never values). At deploy, read that section and set both environments.

- Rule: [`../.cursor/rules/preview-production-secrets-parity.mdc`](../.cursor/rules/preview-production-secrets-parity.mdc)
- Docs: [`docs/preview-production-secrets.md`](docs/preview-production-secrets.md)

## API contracts (`@cultpodcasts/contracts`)

Azure Functions DTOs that RedditPodcastPoster exports are generated into the private npm package `@cultpodcasts/contracts` (GitHub Packages; RedditPodcastPoster#1502). Import contract types straight from `@cultpodcasts/contracts` under their generated names (`import type` for interfaces) instead of hand-writing a wire interface. **No alias or pass-through shims**: never re-export a contract type under another name (`export { ApprovalStatusDto as ApprovalStatus }`, `export type EpisodeChangeResponse = EpisodeUpdateResponse`) or from a local file that only re-exports it. A local type is fine only when it adds something, e.g. a `WithDates<...>` composition. Generated string enums are a const object plus a same-named type, so import those as values (`SearchIndexerState.Executed`, `ApprovalStatusDto.AwaitingApproval`, not a string literal). Today `EpisodeDto` (as `ApiEpisode = WithDates<EpisodeDto, 'release'>`, curator reads), `PublicEpisodeDto` (as `PublicEpisode = WithDates<…>`, `GET /public/episode/:id`, bookmarks), `EpisodeUpdateResponse` (every episode / playable PATCH 202), `ApprovalStatusDto`, `SearchIndexerState`, `ContentKindDto` (`contentKind` on both episode DTOs, 0.1.4+; same values as `CataloguePlayableKind`) and what they reference. Never copy generated code here; if a DTO is not exported yet, propose `[ExportContract]` on it in RPP. Dates in generated types are ISO strings; model the `JsonDateInterceptor` conversion with `WithDates<T, K>` (`src/app/contract-dates.ts`). UI / form / view-model shapes (e.g. `EpisodeFormUpdate`, `Person`) stay hand-written, mapped at the boundary (`person-dto.util.ts`).

`npm ci` needs `NODE_AUTH_TOKEN` (GitHub PAT with `read:packages`; `cultpodcasts/.npmrc`): in your shell locally, as the `NODE_AUTH_TOKEN` repository secret for GitHub Actions, and as a **build** environment variable on Cloudflare Pages **Preview and Production**. Without it `npm ci` fails with 401/403. Dependabot PRs do not get Actions secrets, so `cultpodcasts-tests.yml` fails on them unless the same PAT is also a **Dependabot** secret (`gh secret set NODE_AUTH_TOKEN -R cultpodcasts/website --app dependabot`); if a `.github/dependabot.yml` is ever added it also needs a `registries:` entry for `npm.pkg.github.com` (`type: npm-registry`, token from that secret). The PAT is a classic token with **only** `read:packages` and an expiry; when it expires, rotate it in all three places.

## Episode OG share image

Client SEO uses episode art when `FeatureSwitch.episodeOgShareImage` is enabled
(default **ON**). SSR prefers shortener page-details (branded `/og-image` when
present); when page-details has no image, enrich from search via the same
`episodeImageUrl` / `episodeArtAspect` path as the hero (entity-decoded CDN URLs).
Zoneless SSR must wrap those async meta writes in `PendingTasks.run` so crawlers
do not get the site-icon `sq-image` fallback (Api#244).

- Docs: [`docs/episode-og-share-image.md`](docs/episode-og-share-image.md)
- Preview: validate ON (default) and OFF (rollback) paths.

## Submit URL flows

Episode URL ingest (Add Podcast, drag drop, share) → Worker lookup/submit. Series attach is the exception.

- Docs: [`docs/submit-url-flows.md`](docs/submit-url-flows.md)
- **Streaming orchestration contract:** [`docs/streaming-submit-orchestration.md`](docs/streaming-submit-orchestration.md) — copy `Api/tests/fixtures/streaming-submit-contract.ts` → `src/app/streaming-submit-contract.ts`
- **Canonical cases:** copy `Api/tests/fixtures/submit-url-contract.ts` → `src/app/submit-url-contract.ts`
- Rules: `src/app/submit-ingest-ux.ts`, `submit-series.util.ts`, `submit-series-conflict.ts`
- **Signed-out:** never `GET /submit/lookup` (Azure). Persist `POST /submit` to Worker D1.
- **Submitter / Curator:** lookup first, then POST (extracted name rules on general drop). **Podcast-page drop/attach** is **Curator-only** (`canSubmitUrlForPodcast`); series picker Curator only.
- Faked-API Playwright + video tour: `npm run test:e2e:submit-url` (`e2e/submit-url-flows.spec.ts`)
- Tour cases ↔ Vitest: `src/app/submit-url-flows.business-rules.spec.ts` (consumes the Api fixture)

## Repository layout

- **Git root:** `~\source\repos\website` (parent of this folder). Run `git` commands from the parent repo or paths relative to it.
- **This app:** `website/cultpodcasts/` — Angular 16+ standalone components, Material UI, Auth0 (`curate` scope for discovery curation).
- **API gateway (local):** `~\source\repos\Api` — Cloudflare Worker; proxies to Azure Functions. `npm run start` → port **8787**.
- **API functions (local):** `cultpodcasts/RedditPodcastPoster/Cloud/Api` — `func start` → port **7071**.
- **API repo docs:** `RedditPodcastPoster/docs/discovery-curation-api.md`.

## Local ports

| Port | Service | Command (from repo) |
|------|---------|---------------------|
| **8788** | Website (wrangler pages) | `website/cultpodcasts`: `npm run start` |
| **8787** | API gateway (wrangler worker) | `Api`: `npm run start` |
| **7071** | Azure Functions API | `RedditPodcastPoster/Cloud/Api`: `func start` |
| **4200** | Website hot reload | `website/cultpodcasts`: `npm run dev` |

Auth0 requires hostname **`local.cultpodcasts.com`** (hosts → `127.0.0.1`). Dev certs: `.cert/dev-cert.pem` + `dev-key.pem` (website and `Api` each have copies).

`environment.api` always points at **`https://local.cultpodcasts.com:8787`** (the API worker, not the website port).

## Tests (HARD before push)

From `website/cultpodcasts/`:

```bash
npm run test:all
```

Runs **all** Vitest unit tests and **all** Playwright e2e (including hero layout geometry).

- **Pre-push:** repo `.githooks/pre-push` runs `test:all` (enabled by `npm install` / `prepare` → `core.hooksPath=.githooks`). `prepare` does not set that hook when `GITHUB_ACTIONS=true`.
- **CI:** `.github/workflows/cultpodcasts-tests.yml` on PRs touching `cultpodcasts/**` (this job installs Playwright). The Android release tag push is not a test gate: `mobile-build.yml` publishes it with `SKIP_CLIENT_TESTS=1`.
- **Do not** `git push --no-verify` / `-n` to skip (Cursor hook blocks that for agents).
- Local emergency only: `SKIP_CLIENT_TESTS=1 git push`.

During a development cycle, prefer `npm run test:watch` while iterating, then `npm run test:all` before every push.

## Homepage hero (HARD for related changes)

Before changing `src/app/homepage-hero/**`, `hero-slides.ts`, or homepage CSS that affects billboard copy height / scroll:

- Read [docs/homepage-hero.md](docs/homepage-hero.md) — `HERO-*` requirements, failure modes, regression checklist.
- Keep `homepage-hero.component.spec.ts` green (specs are tagged with the same `HERO-*` ids).
- For layout blank-space / viewport regressions, run `npm run test:e2e:hero-layout` (Playwright geometry harness).

Curation KV deploy notes only: [docs/flix-prototype.md](docs/flix-prototype.md).

## Discovery curation

- **GET/POST** `/discovery-curation` on the API worker (8787) → proxies to `func` `DiscoveryCuration` on 7071.
- UI: `src/app/discovery-api/`, `src/app/discovery-item/`, `src/app/discovery-submit/`.

## Local dev

| Command | URL |
|---------|-----|
| `npm run start` | `https://local.cultpodcasts.com:8788` (builds with `local` env) |
| `npm run dev` | `https://local.cultpodcasts.com:4200` |

Build: `ng build`. Mobile/TWA notes: `MOBILE_BUILDS.md`.

## Versions (HARD — build time, never committed)

Shipping PRs **MUST NOT** change `cultpodcasts/package.json` / `package-lock.json` version lines. Parallel PR bumps caused stacked merge conflicts on every merge, and nothing bumps them on merge either (website #669: branch protection rejects bot pushes to `main`).

`package.json` holds a fixed **base** version (x.y.z). The real version is worked out at build time by `tools/build-version.cjs`:

- **Version** `<base>+<sha7>` (e.g. `1.24.44+b457ca5`): the privacy page (`update-version.js` → `src/environments/version.prod.ts`, via `build.sh` on Cloudflare Pages and in Actions) and the Android versionName. The commit is `CF_PAGES_COMMIT_SHA`, else `GITHUB_SHA`, else `git`.
- **Android versionCode** `VERSION_CODE_OFFSET` (100000) + the workflow run number (`GITHUB_RUN_NUMBER`, or `BUILD_NUMBER`), so every release is higher than the last, and higher than the old `major*10000+minor*100+patch` codes. The run number belongs to the workflow file: **never rename or move `.github/workflows/mobile-build.yml` without raising `VERSION_CODE_OFFSET`** in the same PR to at least the highest code released (see `MOBILE_BUILDS.md`). Release tags and asset names use `v<base>-<sha7>`.
- **iOS** CFBundleShortVersionString is the base; CFBundleVersion is the run number (else epoch seconds).

Change the base version only for a deliberate minor/major, in its own PR. `npm run test:tools` covers the module.

## Review gate (HARD, cultpodcasts/RedditPodcastPoster#1507 / #1563)

`.github/workflows/review-gate.yml` publishes the commit status **`review-gate`** on every PR head SHA. It is red until the review-implement-pr reviewer says the **current head commit** is acceptable, so a PR cannot be merged mid-review. It does **not** look at CI: CI must be green separately. When the status is failure the Actions job also fails so the check run matches.

**Preferred clear path (no HTML):** with CI green, open the PR → **Review** → **Approve** on the current head. A trusted Approve auto-adds `review-acceptable` and turns `review-gate` green. **Changes requested** on the head turns it red. HTML markers remain an alternate path for agents.

The reviewer's **final step** when its verdict is acceptable (marker path, optional when Approving):

1. Check that every other check for the head SHA has passed (`gh pr checks <n>`). Never mark a SHA while CI is pending or red.
2. Either **Approve** the PR on the current head, **or** post a PR **issue comment** (`gh pr comment <n>`) containing the marker for the **full 40-character head SHA** it reviewed:
   `<!-- review-gate: acceptable sha=<head sha> -->`
   Get the SHA with `gh pr view <n> --json headRefOid --jq .headRefOid`. To withdraw a verdict, use **Request changes** or post `<!-- review-gate: changes-requested sha=<head sha> -->`.
3. On Approve the workflow adds `review-acceptable`. On the marker path, **then** add the label: `gh pr edit <n> --add-label review-acceptable` (a label with no acceptable Approve/marker for the head SHA and no carried acceptance is removed).
4. Check `review-gate` is green (`gh pr checks <n>`), then move the card to Ready For Review.

Rules:

- Only the reviewer Approves / adds the marker and label. The implementor never does.
- Trusted reviews and markers count only from OWNER, MEMBER or COLLABORATOR accounts. Markers in **review bodies** (as HTML text), on quoted (`>`) lines, inside fenced or indented code blocks, inside inline code spans, or for any other SHA are ignored — Approve/Changes Requested use the review *state* and `commit_id`. Comments are ordered by when they were created, so editing an old comment does not make its marker the latest; within one comment the last marker wins.
- Any new push removes `review-acceptable` and turns the status red, **except** a head that is only merge-from-base commits on top of a SHA the reviewer already marked acceptable: `.github/scripts/merge-only-tip.cjs` walks first parents (max 10 hops) and the acceptance and label **carry** with no re-mark (cultpodcasts/RedditPodcastPoster#1555). Each hop must be a two-parent merge whose second parent is on the base branch, with no PR/base file overlap and a merge delta equal to the base side. Rebases, feature commits, overlapping or hand-edited merges, a changes-requested marker on the way, or an API error do not carry: the reviewer re-checks and Approves or re-marks as before.
- The workflow runs on `pull_request_target`, `issue_comment`, and `pull_request_review`, always checking out the **default branch** only (`persist-credentials: false`), so editing the gate in a PR does not change that PR's result.
- **Process interlock, not a security boundary.** The reviewer, the implementor and Jon all post as `cultpodcasts` (author association OWNER), and anyone with write access can add the label or post a status. "Only the reviewer marks" is enforced by agent rules, not by GitHub. (Possible future hardening: a separate reviewer GitHub App, with markers accepted only from its bot login.)
- The job is named `publish-status`, not `review-gate`, so the only thing called `review-gate` is the commit status. GitHub would otherwise require a check run and a status of the same name.
- Follow-on after merge (needs Jon's OK): require `review-gate` on `main`, with its source pinned to **GitHub Actions** (the app that posts the status), not "any source".

## Linking PRs to tickets (HARD)

- Every PR for a ticket links it with a **closing keyword** so it shows under the issue's **Development** panel: same repo `Closes #N`; another repo `Closes cultpodcasts/<repo>#N` (e.g. Api / website companions of an RPP ticket: `Closes cultpodcasts/RedditPodcastPoster#N`). Do **not** use `Refs` for the ticket a PR delivers — `Refs` PRs are invisible under Development.
- A ticket with PRs in several repos stays **open until ALL of its PRs are merged**. GitHub closes it on the first `Closes` merge; `.github/workflows/issue-close-sibling-guard.yml` (mirrored in RedditPodcastPoster, Api and website) reopens it while any PR for it is still open (Development links, cross-references incl. `Refs`, trio search) and restores the board card to In Progress (cultpodcasts/RedditPodcastPoster#1423).
- List companion PRs in the PR body (`Companions: cultpodcasts/Api#…, cultpodcasts/website#…`) with the merge order.

## Cursor Cloud specific instructions

Multi-repo workspace: this app is at `/agent/repos/website/cultpodcasts` alongside `/agent/repos/api`
and `/agent/repos/redditpodcastposter`. The startup update script runs `npm ci` here.

- **HARD**: Never use the `pin-github-identity` skill (or `GH_TOKEN` process-override from `gh auth token --user …`) on Cursor Cloud / Cloud Agent VMs; GitHub identity is whatever Cursor assigned to the run.
- **Node**: needs Node 22.22.3 (`.nvmrc`, installed via nvm). Login shells (`bash -lc`, tmux) get it
  from `~/.bashrc`. A sandbox `/exec-daemon/node` (22.14.0) shadows PATH in bare non-login shells —
  prefer `bash -lc "…"` or prepend `$HOME/.nvm/versions/node/v22.22.3/bin`.
- **Dev servers**: `npm run dev` (ng serve, `https://local.cultpodcasts.com:4200`) or `npm run start`
  (wrangler pages, `:8788`) require `.cert/dev-cert.pem` + `.cert/dev-key.pem` (self-signed, gitignored,
  persisted in the snapshot) and the hosts entry `127.0.0.1 local.cultpodcasts.com`.
- **Browser cert**: the dev cert is trusted in the snapshot (system CA store + Chrome NSS db at
  `~/.pki/nssdb`), so a fresh Chrome loads the site without warnings. Dev `environment.ts` points the
  API at `https://127.0.0.1:8787`; for in-browser API calls run the api worker (accept its cert — it is
  trusted; otherwise type `thisisunsafe` on the interstitial).
- **Live data**: the catalogue/search DATA needs the api worker **and** the Azure Functions backend
  (Cosmos DB + Azure AI Search) + secrets. With only the api worker running, seed its local R2
  `content/homepage` object to render a working homepage (see api `AGENTS.md`); search/episode detail
  still require the Azure backend.
- **Tests**: `npm run test:all` (328 Vitest unit + 50 Playwright e2e). Playwright Chromium is
  pre-installed in the snapshot; the pre-push hook runs `test:all`.
