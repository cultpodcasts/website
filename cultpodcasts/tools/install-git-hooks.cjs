/**
 * Point this clone's git hooksPath at repo .githooks/ (pre-push runs test:all).
 * Safe no-op when not inside a git checkout.
 *
 * GitHub Actions sets GITHUB_ACTIONS=true. Those jobs are not developer clones:
 * cultpodcasts-tests.yml already runs the suite (and installs Playwright).
 * Arming the hook here makes release-android's `git push` of the semver tag
 * re-run test:all with no browser installed.
 */
const { execSync } = require("node:child_process");
const { existsSync } = require("node:fs");
const { join } = require("node:path");

try {
  if (process.env.GITHUB_ACTIONS === "true") {
    console.log(
      "GitHub Actions — not setting core.hooksPath (pre-push runs test:all for developer clones only)",
    );
  } else {
    const root = execSync("git rev-parse --show-toplevel", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const hooksDir = join(root, ".githooks");
    if (existsSync(hooksDir)) {
      execSync("git config core.hooksPath .githooks", {
        cwd: root,
        stdio: "inherit",
      });
      console.log("git hooksPath -> .githooks (pre-push runs cultpodcasts test:all)");
    }
  }
} catch {
  // npm ci in a tarball / non-git context
}
