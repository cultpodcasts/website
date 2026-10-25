import { expect, test, type Page } from "@playwright/test";
import { catalogueE2eOrigin as appOrigin } from "./catalogue-origin";

/**
 * Bookmarkable browse filters: chip state lives in the URL fragment.
 * Real routes (ng serve), faked search. Made-up shows and episodes only.
 */

type Doc = { id: string; title: string; seriesName: string; lang: string | null; subjects: string[] };

const docs: Doc[] = [
	{ id: "00000000-0000-4000-8000-000000000001", title: "Alpha english part", seriesName: "Show A", lang: null, subjects: ["Topic"] },
	{ id: "00000000-0000-4000-8000-000000000002", title: "Alpha swahili part", seriesName: "Show A", lang: "sw", subjects: ["Topic"] },
	{ id: "00000000-0000-4000-8000-000000000003", title: "Beta swahili part", seriesName: "Show B", lang: "sw", subjects: ["Topic", "Other topic"] },
	{ id: "00000000-0000-4000-8000-000000000004", title: "Beta kikuyu part", seriesName: "Show B", lang: "ki", subjects: ["Topic"] }
];

function langAllowed(filter: string, lang: string | null): boolean {
	if (!filter.includes("lang")) {
		return true;
	}
	if (lang === null) {
		return filter.includes("lang eq null");
	}
	return filter.includes(`lang eq '${lang}'`) || new RegExp(`search\\.in\\(lang, '[^']*\\b${lang}\\b`).test(filter);
}

function showAllowed(filter: string, show: string): boolean {
	const equals = filter.match(/\((?:seriesName|podcastName) eq '([^']*)'\)/);
	if (equals && equals[1] !== show) {
		return false;
	}
	const match = filter.match(/search\.in\((?:seriesName|podcastName), '([^']*)'/);
	return !match || match[1].split("£").includes(show);
}

