import { defineConfig, devices } from "@playwright/test";

/**
 * Behavior-first e2e harness. Prefer route mocks over live Auth0.
 * Set PLAYWRIGHT_BASE_URL to exercise a running app (8788 or 4200).
 * Default fixtures run without a live Angular server.
 */
export default defineConfig({
	testDir: "./e2e",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: "list",
	use: {
		baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4173",
		trace: "on-first-retry",
		...devices["Desktop Chrome"]
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }]
});
