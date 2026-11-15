// Website #669: build-time version. Run with `npm run test:tools` (part of `npm run test:all`).
const test = require('node:test');
const assert = require('node:assert/strict');
const { VERSION_CODE_BASE, resolveBuildVersion, currentBuildVersion } = require('./build-version.cjs');

const sha = 'b457ca5d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b';

test('Cloudflare Pages: base version plus the commit, no run number', () => {
  const info = resolveBuildVersion({ packageVersion: '1.24.44', env: { CF_PAGES_COMMIT_SHA: sha } });
  assert.equal(info.version, '1.24.44+b457ca5');
  assert.equal(info.tagVersion, '1.24.44-b457ca5');
  assert.equal(info.commit, 'b457ca5');
  assert.equal(info.buildNumber, null);
});

test('GitHub Actions: the run number gives a rising Android versionCode above the old semver codes', () => {
  const info = resolveBuildVersion({ packageVersion: '1.24.44', env: { GITHUB_SHA: sha, GITHUB_RUN_NUMBER: '812' } });
  assert.equal(info.version, '1.24.44+b457ca5');
  assert.equal(info.versionCode, VERSION_CODE_BASE + 812);
  assert.ok(info.versionCode > 1 * 10000 + 99 * 100 + 99, 'above any code the old major*10000+minor*100+patch gave');
  const next = resolveBuildVersion({ packageVersion: '1.24.44', env: { GITHUB_SHA: sha, GITHUB_RUN_NUMBER: '813' } });
  assert.ok(next.versionCode > info.versionCode);
  assert.equal(info.iosBuildNumber, '812');
});

test('BUILD_NUMBER wins over GITHUB_RUN_NUMBER, and CF_PAGES_COMMIT_SHA over GITHUB_SHA', () => {
  const info = resolveBuildVersion({
    packageVersion: '2.0.0',
    env: { BUILD_NUMBER: '7', GITHUB_RUN_NUMBER: '900', CF_PAGES_COMMIT_SHA: 'abcdef1234', GITHUB_SHA: sha }
  });
  assert.equal(info.buildNumber, 7);
  assert.equal(info.commit, 'abcdef1');
});

test('local build: git commit, old semver code, epoch-second iOS build number', () => {
  const info = resolveBuildVersion({ packageVersion: '1.24.44', env: {}, gitSha: 'B457CA5', now: 1_700_000_000_000 });
  assert.equal(info.version, '1.24.44+b457ca5');
  assert.equal(info.versionCode, 12444);
  assert.equal(info.iosBuildNumber, '1700000000');
});

test('no commit anywhere: the base version alone', () => {
  const info = resolveBuildVersion({ packageVersion: '1.24.44', env: { GITHUB_SHA: 'not-a-sha' } });
  assert.equal(info.version, '1.24.44');
  assert.equal(info.commit, 'unknown');
});

test('rejects a package.json version that is not x.y.z', () => {
  assert.throws(() => resolveBuildVersion({ packageVersion: '1.24' }), /x\.y\.z/);
  assert.throws(() => resolveBuildVersion({ packageVersion: '1.24.44-beta' }), /x\.y\.z/);
});

test('reads this checkout', () => {
  const info = currentBuildVersion({});
  assert.match(info.version, /^\d+\.\d+\.\d+(\+[0-9a-f]{7})?$/);
});
