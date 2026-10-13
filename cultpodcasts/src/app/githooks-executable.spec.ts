import { execFileSync } from 'node:child_process';

/** Repo root when running inside a git checkout with git on PATH; otherwise null (e.g. tarball / Pages build). */
function gitTopLevel(): string | null {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
  } catch {
    return null;
  }
}

const root = gitTopLevel();

/** Git must record the pre-push hook as executable (mode 100755), or `core.hooksPath=.githooks` silently skips it. */
describe.skipIf(root === null)('.githooks/pre-push (skipped: no git checkout or git not on PATH)', () => {
  it('is tracked as executable', () => {
    const entry = execFileSync('git', ['ls-files', '-s', '--', '.githooks/pre-push'], { cwd: root!, encoding: 'utf8' });
    expect(entry.split(' ')[0]).toBe('100755');
  });
});
