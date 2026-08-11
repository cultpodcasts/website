# Preview ↔ production secrets (website)

New Cloudflare Pages env vars, Auth0/build secrets, or dependent Api Worker secrets added for **preview/staging** must also be planned for **production**.

## Why

Preview-only configuration has repeatedly been forgotten at release time, breaking production. Agents and humans must treat “works on `*.pages.dev`” as incomplete until production keys are set.

## PR requirement

Every PR that adds or depends on new config must include:

```markdown
## Config / secrets
- [ ] Pages Preview: `KEY_NAME`
- [ ] Pages Production: `KEY_NAME`
- [ ] Related Api Worker secrets (if any): `secureExampleEndpoint` on api-preview + top-level api
```

List **names only** — never values.

## Deploy

1. Open the merged PR and read **`## Config / secrets`**.
2. Set each named key on Preview **and** Production (Pages dashboard / wrangler; Api via Api repo set-secrets scripts).
3. Only then treat the release as complete.

## Agent rule

See [`.cursor/rules/preview-production-secrets-parity.mdc`](../../.cursor/rules/preview-production-secrets-parity.mdc) (repo root: `website/.cursor/rules/`).
