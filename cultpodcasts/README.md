# Cult Podcasts (Angular client)

Angular **22** PWA for [cultpodcasts.com](https://cultpodcasts.com). Consumes the Cult Podcasts API via the Cloudflare Worker gateway.

## Local ports

| Port | Service | Command |
|------|---------|---------|
| **8788** | Website (Wrangler Pages) | `npm run start` |
| **8787** | API gateway (Wrangler Worker, `~/source/repos/Api`) | `npm run start` in Api |
| **7071** | Azure Functions API (`RedditPodcastPoster/Cloud/Api`) | `func start` |
| **4200** | Website hot reload | `npm run dev` |

Auth0 requires hostname **`local.cultpodcasts.com`** (hosts → `127.0.0.1`). Dev certs: `.cert/dev-cert.pem` + `dev-key.pem`.

`environment.api` points at **`https://local.cultpodcasts.com:8787`** (API worker).

## Development

| Command | URL |
|---------|-----|
| `npm run start` | `https://local.cultpodcasts.com:8788` (build `local` + Wrangler) |
| `npm run dev` | `https://local.cultpodcasts.com:4200` (`ng serve`) |

## Build

```bash
ng build --configuration production   # or: npm run build -- production
npm run build:local
npm run build:staging
```

Artifacts go under `dist/`.

## Unit tests

```bash
npm test
```

Runs Karma/Jasmine (util specs only today).

## Further help

- Framework upgrades (Angular / Material / TypeScript): [`docs/dependency-updates.md`](docs/dependency-updates.md) — run `npm run deps:check`
- See `AGENTS.md` for curator/discovery notes and `MOBILE_BUILDS.md` for TWA/Bubblewrap.
