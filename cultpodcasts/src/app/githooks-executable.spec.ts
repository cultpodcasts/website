import { execFileSync } from 'node:child_process';

/** Git must record the pre-push hook as executable (mode 100755), or `core.hooksPath=.githooks` silently skips it. */
describe('.githooks/pre-push', () => {
  it('is tracked as executable', () => {
    const entry = execFileSync('git', ['ls-files', '-s', '--', '.githooks/pre-push'], {
      cwd: execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim(),
      encoding: 'utf8'
    });
    expect(entry.split(' ')[0]).toBe('100755');
  });
});
