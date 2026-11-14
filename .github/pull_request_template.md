## Summary

<!-- 1–3 bullets: what and why -->

## Related

<!-- Every PR for a ticket MUST link it with a closing keyword so it shows under the
     issue's Development panel. Same repo: `Closes #N`. Other repo (e.g. an Api or
     website companion of an RPP ticket): `Closes cultpodcasts/RedditPodcastPoster#N`.
     Do not use `Refs` for the ticket itself. The ticket stays open until ALL of its
     PRs merge (issue-close sibling guard, cultpodcasts/RedditPodcastPoster#1423).
     List companion PRs and the merge order below. -->

- Closes cultpodcasts/RedditPodcastPoster#
- Companions:

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