function subjectsAllowed(filter: string, subjects: string[]): boolean {
	const match = filter.match(/subjects\/any\(s: search\.in\(s, '([^']*)'/);
	return !match || match[1].split("£").some(subject => subjects.includes(subject));
}

function facet(values: (string | null)[]) {
	const counts = new Map<string, number>();
	for (const value of values) {
		if (value) {
			counts.set(value, (counts.get(value) ?? 0) + 1);
		}
	}
	return [...counts].map(([value, count]) => ({ value, count }));
}

function search(filter: string, top: number) {
	const hits = docs.filter(doc => showAllowed(filter, doc.seriesName) && subjectsAllowed(filter, doc.subjects) && langAllowed(filter, doc.lang));
	return {
		"@odata.count": hits.length,
		"@search.facets": {
			seriesName: facet(hits.map(doc => doc.seriesName)),
			subjects: facet(hits.flatMap(doc => doc.subjects)),
			lang: facet(hits.map(doc => doc.lang)),
			contentKind: [{ value: "Episode", count: hits.length }]
		},
		value: hits.slice(0, top).map(doc => ({
			id: doc.id,
			title: doc.title,
			seriesName: doc.seriesName,
			description: "Desc",
			contentKind: "Episode",
			release: "2026-01-02T00:00:00.000Z",
			duration: "01:00:00",
			subjects: doc.subjects,
			lang: doc.lang
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

const languageFacet = (page: Page) => page.locator('[aria-label="Filter by language"]');
const showFacet = (page: Page) => page.locator('[aria-label="Filter by podcast"]');
const subjectFacet = (page: Page) => page.locator('[aria-label="Filter by subject"]');
const pill = (scope: ReturnType<Page["locator"]>, name: RegExp) => scope.locator(".browse-pill", { hasText: name });
// Labels come from languageLabel (being reworked separately); match either the name or the bare code.
const swahili = /Swahili|^\s*sw\s*$/;
const kikuyu = /Kikuyu|^\s*ki\s*$/;

test.describe("browse filters in the URL fragment", () => {
	test("first language click picks just that language, later clicks add, each as its own history entry", async ({ page }) => {
		await page.goto("/subject/Topic");
		await expect(page.getByText("Alpha english part")).toBeVisible();
		await expect(pill(languageFacet(page), /^\s*English\s*$/)).toHaveClass(/is-active/);
		const historyLength = await page.evaluate(() => history.length);

		await pill(languageFacet(page), swahili).click();
		await expect(page).toHaveURL(/\/subject\/Topic#lang=sw$/);
		await expect(page.getByText("Alpha swahili part")).toBeVisible();
		await expect(page.getByText("Alpha english part")).toHaveCount(0);
		await expect(pill(languageFacet(page), /^\s*English\s*$/)).not.toHaveClass(/is-active/);

		await pill(languageFacet(page), kikuyu).click();
		await expect(page).toHaveURL(/#lang=sw,ki$/);
		await expect(page.getByText("Beta kikuyu part")).toBeVisible();
		expect(await page.evaluate(() => history.length)).toBe(historyLength + 2);
	});

	test("Back and Forward step through subject filter selections, then Back leaves the page", async ({ page }) => {
		await page.goto("/search/part");
		await expect(page.getByText("Alpha english part")).toBeVisible();
		await page.goto("/subject/Topic");
		await expect(page.getByText("Alpha english part")).toBeVisible();
		// Survives only while the app is not reloaded.
		await page.evaluate(() => { (window as unknown as { __sameDocument: boolean }).__sameDocument = true; });
		const historyLength = await page.evaluate(() => history.length);
		const english = pill(languageFacet(page), /^\s*English\s*$/);

		await pill(languageFacet(page), swahili).click();
		await expect(page).toHaveURL(/\/subject\/Topic#lang=sw$/);
		await expect(page.getByText("Alpha swahili part")).toBeVisible();
		await pill(languageFacet(page), kikuyu).click();
		await expect(page).toHaveURL(/#lang=sw,ki$/);
		await expect(page.getByText("Beta kikuyu part")).toBeVisible();
		expect(await page.evaluate(() => history.length)).toBe(historyLength + 2);

		await page.goBack();
		await expect(page).toHaveURL(/\/subject\/Topic#lang=sw$/);
		await expect(pill(languageFacet(page), swahili)).toHaveClass(/is-active/);
		await expect(pill(languageFacet(page), kikuyu)).not.toHaveClass(/is-active/);
		await expect(page.getByText("Alpha swahili part")).toBeVisible();
		await expect(page.getByText("Beta kikuyu part")).toHaveCount(0);

		await page.goBack();
		await expect(page).toHaveURL(/\/subject\/Topic$/);
		await expect(english).toHaveClass(/is-active/);
		await expect(pill(languageFacet(page), swahili)).not.toHaveClass(/is-active/);
		await expect(page.getByText("Alpha english part")).toBeVisible();
		await expect(page.getByText("Alpha swahili part")).toHaveCount(0);

		await page.goForward();
		await expect(page).toHaveURL(/#lang=sw$/);
		await expect(pill(languageFacet(page), swahili)).toHaveClass(/is-active/);
		await expect(page.getByText("Alpha swahili part")).toBeVisible();
		await expect(page.getByText("Alpha english part")).toHaveCount(0);

		await page.goForward();
		await expect(page).toHaveURL(/#lang=sw,ki$/);
		await expect(pill(languageFacet(page), kikuyu)).toHaveClass(/is-active/);
		await expect(page.getByText("Beta kikuyu part")).toBeVisible();
		expect(await page.evaluate(() => (window as unknown as { __sameDocument?: boolean }).__sameDocument)).toBe(true);

		await page.goBack();
		await page.goBack();
		await expect(page).toHaveURL(/\/subject\/Topic$/);
		await expect(page.getByText("Alpha english part")).toBeVisible();
		await page.goBack();
		await expect(page).toHaveURL(/\/search\/part$/);
	});

	test("tidying an invalid fragment on load adds no history entry", async ({ page }) => {
		await page.goto("/search/part");
		await expect(page.getByText("Alpha english part")).toBeVisible();
		await page.goto("/subject/Topic#lang=zz&show=Missing%20show");
		// Tidy runs after search facets return; wait for results first so a slow
		// POST under suite load does not fail the URL assert on the pre-tidy hash.
		await expect(page.getByText("Beta kikuyu part")).toBeVisible();
		await expect(page).toHaveURL(/\/subject\/Topic#lang=all$/);

		await page.goBack();
		await expect(page).toHaveURL(/\/search\/part$/);
	});

	test("a bookmarked subject URL restores show and language chips", async ({ page }) => {
		await page.goto("/subject/Topic#show=Show%20B&lang=ki");
		await expect(page.getByText("Beta kikuyu part")).toBeVisible();
		await expect(page.getByText("Beta swahili part")).toHaveCount(0);
		await expect(page.getByText("Alpha english part")).toHaveCount(0);
		await expect(pill(showFacet(page), /Show B/)).toHaveClass(/is-active/);
		await expect(pill(showFacet(page), /Show A/)).toBeVisible();
		await expect(pill(languageFacet(page), kikuyu)).toHaveClass(/is-active/);

		await page.reload();
		await expect(page.getByText("Beta kikuyu part")).toBeVisible();
		await expect(page).toHaveURL(/#show=Show%20B&lang=ki$/);
	});

	test("a bookmarked search URL restores the show chip and Clear filters removes the fragment", async ({ page }) => {
		await page.goto("/search/part#show=Show%20B");
		await expect(page.getByText("Beta kikuyu part")).toBeVisible();
		await expect(page.getByText("Alpha english part")).toHaveCount(0);
		await expect(pill(showFacet(page), /Show B/)).toHaveClass(/is-active/);

		await page.getByRole("button", { name: "Clear filters" }).click();
		await expect(page).toHaveURL(/\/search\/part$/);
		await expect(page.getByText("Alpha english part")).toBeVisible();

		// Clear filters is a filter change too: Back brings the show chip back.
		await page.goBack();
		await expect(page).toHaveURL(/\/search\/part#show=Show%20B$/);
		await expect(pill(showFacet(page), /Show B/)).toHaveClass(/is-active/);
		await expect(page.getByText("Alpha english part")).toHaveCount(0);
		await expect(page.getByText("Beta kikuyu part")).toBeVisible();

		await page.goForward();
		await expect(page).toHaveURL(/\/search\/part$/);
		await expect(page.getByText("Alpha english part")).toBeVisible();
	});

	test("podcast page subject chips go to the fragment and a bookmark restores them", async ({ page }) => {
		await page.goto("/podcast/Show%20B");
		await expect(page.getByText("Beta kikuyu part")).toBeVisible();
		const historyLength = await page.evaluate(() => history.length);

		await pill(subjectFacet(page), /Other topic/).click();
		await expect(page).toHaveURL(/\/podcast\/Show%20B#subject=Other%20topic$/);
		await expect(page.getByText("Beta kikuyu part")).toHaveCount(0);
		await expect(page.getByText("Beta swahili part")).toBeVisible();
		expect(await page.evaluate(() => history.length)).toBe(historyLength + 1);

		await page.goBack();
		await expect(page).toHaveURL(/\/podcast\/Show%20B$/);
		await expect(pill(subjectFacet(page), /Other topic/)).not.toHaveClass(/is-active/);
		await expect(page.getByText("Beta kikuyu part")).toBeVisible();

		await page.goForward();
		await expect(page).toHaveURL(/#subject=Other%20topic$/);
		await expect(pill(subjectFacet(page), /Other topic/)).toHaveClass(/is-active/);
		await expect(page.getByText("Beta kikuyu part")).toHaveCount(0);

		// Clearing back to no fragment is still its own entry.
		await page.getByRole("button", { name: "Clear filters" }).click();
		await expect(page).toHaveURL(/\/podcast\/Show%20B$/);
		await expect(page.getByText("Beta kikuyu part")).toBeVisible();
		await page.goBack();
		await expect(page).toHaveURL(/#subject=Other%20topic$/);
		await expect(page.getByText("Beta kikuyu part")).toHaveCount(0);

		await page.reload();
		await expect(page.getByText("Beta swahili part")).toBeVisible();
		await expect(page.getByText("Beta kikuyu part")).toHaveCount(0);
		await expect(pill(subjectFacet(page), /Other topic/)).toHaveClass(/is-active/);
		await expect(pill(subjectFacet(page), /^\s*Topic\s*$/)).toBeVisible();
	});
});
