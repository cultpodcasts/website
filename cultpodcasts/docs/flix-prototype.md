# Flix prototype (`flix.cultpodcasts.com`)

Standalone Netflix-style homepage prototype. **Not** for merge into `main`. **Does not** use the production Pages project (`website` / `cultpodcasts.com`).

| | |
|--|--|
| Pages project | `flix` (`flix-ac4.pages.dev`) |
| Production branch label | `design/visual-refresh-v1` |
| Custom domain | `flix.cultpodcasts.com` |
| Build config | `staging` |

## Deploy (from this branch only)

```bash
npm run deploy:flix
```

That builds staging and deploys **only** to `--project-name=flix`. Never run `npm run deploy` for this prototype (that targets production `website`).

## DNS

If `flix.cultpodcasts.com` is not live yet, in the Cloudflare zone for `cultpodcasts.com` add:

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `flix` | `flix-ac4.pages.dev` | Proxied |

Confirm under Pages → **flix** → Custom domains that `flix.cultpodcasts.com` is Active.

Do **not** change the `cultpodcasts.com` record (production `website` project).

## Auth0 / API

- Staging SPA allowlists include `https://flix.cultpodcasts.com` (and `*.flix-ac4.pages.dev`). Sync with `npm run auth0:sync-staging-urls`.
- API gateway `AllowedOrigins` must include `https://flix.cultpodcasts.com` (api-preview). Redeploy the Api worker after that change.
