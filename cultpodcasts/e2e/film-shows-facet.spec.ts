import { expect, test, type Page } from "@playwright/test";
import { catalogueE2eOrigin as appOrigin } from "./catalogue-origin";

/**
 * Website #662: films are not filterable by show. A film's search document can carry, in seriesName, the YouTube
 * channel that uploaded it, and that channel can share its name with a podcast. Real routes (ng serve), faked search.
 * Made-up names only.
 */

type Doc = { id: string; title: string; seriesName: string; contentKind: "Episode" | "Film" };

const docs: Doc[] = [
	{ id: "00000000-0000-4000-8000-000000000001", title: "Show A pilot part", seriesName: "Show A", contentKind: "Episode" },
	{ id: "00000000-0000-4000-8000-000000000002", title: "Uploader podcast part", seriesName: "Uploader", contentKind: "Episode" },
	// Films whose seriesName is their YouTube uploader: one shares a podcast's name, one is only a channel.
	{ id: "00000000-0000-4000-8000-000000000003", title: "Uploaded documentary part", seriesName: "Uploader", contentKind: "Film" },
	{ id: "00000000-0000-4000-8000-000000000004", title: "Channel documentary part", seriesName: "Film Channel", contentKind: "Film" }
];

function allowed(filter: string, doc: Doc): boolean {
	if (filter.includes("contentKind ne 'Film'") && doc.contentKind === "Film") {
		return false;
	}
	const kinds = filter.match(/search\.in\(contentKind, '([^']*)'/);
	if (kinds && !kinds[1].split("£").includes(doc.contentKind)) {
		return false;
	}
	const shows = filter.match(/search\.in\((?:seriesName|podcastName), '([^']*)'/);
	return !shows || shows[1].split("£").includes(doc.seriesName);
}

function facet(values: string[]) {
	const counts = new Map<string, number>();
	for (const value of values) {
		counts.set(value, (counts.get(value) ?? 0) + 1);
	}
	return [...counts].map(([value, count]) => ({ value, count }));
}

function search(filter: string, top: number) {
	const hits = docs.filter(doc => allowed(filter, doc));
	return {
		"@odata.count": hits.length,
		"@search.facets": {
			seriesName: facet(hits.map(doc => doc.seriesName)),
			subjects: facet(hits.map(() => "Topic")),
			lang: [],
			contentKind: facet(hits.map(doc => doc.contentKind))
		},
		value: hits.slice(0, top).map(doc => ({
			id: doc.id,
			title: doc.title,
			seriesName: doc.seriesName,
			description: "Desc",
			contentKind: doc.contentKind,
			release: "2026-01-02T00:00:00.000Z",
			duration: "01:00:00",
			subjects: ["Topic"],
			lang: null
		}))
	};
}

test.beforeEach(async ({ page }) => {
	await page.route("**/*", async (route) => {
		const url = route.request().url();
		if (url.startsWith(appOrigin)) {
			await route.continue();
			return;
		}
		if (route.request().method() === "POST" && url.includes("/search")) {
			const body = route.request().postDataJSON() ?? {};
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(search(String(body.filter ?? ""), Number(body.top ?? 20)))
			});
			return;
		}
		await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
	});
});

const showFacet = (page: Page) => page.locator('[aria-label="Filter by podcast"]');
const kindFacet = (page: Page) => page.locator('[aria-label="Filter by kind"]');
const pill = (scope: ReturnType<Page["locator"]>, name: RegExp) => scope.locator(".browse-pill", { hasText: name });

for (const path of ["/subject/Topic", "/search/part"]) {
	test.describe(`films are not filterable by show (#662) on ${path}`, () => {
		test("Shows never offers a film's uploader, Kind = Film has no Shows row, and a show chip leaves films out", async ({ page }) => {
			await page.goto(path);
			await expect(page.getByText("Channel documentary part")).toBeVisible();
			await expect(pill(showFacet(page), /^\s*Show A\s*$/)).toBeVisible();
			// "Uploader" is also a podcast, so it stays a show; "Film Channel" is only a film's uploader.
			await expect(pill(showFacet(page), /^\s*Uploader\s*$/)).toBeVisible();
			await expect(pill(showFacet(page), /Film Channel/)).toHaveCount(0);

			await pill(kindFacet(page), /^\s*Film\s*$/).click();
			await expect(page.getByText("Show A pilot part")).toHaveCount(0);
			await expect(page.getByText("Uploaded documentary part")).toBeVisible();
			await expect(showFacet(page)).toHaveCount(0);

			await pill(kindFacet(page), /^\s*All\s*$/).click();
			await expect(page.getByText("Show A pilot part")).toBeVisible();
			await pill(showFacet(page), /^\s*Uploader\s*$/).click();
			await expect(page.getByText("Uploader podcast part")).toBeVisible();
			await expect(page.getByText("Uploaded documentary part")).toHaveCount(0);
			await expect(page.getByText("Channel documentary part")).toHaveCount(0);
		});
	});
}
