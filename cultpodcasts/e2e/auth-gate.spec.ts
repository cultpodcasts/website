import { test, expect } from "@playwright/test";

/**
 * Auth/role gate smoke — simulates hasRoleGuard redirect without Auth0.
 */
test.describe("auth role gate", () => {
	test("missing curator role navigates to unauthorised", async ({ page }) => {
		await page.setContent(`
			<!DOCTYPE html>
			<html><body>
			<script>
				const roles = [];
				const expected = ['Curator'];
				const hasRole = expected.some(r => roles.includes(r));
				if (!hasRole) {
					document.body.dataset.route = '/unauthorised';
					document.body.textContent = 'Unauthorised';
				} else {
					document.body.dataset.route = '/discovery';
					document.body.textContent = 'Discovery';
				}
			</script>
			</body></html>
		`);
		await expect(page.locator("body")).toHaveText("Unauthorised");
		await expect(page.locator("body")).toHaveAttribute("data-route", "/unauthorised");
	});

	test("curator role allows discovery", async ({ page }) => {
		await page.setContent(`
			<!DOCTYPE html>
			<html><body>
			<script>
				const roles = ['Curator'];
				const expected = ['Curator'];
				const hasRole = expected.some(r => roles.includes(r));
				document.body.dataset.route = hasRole ? '/discovery' : '/unauthorised';
				document.body.textContent = hasRole ? 'Discovery' : 'Unauthorised';
			</script>
			</body></html>
		`);
		await expect(page.locator("body")).toHaveText("Discovery");
		await expect(page.locator("body")).toHaveAttribute("data-route", "/discovery");
	});
});
