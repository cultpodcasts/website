import { describe, expect, it } from "vitest";
import { CataloguePlayableKind } from "./catalogue-playable-kind.enum";
import { catalogueSubmitOutcomePhrase, contentKindLabel } from "./content-kind-label";

describe("content kind labels", () => {
  it("names the public kinds", () => {
    expect(contentKindLabel(CataloguePlayableKind.Episode)).toBe("Podcast");
    expect(contentKindLabel(CataloguePlayableKind.TvShowEpisode)).toBe("TV");
    expect(contentKindLabel(CataloguePlayableKind.Film)).toBe("Film");
    expect(contentKindLabel(CataloguePlayableKind.NewsReport)).toBe("News");
  });

  it("does not map Movie and leaves unknown kinds unchanged", () => {
    expect(contentKindLabel("Movie")).toBe("Movie");
    expect(contentKindLabel("TvShow")).toBe("TvShow");
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
