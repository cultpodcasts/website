## Summary

<!-- 1–3 bullets: what and why -->

## Config / secrets

<!-- Required when this PR adds or depends on new Pages env vars, Auth0/build secrets,
     or Api Worker secrets. List **names only** (never values). -->

- [ ] No new secrets / env keys
- [ ] **Or** new key **names** (preview + production):
  - Pages Preview: `<!-- e.g. AUTH0_CLIENT_ID -->`
  - Pages Production: `<!-- same names as needed -->`
  - Related Api Worker secrets (if any): `<!-- e.g. secureExampleEndpoint on api-preview + top-level api -->`

At deploy time: read this section and set every named key on **both** environments before calling the release done.

## Test plan

- [ ]
