import fs from "node:fs";
import { EOL } from "node:os";
import { join } from "node:path";
import { worker } from "./paths.mjs";

/**
 * Comment out Angular SSR Node createRequire banner — Workers have no node:module.
 *
 * Angular ≤21:
 *   import { createRequire } from 'node:module';
 *   globalThis['require'] ??= createRequire(import.meta.url);
 *
 * Angular 22+:
 *   import { createRequire as __ngCreateRequire } from 'node:module';
 *   globalThis['require'] ??= __ngCreateRequire(import.meta.url);
 */
const serverPolyfillsFile = join(worker, "polyfills.server.mjs");
const serverPolyfillsData = fs
	.readFileSync(serverPolyfillsFile, "utf8")
	.split(/\r?\n/);

for (let index = 0; index < Math.min(4, serverPolyfillsData.length); index++) {
	const line = serverPolyfillsData[index];
	if (
		!line.startsWith("//") &&
		(line.includes("createRequire") || line.includes("__ngCreateRequire"))
	) {
		serverPolyfillsData[index] = "// " + line;
	}
}

// Add needed polyfills
serverPolyfillsData.unshift(`globalThis['process'] = {};`);

fs.writeFileSync(serverPolyfillsFile, serverPolyfillsData.join(EOL));
