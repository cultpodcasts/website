#!/usr/bin/env node
/**
 * Report Angular / Material / TypeScript update posture.
 * See docs/dependency-updates.md
 *
 * Exit: 0 = ok / optional only, 1 = actionable Angular/Material/TS bump, 2 = error
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function installed(name) {
  try {
    return require(join(root, 'node_modules', name, 'package.json')).version;
  } catch {
    return null;
  }
}

function npmView(args) {
  const out = execFileSync('npm', ['view', ...args], {
    encoding: 'utf8',
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
  return out;
}

function latest(name) {
  return npmView([name, 'version']);
}

function peerTypescript(compilerCliVersion) {
  const raw = npmView([`@angular/compiler-cli@${compilerCliVersion}`, 'peerDependencies', '--json']);
  const peers = JSON.parse(raw);
  return peers.typescript ?? null;
}

/** Very small semver-range check for patterns Angular uses: ">=X.Y <A.B" */
function rangeAllows(range, version) {
  if (!range || !version) return false;
  const ge = range.match(/>=\s*(\d+)\.(\d+)(?:\.(\d+))?/);
  const lt = range.match(/<\s*(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!ge || !lt) {
    return null; // unknown shape
  }
  const [vMaj, vMin, vPat] = version.split('.').map((n) => parseInt(n, 10));
  const geT = [parseInt(ge[1], 10), parseInt(ge[2], 10), parseInt(ge[3] ?? '0', 10)];
  const ltT = [parseInt(lt[1], 10), parseInt(lt[2], 10), parseInt(lt[3] ?? '0', 10)];
  const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
  const v = [vMaj, vMin, vPat || 0];
  return cmp(v, geT) >= 0 && cmp(v, ltT) < 0;
}

const rows = [
  ['@angular/core', installed('@angular/core')],
  ['@angular/cli', installed('@angular/cli')],
  ['@angular/material', installed('@angular/material')],
  ['typescript', installed('typescript')],
  ['@auth0/auth0-angular', installed('@auth0/auth0-angular')],
  ['wrangler', installed('wrangler')]
];

console.log('Dependency update check\n');
console.log('Package'.padEnd(28), 'Installed'.padEnd(14), 'Latest');
console.log('-'.repeat(56));

let actionable = false;
const latestByName = {};

for (const [name, ver] of rows) {
  let lat;
  try {
    lat = latest(name);
  } catch (e) {
    console.error(`Failed to query npm for ${name}:`, e.message);
    process.exit(2);
  }
  latestByName[name] = lat;
  const marker = ver && lat && ver !== lat && !lat.startsWith(ver.split('-')[0]) ? ' ←' : '';
  // Treat as update if latest is different (simple string compare is enough for display;
  // actionable flag refined below for angular/ts).
  console.log(name.padEnd(28), (ver ?? 'missing').padEnd(14), lat + marker);
}

const coreInstalled = installed('@angular/core');
const coreLatest = latestByName['@angular/core'];
const materialInstalled = installed('@angular/material');
const materialLatest = latestByName['@angular/material'];
const tsInstalled = installed('typescript');
const tsLatest = latestByName['typescript'];
const compilerCli = installed('@angular/compiler-cli') ?? coreInstalled;

let peerRange;
try {
  peerRange = peerTypescript(compilerCli);
} catch (e) {
  console.error('\nFailed to read @angular/compiler-cli peerDependencies:', e.message);
  process.exit(2);
}

console.log('\nTypeScript peer from @angular/compiler-cli@%s: %s', compilerCli, peerRange ?? '(none)');

const latestTsAllowed = rangeAllows(peerRange, tsLatest);
const installedTsAllowed = rangeAllows(peerRange, tsInstalled);

if (latestTsAllowed === true) {
  if (tsInstalled !== tsLatest) {
    console.log('TS update allowed: can install typescript@%s (within peer %s)', tsLatest, peerRange);
    actionable = true;
  } else {
    console.log('TypeScript is latest and within Angular peer — nothing to do for TS.');
  }
} else if (latestTsAllowed === false) {
  console.log(
    'TS update blocked: npm latest typescript@%s is outside peer %s — stay on %s until Angular widens the peer.',
    tsLatest,
    peerRange,
    tsInstalled
  );
} else {
  console.log('Could not parse peer range %s — check manually.', peerRange);
}

if (installedTsAllowed === false) {
  console.log('WARNING: installed typescript@%s is outside Angular peer %s', tsInstalled, peerRange);
  actionable = true;
}

function major(v) {
  return v?.split('.')[0];
}

if (coreInstalled && coreLatest && major(coreInstalled) !== major(coreLatest)) {
  console.log('\nAngular major available: %s → %s  (use ng update)', coreInstalled, coreLatest);
  actionable = true;
} else if (coreInstalled && coreLatest && coreInstalled !== coreLatest) {
  console.log('\nAngular patch/minor available: %s → %s  (ng update @angular/core @angular/cli)', coreInstalled, coreLatest);
  actionable = true;
} else {
  console.log('\nAngular core is up to date (%s).', coreInstalled);
}

if (materialInstalled && materialLatest && materialInstalled !== materialLatest) {
  console.log('Material available: %s → %s  (ng update @angular/material)', materialInstalled, materialLatest);
  actionable = true;
} else {
  console.log('Material is up to date (%s).', materialInstalled);
}

console.log('\nSee docs/dependency-updates.md for the update recipe.');
process.exit(actionable ? 1 : 0);
