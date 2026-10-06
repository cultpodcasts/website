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

Requires Node per `package.json` `engines` (Angular 22 → Node `>=22.22.3`). Cloudflare Pages reads [`cultpodcasts/.nvmrc`](../.nvmrc) (default image is still 22.16.0).

### Install the project CLI first (avoid the temporary CLI)

If local `@angular/cli` is behind the target, `ng update` prints:

> The installed Angular CLI version is outdated.  
> Installing a temporary Angular CLI versioned …

That temporary CLI works, but it is easy to end up resolving **newer patches than you intended** (caret ranges + npm latest). Prefer:

```bash
# 0. Pick a target that has been on npm ≥5 days, then install that CLI into the project
npm install -D @angular/cli@<target>

# Confirm the project CLI (not a temp one) is what npx will run:
npx ng version
# → "Angular CLI : <target>"
```

Then update with the **same** target for core / CLI / Material so they stay in lockstep:

```bash
# 1. Framework + CLI (applies migrations) — same <target> as step 0
npx ng update @angular/core@<target> @angular/cli@<target>

# 2. Material / CDK (same version as Angular)
npx ng update @angular/material@<target>

# 3. Related runtime deps (peers permitting; prefer ≥5-day-old versions)
npm install @auth0/auth0-angular@latest
npm install -D wrangler@<eligible> @cloudflare/workers-types@<eligible>

# 4. Verify
npm run deps:check
npx ng version   # CLI / Angular / Material versions agree
npx ng build --configuration local
npx ng build --configuration production
npm run process
npm test
```

Prefer `ng update` over hand-editing `@angular/*` versions so schematics run. After `ng update`, if caret ranges (`^22.1.0`) would pull patches newer than your ≥5-day policy, **pin exact versions** in `package.json` until those patches age in.

## npm audit

```bash
npm audit
```

Prefer **`package.json` `overrides`** for transitive CVEs over `npm audit fix --force`, which often downgrades `@angular/cli` or jumps `wrangler` outside the ≥5-day pin.

After changing overrides: `npm install`, then `npm audit` (aim for **0**), then a quick `npm test` / `ng build`.

### Current overrides (Oct 2026)

None. The Aug 2026 pins were removed with the Angular 22.2.1 update after `npm ls` / `npm audit` showed they were no longer needed:

| Former override | Why it stays off |
|-----------------|------------------|
| `@hono/node-server` `2.0.11` | Not in the installed tree. `@angular/cli` 22.2.1 no longer pulls the vulnerable `@modelcontextprotocol/sdk@1.29.0` adapter (`<2.0.5` path traversal; `2.0.0–2.0.9` WebSocket DoS). |
| `undici` `7.29.0` | `wrangler@4.146.0` → `miniflare` depends on `undici@7.29.1`, which is outside the `<7.29.1` advisories. Pinning `7.29.0` reintroduced those CVEs. |

These were **temporary security pins**, not preferred long-term dependency management. Flat overrides were used because this app has a single root `package.json` and those packages only appeared under CLI/wrangler.

### After an Angular CLI or Wrangler bump

There is no `overrides` block. Do not put one back unless `npm audit` reports the `@hono/node-server` or `undici` advisories again.

Re-check after each Angular CLI or Wrangler bump:

```bash
npm ls undici @hono/node-server --all
npm audit
```

The undici floor is ≥ `7.29.1`. The lockfile resolves `undici@7.29.1` (`wrangler` → `miniflare`). Pinning `7.29.0` is inside the `<7.29.1` advisories, so that pin must not return.

`npm audit fix --force` stays forbidden. It often downgrades `@angular/cli` or jumps `wrangler` outside the ≥5-day pin. If audit names these packages again, add a targeted `overrides` entry for the fixed version, then `npm install` and re-run `npm audit`.

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

App uses `provideZonelessChangeDetection()` (Jul 2026). See [zoneless-readiness.md](./zoneless-readiness.md). Do not re-add `zone.js` unless diagnosing a regression.

## Later automation ideas

- CI job: `npm run deps:check` on a schedule; open an issue/PR when exit code is `1`.
- Dependabot/Renovate: group `@angular/*` + `@angular/material` + `@angular/cdk`; ignore `typescript` major until peer widens (or let Renovate respect peer deps).
