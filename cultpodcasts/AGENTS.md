# Cult Podcasts client (agent notes)

Angular PWA / Bubblewrap client for [cultpodcasts.com](https://cultpodcasts.com). It consumes the Cult Podcasts API (`api-infra`) via the Cloudflare API worker.

## No Api / website deploys (HARD)

**Never** run `npm run deploy` / `wrangler pages deploy` (or Api `wrangler deploy`) unless the user
explicitly names that exact deploy in the current conversation. When the user asks to **push** a PR
branch, push is OK — Pages **preview** may build from git; do not run deploy CLIs.

- Rule: [`../.cursor/rules/no-api-website-deploys.mdc`](../.cursor/rules/no-api-website-deploys.mdc)

## Preview ↔ production secrets (HARD)

Any new Pages / Auth0 / build secret for preview/staging **must** also be planned for production. PR body **must** include `## Config / secrets` with **key names** (never values). At deploy, read that section and set both environments.

- Rule: [`../.cursor/rules/preview-production-secrets-parity.mdc`](../.cursor/rules/preview-production-secrets-parity.mdc)
- Docs: [`docs/preview-production-secrets.md`](docs/preview-production-secrets.md)

## Episode OG share image

Client SEO may use episode art from page-details when
`FeatureSwitch.episodeOgShareImage` is enabled (default **OFF**).

- Docs: [`docs/episode-og-share-image.md`](docs/episode-og-share-image.md)
- Preview: test with the switch ON and OFF before enabling in production.

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

- **Pre-push:** repo `.githooks/pre-push` runs `test:all` (enabled by `npm install` / `prepare` → `core.hooksPath=.githooks`).
- **CI:** `.github/workflows/cultpodcasts-tests.yml` on PRs touching `cultpodcasts/**`.
- **Do not** `git push --no-verify` / `-n` to skip (Cursor hook blocks that for agents).
- Emergency only: `SKIP_CLIENT_TESTS=1 git push`.

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

## Version bumps (HARD for PRs)

Every website PR that changes shipped client code **MUST** bump `cultpodcasts/package.json` (and `package-lock.json` to match) — patch unless the change warrants minor/major. Do this in the same PR before opening or as the last commit before ready-for-review.
