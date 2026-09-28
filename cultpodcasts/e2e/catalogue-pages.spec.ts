import { expect, test } from "@playwright/test";
import { GuidService } from "../src/app/guid.service";

const id = "00112233-4455-4677-8899-aabbccddeeff";
const guids = new GuidService();

function documentFor(kind: string, title: string, parent: string) {
	return {
		id,
		title,
		seriesName: parent,
		description: "Desc",
		contentKind: kind,
		release: "2026-01-02T00:00:00.000Z",
		duration: "01:00:00"
	};
}

function documentsForFilter(filter: string) {
	if (filter.includes("eq 'One Off'")) {
		return [documentFor("Film", "One Off", "")];
	}
	if (filter.includes("eq 'Nightly'")) {
		return [documentFor("TvShowEpisode", "Part", "Nightly")];
	}
	if (filter.includes("eq 'Desk'")) {
		return [documentFor("NewsReport", "Bulletin", "Desk")];
	}
	if (filter.includes("eq 'Show'")) {
		return [documentFor("Episode", "Part", "Show")];
	}
	if (filter.includes(id) && !filter.includes("seriesName") && !filter.includes("podcastName")) {
		return [documentFor("Film", "One Off", "")];
	}
	return [];
}

test.beforeEach(async ({ page }) => {
	await page.route("**/*", async (route) => {
		const url = route.request().url();
		if (url.startsWith("http://127.0.0.1:4173")) {
			await route.continue();
			return;
		}
		if (route.request().method() === "POST" && url.includes("/search")) {
			const filter = String(route.request().postDataJSON()?.filter ?? "");
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ value: documentsForFilter(filter) })
			});
			return;
		}
		await route.fulfill({
			status: 200,
			contentType: "application/json",
			body: "{}"
		});
	});
});

test.describe("catalogue pages with a faked search API", () => {
	test("a film short id shows the title and no parent", async ({ page }) => {
		const shortId = guids.toCatalogueShortId(id, "Film");
		await page.goto(`/film/${encodeURIComponent("One Off")}/${shortId}`);
		await expect(page.getByRole("heading", { name: "One Off" })).toBeVisible();
		await expect(page.locator("a.hero-pill")).toHaveCount(0);
	});

	test("an old podcast short id for a film leaves for /film/ without saying not found", async ({ page }) => {
		const legacy = guids.toBase64(id);
		await page.goto(`/podcast/${encodeURIComponent("Old Show")}/${legacy}`);
		await expect(page).toHaveURL(new RegExp(`/film/${encodeURIComponent("One Off")}/`));
		await expect(page.getByText("Episode not found")).toHaveCount(0);
		await expect(page.getByRole("heading", { name: "One Off" })).toBeVisible();
	});

	test("a news organisation hub lists the report from the faked search", async ({ page }) => {
		await page.goto(`/news/${encodeURIComponent("Desk")}`);
		await expect(page.getByRole("heading", { name: "Desk" })).toBeVisible();
		await expect(page.getByText("Bulletin")).toBeVisible();
	});

	test("a podcast episode stays on /podcast/", async ({ page }) => {
		const shortId = guids.toBase64(id);
		await page.goto(`/podcast/${encodeURIComponent("Show")}/${shortId}`);
		await expect(page).toHaveURL(new RegExp(`/podcast/${encodeURIComponent("Show")}/${shortId}`));
		await expect(page.getByText("Part")).toBeVisible();
		await expect(page.getByText("Episode not found")).toHaveCount(0);
	});
});
