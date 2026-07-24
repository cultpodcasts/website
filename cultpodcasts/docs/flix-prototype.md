# Flix prototype (`flix.cultpodcasts.com`)

Standalone Netflix-style homepage prototype. **Not** for merge into `main`. **Does not** use the production Pages project (`website` / `cultpodcasts.com`).

| | |
|--|--|
| Pages project | `flix` (`flix-ac4.pages.dev`) |
| Git repo | `cultpodcasts/website` |
| Production branch | `design/visual-refresh-v1` |
| Custom domain | `flix.cultpodcasts.com` |
| Build config | `./build.sh` with `env=production` |
| Auth / API | Production Auth0 + `api.cultpodcasts.com` |
| Preview deploys | Off (production branch only) |

## Deploy

Pushes to `design/visual-refresh-v1` build and deploy **flix** automatically (Cloudflare Pages Git integration).

Manual fallback (direct upload to the same project):

```bash
npm run deploy:flix
```

Never run `npm run deploy` for this prototype (that targets production `website`).

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
