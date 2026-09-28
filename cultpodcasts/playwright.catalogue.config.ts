import { defineConfig, devices } from "@playwright/test";

/**
 * Real routes, faked search. No Auth0, Cosmos, or public API.
 * Kept off the default e2e config so the setContent suite does not wait on ng serve.
 */
export default defineConfig({
	testDir: "./e2e",
	testMatch: "catalogue-pages.spec.ts",
	fullyParallel: false,
	retries: 0,
	reporter: "list",
	timeout: 30_000,
	use: {
		baseURL: "http://127.0.0.1:4173",
		trace: "on-first-retry",
		...devices["Desktop Chrome"]
	},
	webServer: {
		command: "npx ng serve --host 127.0.0.1 --port 4173 --ssl=false",
		url: "http://127.0.0.1:4173",
		reuseExistingServer: true,
		timeout: 180_000
	}
});
