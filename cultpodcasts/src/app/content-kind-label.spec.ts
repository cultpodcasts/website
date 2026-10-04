import { describe, expect, it } from "vitest";
import { catalogueSubmitOutcomePhrase, contentKindLabel } from "./content-kind-label";

describe("content kind labels", () => {
  it("names the public kinds", () => {
    expect(contentKindLabel("Episode")).toBe("Podcast");
    expect(contentKindLabel("TvShowEpisode")).toBe("TV");
    expect(contentKindLabel("Film")).toBe("Film");
    expect(contentKindLabel("NewsReport")).toBe("News");
  });
});

describe("catalogueSubmitOutcomePhrase", () => {
  it("matches podcast snackbar verbs for Created, already exists, Enriched, and Ignored", () => {
    expect(catalogueSubmitOutcomePhrase("Created")).toBe("created");
    expect(catalogueSubmitOutcomePhrase("EpisodeAlreadyExists")).toBe("already exists");
    expect(catalogueSubmitOutcomePhrase("Enriched")).toBe("enriched");
    expect(catalogueSubmitOutcomePhrase("Ignored")).toBe("ignored");
  });

  it("falls back to saved for other outcomes", () => {
    expect(catalogueSubmitOutcomePhrase(undefined)).toBe("saved");
    expect(catalogueSubmitOutcomePhrase("PodcastRemoved")).toBe("saved");
  });

  it("composes TV / Film / News copy without using Episode created", () => {
    expect(`${contentKindLabel("TvShowEpisode")} ${catalogueSubmitOutcomePhrase("Created")}.`).toBe("TV created.");
    expect(`${contentKindLabel("Film")} ${catalogueSubmitOutcomePhrase("Enriched")}.`).toBe("Film enriched.");
    expect(`${contentKindLabel("NewsReport")} ${catalogueSubmitOutcomePhrase("Ignored")}.`).toBe("News ignored.");
  });
});
