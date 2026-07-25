# Flix prototype (`flix.cultpodcasts.com`)

Standalone Netflix-style homepage prototype. **Not** for merge into `main`. **Does not** use the production Pages project (`website` / `cultpodcasts.com`).

| | |
|--|--|
| Pages project | `flix` (`flix-ac4.pages.dev`) |
| Git repo | `cultpodcasts/website` |
| Production branch | `design/visual-refresh-v1` |
| Custom domain | `flix.cultpodcasts.com` |
| Build config | `./build.sh` (`env` from Pages env vars) |
| Production Auth / API | Production Auth0 + `api.cultpodcasts.com` |
| Preview Auth / API | Staging Auth0 + `api-preview.jonbreen.workers.dev` (`environment.staging.ts`) |
| Preview deploys | On (`preview_deployment_setting: all`); Preview Pages env `env=staging` |

## Deploy

Pushes to `design/visual-refresh-v1` build and deploy **flix production** (Pages env `env=production`).

Other branches build **flix preview** URLs (`https://<branch>.flix-ac4.pages.dev` / `https://<id>.flix-ac4.pages.dev`) with Pages Preview env `env=staging` so `build.sh` copies staging Auth0 + api-preview.

Manual fallback (direct upload to the same project — uses whatever you built locally; prefer Git builds for correct `env`):

```bash
npm run deploy:flix
```

Never run `npm run deploy` for this prototype (that targets production `website`).

### Keeping flix branches off the `website` project

The production `website` Pages project builds previews for every branch (`preview_deployment_setting: custom`, includes `*`), so flix branches would build twice. Its `preview_branch_excludes` therefore lists:

| Pattern | Why |
|---------|-----|
| `design/visual-refresh-v1` | flix production branch |
| `flix/*` | convention for new flix work branches |
| `feat/hero-curation-ux` | pre-convention flix branch |

Name new flix branches `flix/<topic>` so they are excluded automatically; otherwise add the branch to that exclude list (Pages → website → Settings → Builds & deployments → Branch control).

## Homepage curation (Curator role)

Stored in the API worker `Curated` KV via `GET`/`PUT /hero-curation` (preview or production API, depending on build env):

| Field | UI |
|-------|----|
| `episodeIds` | Star on any rail card; **Manage hero** panel (reorder / remove) |
| `railSubjects` | Pin on subject rail headings; **Manage rails** panel (reorder / pin more) |

Pinned rails that drop below the week's episode threshold fall out. Only pinned subjects appear as rails — there is no popularity autofill. Hero picks that leave the current week prune the same way.

## DNS

If `flix.cultpodcasts.com` is not live yet, in the Cloudflare zone for `cultpodcasts.com` add:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `flix` | `flix-ac4.pages.dev` | Proxied |

Confirm under Pages → **flix** → Custom domains that `flix.cultpodcasts.com` is Active.

Do **not** change the `cultpodcasts.com` record (production `website` project).

## Auth0 / API

- Production SPA allowlists must include `https://flix.cultpodcasts.com` (and `*.flix-ac4.pages.dev`) on callbacks / logout / web origins / allowed origins.
- Production API gateway `AllowedOrigins` must include `https://flix.cultpodcasts.com`. Redeploy the Api worker after that change.
