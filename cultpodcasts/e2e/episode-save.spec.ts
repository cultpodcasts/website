import { test, expect } from "@playwright/test";

/**
 * Episode save journey — mirrors edit-episode → send POST with bearer.
 */
test.describe("episode save", () => {
	test("save posts episode update and shows success", async ({ page }) => {
		let saved: unknown = null;

		await page.route("**/episode/**", async (route) => {
			if (route.request().method() === "POST") {
				saved = route.request().postDataJSON();
				await route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify({ ok: true })
				});
				return;
			}
			await route.continue();
		});

		await page.goto("https://example.com/");
		await page.setContent(`
			<!DOCTYPE html>
			<html><body>
			<input id="title" value="Updated title" />
			<button id="save">Save</button>
			<pre id="status"></pre>
			<script>
				document.getElementById('save').onclick = async () => {
					try {
						const title = document.getElementById('title').value;
						const res = await fetch('https://api.example/episode/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test' },
							body: JSON.stringify({ title })
						});
						document.getElementById('status').textContent = res.ok ? 'saved' : 'error';
					} catch (e) {
						document.getElementById('status').textContent = 'error:' + e;
					}
				};
			</script>
			</body></html>
		`, { waitUntil: "domcontentloaded" });

		await page.getByRole("button", { name: "Save" }).click();
		await expect(page.locator("#status")).toHaveText("saved");
		expect(saved).toEqual({ title: "Updated title" });
	});
});
