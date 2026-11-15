#!/usr/bin/env node
/**
 * Website #669: the app version is worked out at build time. Nothing commits a version: `package.json` keeps a
 * fixed base version (x.y.z), changed by hand in a PR only for a deliberate minor/major release.
 *
 * - `version`: `<base>+<sha7>`, e.g. `1.24.44+b457ca5`. Shown on the privacy page and used as the Android
 *   versionName, so the site and the app built from one commit report the same version.
 * - `tagVersion`: `<base>-<sha7>`, the same with `-` for git tags and release asset names.
 * - `versionCode`: the Android versionCode, which must rise with every release:
 *   VERSION_CODE_OFFSET + the workflow run number (`BUILD_NUMBER`, else `GITHUB_RUN_NUMBER`). With the offset at
 *   100000 that is above every code the old `major*10000 + minor*100 + patch` scheme produced (the last release,
 *   v1.24.44, was 12444). Without a run number (a local build) it falls back to that scheme.
 * - `iosBuildNumber`: CFBundleVersion, the run number when there is one, else epoch seconds.
 *
 * The commit comes from `CF_PAGES_COMMIT_SHA` (Cloudflare Pages), else `GITHUB_SHA` (Actions), else `git`.
 *
 * Usage: `node tools/build-version.cjs` prints the JSON; `--github-output` also appends `version`, `tag`,
 * `apk_name`, `aab_name` and `version_code` to `$GITHUB_OUTPUT`.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

/**
 * The Android versionCode is VERSION_CODE_OFFSET + the `Build Mobile Apps` run number.
 *
 * WARNING: GitHub's run number belongs to the workflow FILE. If `.github/workflows/mobile-build.yml` is renamed or
 * moved, its run number starts again at 1. The Play Store rejects any versionCode that is not higher than every
 * code already uploaded. So in the same PR as the rename or move, raise this offset to at least the highest
 * versionCode released so far (the current offset + the last `Build Mobile Apps` run number, + 1 for Bubblewrap's
 * update). Run 1 of the new file is then above every released code, and each later run rises by one.
 * Changing the workflow's `name:` is safe; only the file path matters.
 */
const VERSION_CODE_OFFSET = 100000;

function shortSha(value) {
  const sha = String(value ?? '').trim();
  return /^[0-9a-f]{7,40}$/i.test(sha) ? sha.slice(0, 7).toLowerCase() : null;
}

function runNumber(env) {
  const raw = String(env.BUILD_NUMBER ?? env.GITHUB_RUN_NUMBER ?? '').trim();
  return /^\d+$/.test(raw) ? parseInt(raw, 10) : null;
}

/** The old semver-derived Android versionCode, kept only as the local fallback. */
function semverVersionCode(base) {
  const [major, minor, patch] = base.split('.').map(part => parseInt(part, 10) || 0);
  return major * 10000 + minor * 100 + patch;
}

function resolveBuildVersion({
  packageVersion,
  env = {},
  gitSha = null,
  now = Date.now(),
  versionCodeOffset = VERSION_CODE_OFFSET
}) {
  const base = String(packageVersion ?? '').trim();
  if (!/^\d+\.\d+\.\d+$/.test(base)) {
    throw new Error(`cultpodcasts/package.json version must be x.y.z, got "${base}"`);
  }
  const commit = shortSha(env.CF_PAGES_COMMIT_SHA) ?? shortSha(env.GITHUB_SHA) ?? shortSha(gitSha) ?? 'unknown';
  const run = runNumber(env);
  const version = commit === 'unknown' ? base : `${base}+${commit}`;
  return {
    base,
    commit,
    buildNumber: run,
    version,
    tagVersion: version.replace('+', '-'),
    versionCode: run === null ? semverVersionCode(base) : versionCodeOffset + run,
    iosBuildNumber: String(run ?? Math.floor(now / 1000))
  };
}

function gitShortSha(cwd) {
  try {
    return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return null;
  }
}

/** The build version for this checkout and environment. */
function currentBuildVersion(env = process.env) {
  const appDir = path.join(__dirname, '..');
  const packageJson = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'));
  return resolveBuildVersion({ packageVersion: packageJson.version, env, gitSha: gitShortSha(appDir) });
}

module.exports = { VERSION_CODE_OFFSET, resolveBuildVersion, currentBuildVersion };

if (require.main === module) {
  const info = currentBuildVersion();
  console.log(JSON.stringify(info, null, 2));
  if (process.argv.includes('--github-output')) {
    const output = process.env.GITHUB_OUTPUT;
    if (!output) {
      throw new Error('--github-output needs GITHUB_OUTPUT');
    }
    fs.appendFileSync(output, [
      `version=${info.version}`,
      `tag=v${info.tagVersion}`,
      `apk_name=cultpodcasts-android-v${info.tagVersion}.apk`,
      `aab_name=cultpodcasts-android-v${info.tagVersion}.aab`,
      `version_code=${info.versionCode}`,
      ''
    ].join('\n'));
  }
}
