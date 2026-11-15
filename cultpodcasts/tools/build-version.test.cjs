// Website #669: build-time version. Run with `npm run test:tools` (part of `npm run test:all`).
const test = require('node:test');
const assert = require('node:assert/strict');
const { VERSION_CODE_OFFSET, resolveBuildVersion, currentBuildVersion } = require('./build-version.cjs');

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
  assert.equal(info.versionCode, 100812);
  assert.ok(info.versionCode > 1 * 10000 + 99 * 100 + 99, 'above any code the old major*10000+minor*100+patch gave');
  const next = resolveBuildVersion({ packageVersion: '1.24.44', env: { GITHUB_SHA: sha, GITHUB_RUN_NUMBER: '813' } });
  assert.ok(next.versionCode > info.versionCode);
  assert.equal(info.iosBuildNumber, '812');
});

test('the versionCode is the offset + run, and the offset is above every code the old scheme released', () => {
  assert.equal(VERSION_CODE_OFFSET, 100000);
  // The old scheme's last release, v1.24.44, was 1*10000 + 24*100 + 44 = 12444 (+1 from Bubblewrap's update).
  const run1 = resolveBuildVersion({ packageVersion: '1.24.44', env: { GITHUB_RUN_NUMBER: '1' } });
  assert.equal(run1.versionCode, VERSION_CODE_OFFSET + 1);
  assert.ok(run1.versionCode > 12445);
});

test('a renamed workflow: after the offset bump, codes stay strictly increasing across the rename', () => {
  const code = (run, versionCodeOffset) =>
    resolveBuildVersion({ packageVersion: '1.24.44', env: { GITHUB_RUN_NUMBER: String(run) }, versionCodeOffset })
      .versionCode;
  // The old file's last runs, then the rename: the run number restarts at 1 and the offset is raised to the highest
  // released code (+ 1 for Bubblewrap's update), as build-version.cjs says.
  const oldFile = [452, 453, 454].map(run => code(run, VERSION_CODE_OFFSET));
  const raisedOffset = Math.max(...oldFile) + 1;
  const newFile = [1, 2, 3].map(run => code(run, raisedOffset));
  const codes = [...oldFile, ...newFile];
  for (let i = 1; i < codes.length; i++) {
    assert.ok(codes[i] > codes[i - 1], `code ${codes[i]} after ${codes[i - 1]} must be higher`);
  }
  assert.equal(new Set(codes).size, codes.length, 'no code is repeated');
  // Without the bump, run 1 of the renamed file would fall below codes already released.
  assert.ok(code(1, VERSION_CODE_OFFSET) < Math.max(...oldFile));
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
