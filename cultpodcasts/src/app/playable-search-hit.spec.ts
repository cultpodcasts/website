import { HttpErrorResponse } from "@angular/common/http";
import { escapedOData, isUnknownContentKindField, isUnknownSearchFieldError, isUnknownSeriesNameField, nextLegacyNameLatch, normalizePlayableHit, playableSeriesField, podcastNameEquals, rewritePlayableSeriesField, seriesNameEquals, unknownSearchFieldName, contentKindEquals, catalogueHubFilter, subjectsAnySearchIn, transferredSeriesHubFilter } from "./playable-search-hit";
import { SearchResult } from "./search-result.interface";

describe("playable search hits", () => {
  it("prefers the rebuilt field names and falls back to the live names", () => {
    const rebuilt = normalizePlayableHit({
      id: "1",
      title: "New title",
      seriesName: "New series",
      description: "New blurb",
      episodeTitle: "Old title",
      podcastName: "Old series",
      episodeDescription: "Old blurb",
      release: new Date(0),
      duration: "00:01:00",
    } as SearchResult & { title: string; seriesName: string; description: string });
    expect(rebuilt.episodeTitle).toBe("New title");
    expect(rebuilt.podcastName).toBe("New series");
    expect(rebuilt.episodeDescription).toBe("New blurb");

    const live = normalizePlayableHit({
      id: "1",
      episodeTitle: "Old title",
      podcastName: "Old series",
      episodeDescription: "Old blurb",
      release: new Date(0),
      duration: "00:01:00",
    });
    expect(live.episodeTitle).toBe("Old title");
  });

  it("escapes quotes in series and podcast filters", () => {
    expect(seriesNameEquals("O'Hara")).toBe("(seriesName eq 'O''Hara')");
    expect(podcastNameEquals("O'Hara")).toBe("(podcastName eq 'O''Hara')");
    expect(contentKindEquals("TvShowEpisode")).toBe("(contentKind eq 'TvShowEpisode')");
    expect(catalogueHubFilter("O'Hara", "tv", false)).toBe(
      "(contentKind eq 'TvShowEpisode') and (seriesName eq 'O''Hara')"
    );
    expect(catalogueHubFilter("Desk", "news", true)).toBe(
      "(contentKind eq 'NewsReport') and (podcastName eq 'Desk')"
    );
    expect(escapedOData("a'b")).toBe("a''b");
    expect(subjectsAnySearchIn([])).toBe("");
    expect(subjectsAnySearchIn(["World"])).toBe(" and subjects/any(s: search.in(s, 'World', '£'))");
    expect(subjectsAnySearchIn(["O'Hara", "World"])).toBe(
      " and subjects/any(s: search.in(s, 'O''Hara£World', '£'))"
    );
    expect(transferredSeriesHubFilter("Show A", false)).toBe(
      "(seriesName eq 'Show A') and (contentKind eq 'NewsReport' or contentKind eq 'TvShowEpisode')"
    );
    expect(transferredSeriesHubFilter("O'Hara", true)).toBe(
      "(podcastName eq 'O''Hara') and (contentKind eq 'NewsReport' or contentKind eq 'TvShowEpisode')"
    );
  });

  it("treats Azure's named missing-property message as an unknown field", () => {
    const named = new HttpErrorResponse({
      status: 400,
      statusText: "Bad Request",
      error: {
        error: {
          message: "Invalid expression: Could not find a property named 'seriesName' on type 'search.document'.",
        },
      },
    });
    expect(isUnknownSearchFieldError(named)).toBe(true);
    expect(unknownSearchFieldName(named)).toBe("seriesName");
    expect(isUnknownSeriesNameField(named)).toBe(true);
    expect(isUnknownContentKindField(named)).toBe(false);

    const kindNamed = new HttpErrorResponse({
      status: 400,
      statusText: "Bad Request",
      error: {
        error: {
          message: "Invalid expression: Could not find a property named 'contentKind' on type 'search.document'.",
        },
      },
    });
    expect(unknownSearchFieldName(kindNamed)).toBe("contentKind");
    expect(isUnknownSeriesNameField(kindNamed)).toBe(false);
    expect(isUnknownContentKindField(kindNamed)).toBe(true);
  });

  it("does not treat an opaque empty 400, timeout, 500, or generic bad request as an unknown field", () => {
    expect(isUnknownSearchFieldError(new HttpErrorResponse({ status: 400, statusText: "Bad Request", error: {} }))).toBe(false);
    expect(isUnknownSearchFieldError(new HttpErrorResponse({ status: 0, statusText: "Unknown Error", error: null }))).toBe(false);
    expect(isUnknownSearchFieldError(new HttpErrorResponse({ status: 500, statusText: "Server Error", error: { message: "timeout" } }))).toBe(false);
    expect(isUnknownSearchFieldError(new HttpErrorResponse({ status: 400, statusText: "Bad Request", error: { error: "Bad request" } }))).toBe(false);
    expect(isUnknownContentKindField(new HttpErrorResponse({ status: 400, statusText: "Bad Request", error: {} }))).toBe(false);
  });

  it("retries podcastName only when Azure names seriesName or podcastName, then clears the latch", () => {
    const seriesMissing = new HttpErrorResponse({
      status: 400,
      statusText: "Bad Request",
      error: {
        error: {
          message: "Could not find a property named 'seriesName' on type 'search.document'.",
        },
      },
    });
    const podcastMissing = new HttpErrorResponse({
      status: 400,
      statusText: "Bad Request",
      error: {
        error: {
          message: "Could not find a property named 'podcastName' on type 'search.document'.",
        },
      },
    });
    const opaque = new HttpErrorResponse({ status: 400, statusText: "Bad Request", error: {} });
    const kindMissing = new HttpErrorResponse({
      status: 400,
      statusText: "Bad Request",
      error: {
        error: {
          message: "Could not find a property named 'contentKind' on type 'search.document'.",
        },
      },
    });
    const server = new HttpErrorResponse({ status: 500, statusText: "Server Error", error: { message: "timeout" } });
    expect(nextLegacyNameLatch(false, server)).toEqual({ legacyNames: false, retry: false });
    expect(nextLegacyNameLatch(false, opaque)).toEqual({ legacyNames: false, retry: false });
    expect(nextLegacyNameLatch(false, kindMissing)).toEqual({ legacyNames: false, retry: false });
    expect(nextLegacyNameLatch(false, seriesMissing)).toEqual({ legacyNames: true, retry: true });
    expect(nextLegacyNameLatch(false, podcastMissing)).toEqual({ legacyNames: true, retry: true });
    expect(nextLegacyNameLatch(true, server)).toEqual({ legacyNames: false, retry: false });
    expect(playableSeriesField(false)).toBe("seriesName");
    expect(playableSeriesField(true)).toBe("podcastName");
    expect(rewritePlayableSeriesField("search.in(seriesName, 'Show', '£')", true)).toBe("search.in(podcastName, 'Show', '£')");
    expect(rewritePlayableSeriesField("search.in(podcastName, 'Show', '£')", false)).toBe("search.in(seriesName, 'Show', '£')");
  });
});
