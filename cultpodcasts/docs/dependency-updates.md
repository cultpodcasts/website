# Dependency updates (Angular / Material / TypeScript)

Keep framework packages in lockstep. **Do not** bump TypeScript past what `@angular/compiler-cli` declares as its peer range.

## Why TypeScript may look “behind”

| Fact | Implication |
|------|-------------|
| npm `typescript` latest can be ahead of Angular | Angular pins a **narrow** peer (e.g. `>=6.0 <6.1`) |
| `ng update` sets TS to that range | After an Angular major, TS is already at the max Angular allows |
| Forcing a newer TS with `--force` | Breaks peers and often the Angular compiler |

**Rule:** update Angular (and Material) first; TypeScript follows only as far as the new Angular peer allows.

## Quick check (automated)

```bash
npm run deps:check
```

Prints installed vs latest for Angular, Material, TypeScript, Auth0, Wrangler, and whether a newer TypeScript is **allowed** by the installed `@angular/compiler-cli` peer.

Exit codes:

| Code | Meaning |
|------|---------|
| `0` | Nothing actionable, or only optional bumps outside the Angular/TS gate |
| `1` | Angular/Material (or allowed TS) can be updated — run the steps below |
| `2` | Script/tooling error |

## Manual update (Angular major/minor)

Requires Node per `package.json` `engines` (Angular 22 → Node `>=22.22.3`).

From `website/cultpodcasts`:

```bash
# 1. Framework + CLI (applies migrations)
npx ng update @angular/core@<major> @angular/cli@<major>

# 2. Material / CDK (same major as Angular)
npx ng update @angular/material@<major>

# 3. Related runtime deps (peers permitting)
npm install @auth0/auth0-angular@latest
npm install -D wrangler@latest @cloudflare/workers-types@latest

# 4. Verify
npm run deps:check
npx ng build --configuration local
npx ng build --configuration production
npm run process
npx ng test --no-watch --browsers=ChromeHeadless
```

Prefer `ng update` over hand-editing `@angular/*` versions so schematics run.

## TypeScript only

```bash
npm run deps:check
```

- If it says **TS update allowed** → install the highest version inside the peer range (script prints the target).
- If it says **blocked by Angular peer** → wait for a newer `@angular/compiler-cli` (usually next Angular release), then `ng update` again.

Do **not** install TypeScript 7+ while the peer is still `<6.1` (or whatever the check prints).

## Preview / Auth0 after staging deploys

Preview hosts change; Auth0 redirect uses runtime origin. See [auth0-preview-hosts.md](./auth0-preview-hosts.md).

## Zoneless

Zone is still required until the checklist in [zoneless-readiness.md](./zoneless-readiness.md) is done. Framework bumps do not imply dropping `zone.js`.

## Later automation ideas

- CI job: `npm run deps:check` on a schedule; open an issue/PR when exit code is `1`.
- Dependabot/Renovate: group `@angular/*` + `@angular/material` + `@angular/cdk`; ignore `typescript` major until peer widens (or let Renovate respect peer deps).
