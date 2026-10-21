/**
 * Dev server for the catalogue Playwright suite (playwright.catalogue.config.ts). CATALOGUE_E2E_PORT moves it
 * off the default 4173 when another checkout is already serving there. The config keeps
 * `reuseExistingServer: true`, so whatever already listens on the chosen port is reused.
 */
export const catalogueE2ePort = process.env["CATALOGUE_E2E_PORT"] ?? "4173";

/** Origin the specs let through their `page.route("**\/*")` fakes. */
export const catalogueE2eOrigin = `http://127.0.0.1:${catalogueE2ePort}`;
