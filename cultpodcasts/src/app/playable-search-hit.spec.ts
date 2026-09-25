import { HttpErrorResponse } from "@angular/common/http";
import { escapedOData, isUnknownSearchFieldError, nextLegacyNameLatch, normalizePlayableHit, playableSeriesField, podcastNameEquals, rewritePlayableSeriesField, seriesNameEquals } from "./playable-search-hit";
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
    expect(escapedOData("a'b")).toBe("a''b");
  });

  it("treats Azure's missing property message and the search proxy's empty 400 as an unknown field", () => {
    const named = new HttpErrorResponse({
      status: 400,
      statusText: "Bad Request",
      error: {
        error: {
          message: "Invalid expression: Could not find a property named 'seriesName' on type 'search.document'.",
        },
      },
    });
    const proxied = new HttpErrorResponse({ status: 400, statusText: "Bad Request", error: {} });
    expect(isUnknownSearchFieldError(named)).toBe(true);
    expect(isUnknownSearchFieldError(proxied)).toBe(true);
  });

  it("does not treat a timeout, a 500, or a bad request as an unknown field", () => {
    expect(isUnknownSearchFieldError(new HttpErrorResponse({ status: 0, statusText: "Unknown Error", error: null }))).toBe(false);
    expect(isUnknownSearchFieldError(new HttpErrorResponse({ status: 500, statusText: "Server Error", error: { message: "timeout" } }))).toBe(false);
    expect(isUnknownSearchFieldError(new HttpErrorResponse({ status: 400, statusText: "Bad Request", error: { error: "Bad request" } }))).toBe(false);
  });

  it("retries the live field once and clears the latch when that retry fails", () => {
    const unknown = new HttpErrorResponse({ status: 400, statusText: "Bad Request", error: {} });
    const server = new HttpErrorResponse({ status: 500, statusText: "Server Error", error: { message: "timeout" } });
    expect(nextLegacyNameLatch(false, server)).toEqual({ legacyNames: false, retry: false });
    expect(nextLegacyNameLatch(false, unknown)).toEqual({ legacyNames: true, retry: true });
    expect(nextLegacyNameLatch(true, server)).toEqual({ legacyNames: false, retry: false });
    expect(playableSeriesField(false)).toBe("seriesName");
    expect(playableSeriesField(true)).toBe("podcastName");
    expect(rewritePlayableSeriesField("search.in(seriesName, 'Show', '£')", true)).toBe("search.in(podcastName, 'Show', '£')");
    expect(rewritePlayableSeriesField("search.in(podcastName, 'Show', '£')", false)).toBe("search.in(seriesName, 'Show', '£')");
  });
});
