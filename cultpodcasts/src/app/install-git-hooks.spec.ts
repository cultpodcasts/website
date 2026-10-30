import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Repo root when running inside a git checkout with git on PATH; otherwise null. */
function gitTopLevel(): string | null {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || null;
  } catch {
    return null;
  }
}

function hooksPath(cwd: string): string {
  try {
    return execFileSync('git', ['config', '--get', 'core.hooksPath'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

const root = gitTopLevel();
const script = root === null ? '' : join(root, 'cultpodcasts/tools/install-git-hooks.cjs');

describe.skipIf(root === null)('install-git-hooks (skipped: no git checkout or git not on PATH)', () => {
  function tempRepo(): string {
    const dir = mkdtempSync(join(tmpdir(), 'install-git-hooks-'));
    execFileSync('git', ['init', '-q'], { cwd: dir });
    mkdirSync(join(dir, '.githooks'));
    return dir;
  }

  it('does not set core.hooksPath on GitHub Actions', () => {
    const dir = tempRepo();
    const out = execFileSync('node', [script], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, GITHUB_ACTIONS: 'true' },
    });
    expect(out).toContain('not setting core.hooksPath');
    expect(hooksPath(dir)).toBe('');
  });

  it('sets core.hooksPath for a developer clone', () => {
    const dir = tempRepo();
    const env = { ...process.env };
    delete env['GITHUB_ACTIONS'];
    const out = execFileSync('node', [script], {
      cwd: dir,
      encoding: 'utf8',
      env,
    });
    expect(out).toContain('git hooksPath -> .githooks');
    expect(hooksPath(dir)).toBe('.githooks');
  });

  it('pre-push skips the suite when SKIP_CLIENT_TESTS=1', () => {
    const out = execFileSync('sh', [join(root!, '.githooks/pre-push')], {
      cwd: root!,
      encoding: 'utf8',
      env: { ...process.env, SKIP_CLIENT_TESTS: '1' },
    });
    expect(out).toContain('skipping cultpodcasts test:all');
    expect(out).not.toContain('pre-push: npm run test:all');
  });
});
