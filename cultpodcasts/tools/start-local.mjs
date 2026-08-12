/**
 * Local start: trust .cert/dev-cert.pem for Node prerender HTTPS fetches,
 * then build + wrangler pages with the same cert/key (no TLS ignore hacks).
 */
import { spawn } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cert = join(root, ".cert", "dev-cert.pem");
const key = join(root, ".cert", "dev-key.pem");

if (!existsSync(cert) || !existsSync(key)) {
  console.error("Missing .cert/dev-cert.pem or .cert/dev-key.pem — see AGENTS.md");
  process.exit(1);
}

process.env.NODE_EXTRA_CA_CERTS = cert;

const isWin = process.platform === "win32";
const npm = isWin ? "npm.cmd" : "npm";

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: root,
      env: process.env,
      stdio: "inherit",
      shell: isWin,
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`));
    });
    child.on("error", reject);
  });
}

await run(npm, ["run", "build:local"]);
await run(npm, ["run", "process"]);

const wranglerArgs = [
  "wrangler",
  "pages",
  "dev",
  "dist/cloudflare",
  "--compatibility-date=2024-09-02",
  "--local-protocol",
  "https",
  "--https-cert-path",
  ".cert/dev-cert.pem",
  "--https-key-path",
  ".cert/dev-key.pem",
  "--port",
  "8788",
  "--kv",
  "kv",
  "--r2",
  "content",
];

const wrangler = spawn(isWin ? "npx.cmd" : "npx", wranglerArgs, {
  cwd: root,
  env: process.env,
  stdio: "inherit",
  shell: isWin,
});
wrangler.on("exit", (code) => process.exit(code ?? 1));
