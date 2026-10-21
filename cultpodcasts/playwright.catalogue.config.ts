import { defineConfig, devices } from "@playwright/test";

/** CATALOGUE_E2E_PORT moves the dev server off 4173 when another checkout is already serving there. */
const port = process.env["CATALOGUE_E2E_PORT"] ?? "4173";
const origin = `http://127.0.0.1:${port}`;


/**
 * Real routes, faked search. No Auth0, Cosmos, or public API.
 * Kept off the default e2e config so the setContent suite does not wait on ng serve.
 */
export default defineConfig({
	testDir: "./e2e",
	testMatch: ["catalogue-pages.spec.ts", "browse-filter-fragment.spec.ts", "homepage-hero-desc.spec.ts", "home-chrome-dock.spec.ts", "catalogue-playable-edit.spec.ts"],
	fullyParallel: false,
	retries: 0,
	reporter: "list",
	timeout: 30_000,
	use: {
		baseURL: origin,
		trace: "on-first-retry",
		...devices["Desktop Chrome"]
	},
	webServer: {
		command: `npx ng serve --host 127.0.0.1 --port ${port} --ssl=false`,
		url: origin,
		reuseExistingServer: true,
		timeout: 180_000
	}
});
