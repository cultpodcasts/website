import { expect, type Page } from "@playwright/test";
import { submitUrlUrls } from "../../src/app/submit-url-contract";

export const URLS = submitUrlUrls;

export type TourRole = "signedOut" | "member" | "curator";

type Intro = {
	kicker: string;
	title: string;
	lede: string;
	points: string[];
	persist: string;
};

type TourApi = {
	showIntro: (d: Intro) => void;
	hideIntro: () => void;
	clearHttp: () => void;
	setRole: (role: TourRole) => void;
	setHome: () => void;
	setPodcastPage: () => void;
	showDrop: (url: string) => void;
};

async function callTour<K extends keyof TourApi>(page: Page, method: K, ...args: Parameters<TourApi[K]>) {
	await page.evaluate(
		([name, params]) => {
			const api = (window as unknown as { __tour: TourApi }).__tour;
			(api[name] as (...a: unknown[]) => void)(...params);
		},
		[method, args] as const
	);
}

export async function showIntro(page: Page, intro: Intro, holdMs: number) {
	await callTour(page, "showIntro", intro);
	await expect(page.locator("#intro-kicker")).toHaveText(intro.kicker);
	await expect(page.locator("#intro-title")).toHaveText(intro.title);
	await expect(page.locator("#intro-lede")).toHaveText(intro.lede);
	await page.waitForTimeout(holdMs);
	await callTour(page, "hideIntro");
	await page.waitForTimeout(600);
}

export async function clearHttp(page: Page) {
	await callTour(page, "clearHttp");
}

/** Full HTTP conversation for one example: every call stays, oldest first, each with a settled status. */
export async function expectHttpConversation(page: Page, verbs: string[]) {
	const cards = page.locator("#http-log .http-call");
	await expect(cards).toHaveCount(verbs.length);
	await expect(page.locator("#http-log .http-call .verb")).toHaveText(verbs);
	await expect(page.locator("#http-log .status.pending")).toHaveCount(0);
	for (let i = 0; i < verbs.length; i++) {
		const card = cards.nth(i);
		await expect(card.locator(".path")).not.toHaveText("");
		await expect(card.locator(".status")).toContainText("←");
	}
}

export async function setRole(page: Page, role: TourRole) {
	await callTour(page, "setRole", role);
	if (role === "curator") {
		await expect(page.locator("#auth-badge")).toHaveText("Signed in · Curator");
	} else if (role === "member") {
		await expect(page.locator("#auth-badge")).toHaveText("Signed in · Submitter");
	} else {
		await expect(page.locator("#auth-badge")).toHaveText("Signed out");
	}
}

export async function setHome(page: Page) {
	await callTour(page, "setHome");
}

export async function setPodcastPage(page: Page) {
	await callTour(page, "setPodcastPage");
}

export async function showDrop(page: Page, url: string) {
	await callTour(page, "showDrop", url);
}

export async function expectSingleDropMessage(page: Page) {
	const overlay = page.locator("#drop-overlay");
	await expect(overlay.locator("#drop-home")).toBeVisible();
	await expect(overlay.locator("#drop-home")).toHaveText("Drop episode link to submit");
	await expect(overlay).toContainText("Drop episode link to submit");
	await expect(overlay).not.toContainText("Submit to Page Show");
	await expect(overlay).not.toContainText("Submit episode link");
	await expect(overlay.locator("#drop-podcast")).toHaveCount(0);
	await expect(overlay.locator("#drop-page")).toHaveCount(0);
	const homeBox = await overlay.locator("#drop-home").boundingBox();
	const overlayBox = await overlay.boundingBox();
	const httpBox = await page.locator("#http-overlay").boundingBox();
	const ghostBox = await page.locator("#ghost-url").boundingBox();
	expect(homeBox, "homepage drop message must layout").toBeTruthy();
	expect(overlayBox, "drop overlay must layout").toBeTruthy();
	expect(httpBox, "HTTP panel must layout").toBeTruthy();
	expect(ghostBox, "ghost URL must layout").toBeTruthy();
	expect(overlayBox!.x + overlayBox!.width).toBeLessThanOrEqual(httpBox!.x + 1);
	expect(homeBox!.x + homeBox!.width).toBeLessThanOrEqual(httpBox!.x + 1);
	expect(ghostBox!.x + ghostBox!.width).toBeLessThanOrEqual(httpBox!.x + 1);
}

export async function expectCuratorPodcastDropTargets(page: Page) {
	const overlay = page.locator("#drop-overlay");
	await expect(overlay.locator("#drop-podcast")).toBeVisible();
	await expect(overlay.locator("#drop-home")).toHaveCount(0);
	await expect(overlay.locator("#drop-page")).toBeVisible();
	await expect(overlay).toContainText("Submit to Page Show");
	await expect(overlay).not.toContainText("Drop episode link to submit");
}

export async function dropGeneral(page: Page, url: string, role: TourRole = "signedOut") {
	await setRole(page, role);
	await setHome(page);
	await showDrop(page, url);
	await expectSingleDropMessage(page);
	await page.locator("#drop-home").click();
}

export async function dropToPage(page: Page, url: string) {
	await setRole(page, "curator");
	await setPodcastPage(page);
	await showDrop(page, url);
	await expectCuratorPodcastDropTargets(page);
	await page.locator("#drop-page").click();
}

export async function openAddPodcast(page: Page) {
	await setHome(page);
	await page.getByRole("button", { name: "Add Podcast" }).click();
	await expect(page.getByRole("dialog", { name: "Add Podcast" })).toBeVisible();
}

export async function fillUrl(page: Page, url: string, typeSlowly: boolean) {
	const field = page.locator("#podcast-url");
	await field.click();
	if (typeSlowly) {
		await field.pressSequentially(url, { delay: 32 });
	} else {
		await field.fill(url);
		await field.dispatchEvent("change");
	}
	await expect(page.locator("#add-save")).toBeEnabled({ timeout: 15_000 });
}

export async function fillSeries(page: Page, name: string, typeSlowly: boolean) {
	await expect(page.locator("#series-panel")).toBeVisible();
	const field = page.locator("#series-name");
	if (typeSlowly) {
		await field.click();
		await field.pressSequentially(name, { delay: 40 });
	} else {
		await field.fill(name);
	}
}

export async function saveAddPodcast(page: Page) {
	await page.getByRole("button", { name: "Save" }).click();
}
