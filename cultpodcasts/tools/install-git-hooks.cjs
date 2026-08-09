/**
 * Point this clone's git hooksPath at repo .githooks/ (pre-push runs test:all).
 * Safe no-op when not inside a git checkout.
 */
const { execSync } = require("node:child_process");
const { existsSync } = require("node:fs");
const { join } = require("node:path");

try {
  const root = execSync("git rev-parse --show-toplevel", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
  const hooksDir = join(root, ".githooks");
  if (!existsSync(hooksDir)) {
    return;
  }
  execSync("git config core.hooksPath .githooks", {
    cwd: root,
    stdio: "inherit",
  });
  console.log("git hooksPath -> .githooks (pre-push runs cultpodcasts test:all)");
} catch {
  // npm ci in a tarball / non-git context
}
