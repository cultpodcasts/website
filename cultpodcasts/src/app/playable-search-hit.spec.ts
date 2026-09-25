import { escapedOData, normalizePlayableHit, podcastNameEquals, seriesNameEquals } from "./playable-search-hit";
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
});
