# Auth0 on Cloudflare Pages previews

Preview hosts change every deploy (`https://<id-or-branch>.website-83e.pages.dev`). Do **not** bake a specific preview URL into `environment.staging.ts` for Auth0 redirects.

## App behaviour

- Login `redirect_uri` and logout `returnTo` use `window.location.origin` ([`auth-redirect-uri.ts`](../src/app/auth-redirect-uri.ts)).
- Staging `bundleAssetHost` is empty so SVG icons load from `/assets/...` on the current host.

## Auth0 Application (staging SPA)

Tenant custom domain: `auth-staging.cultpodcasts.com`  
Client ID: value of `auth0.clientId` in [`environment.staging.ts`](../src/environments/environment.staging.ts) (set the same in `.env.staging` as `AUTH0_CLIENT_ID`).

Required allowlist entries (no trailing slash):

- `https://*.website-83e.pages.dev`
- `https://website-83e.pages.dev`
- `https://local.cultpodcasts.com:8788`
- `https://local.cultpodcasts.com:4200`

Apply to: **Allowed Callback URLs**, **Allowed Logout URLs**, **Allowed Web Origins**, **Allowed Origins (CORS)**.

### Automate with Management API

1. Copy [`.env.staging.example`](../.env.staging.example) → `.env.staging` (gitignored).
2. Set:
   - `AUTH0_MGMT_DOMAIN` — canonical tenant host from Dashboard → Tenant Settings (e.g. `something.uk.auth0.com`), **not** the custom login domain
   - `AUTH0_MGMT_TOKEN` — token with `read:clients` + `update:clients`
   - `AUTH0_CLIENT_ID` — staging SPA client id (same as `environment.staging.ts`)
3. Dry-run then apply:

```bash
npm run auth0:sync-staging-urls -- --dry-run
npm run auth0:sync-staging-urls
```

Existing URLs are kept; required ones are merged in.

## API CORS

Preview API (`api-preview.jonbreen.workers.dev`) must have secret/var:

`stagingHostSuffix=website-83e.pages.dev`

so `getOrigin` accepts any `https://*.website-83e.pages.dev` Origin.
