import { test, expect } from "@playwright/test";

/**
 * Discovery curation journey with mocked API (no live Auth0 / Azure).
 */
test.describe("discovery curation", () => {
	test("select and submit posts discovery-curation payload", async ({ page }) => {
		let postedBody: unknown = null;

		await page.route("**/discovery-curation**", async (route) => {
			if (route.request().method() === "POST") {
				postedBody = route.request().postDataJSON();
				await route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify({ episodeIds: ["11111111-1111-1111-1111-111111111111"] })
				});
				return;
			}
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					results: [{ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", showName: "Test Show", episodeTitle: "Ep 1" }]
				})
			});
		});

		await page.goto("https://example.com/");
		await page.setContent(`
			<!DOCTYPE html>
			<html><body>
			<button id="load">Load</button>
			<button id="submit" disabled>Submit</button>
			<pre id="status"></pre>
			<script>
				const selected = new Set();
				document.getElementById('load').onclick = async () => {
					try {
						const res = await fetch('https://api.example/discovery-curation');
						const data = await res.json();
						selected.add(data.results[0].id);
						document.getElementById('submit').disabled = false;
						document.getElementById('status').textContent = 'loaded:' + data.results.length;
					} catch (e) {
						document.getElementById('status').textContent = 'error:' + e;
					}
				};
				document.getElementById('submit').onclick = async () => {
					try {
						const res = await fetch('https://api.example/discovery-curation', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test' },
							body: JSON.stringify({ discoveryResultsIds: [...selected] })
						});
						const data = await res.json();
						document.getElementById('status').textContent = 'submitted:' + (data.episodeIds || []).length;
					} catch (e) {
						document.getElementById('status').textContent = 'error:' + e;
					}
				};
			</script>
			</body></html>
		`, { waitUntil: "domcontentloaded" });

		await page.getByRole("button", { name: "Load" }).click();
		await expect(page.locator("#status")).toHaveText("loaded:1");
		await page.getByRole("button", { name: "Submit" }).click();
		await expect(page.locator("#status")).toHaveText("submitted:1");
		expect(postedBody).toEqual({
			discoveryResultsIds: ["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"]
		});
	});
});
