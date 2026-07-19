# Cult Podcasts client (agent notes)

Angular PWA / Bubblewrap client for [cultpodcasts.com](https://cultpodcasts.com). It consumes the Cult Podcasts API (`api-infra`) via the Cloudflare API worker.

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

## Discovery curation

- **GET/POST** `/discovery-curation` on the API worker (8787) → proxies to `func` `DiscoveryCuration` on 7071.
- UI: `src/app/discovery-api/`, `src/app/discovery-item/`, `src/app/discovery-submit/`.

## Local dev

| Command | URL |
|---------|-----|
| `npm run start` | `https://local.cultpodcasts.com:8788` (builds with `local` env) |
| `npm run dev` | `https://local.cultpodcasts.com:4200` |

Build: `ng build`. Mobile/TWA notes: `MOBILE_BUILDS.md`.
