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

### Production switchover (before calling release done)

1. Open this PR and read **Config / secrets** above.
2. Set every named key on Pages **Preview** and **Production** (and Api Worker keys if listed).
3. Confirm sibling Api / RPP PR `## Config / secrets` checklists are ticked before enabling compile-time FeatureSwitches or behaviour that depends on those keys.
4. Do **not** treat “preview URL works” as production-ready until production config is confirmed.

## Test plan

- [ ]
