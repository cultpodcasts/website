import { HttpErrorResponse } from "@angular/common/http";
import { Observable, of, throwError } from "rxjs";
import { EpisodeService } from "./episode.service";
import { SearchResult } from "./search-result.interface";

function unknownField(): HttpErrorResponse {
  return new HttpErrorResponse({
    status: 400,
    statusText: "Bad Request",
    error: {
      error: {
        message: "Invalid expression: Could not find a property named 'seriesName' on type 'search.document'.",
      },
    },
  });
}

function hit(fields: Partial<SearchResult> & { title?: string; seriesName?: string }): SearchResult {
  return {
    id: "ep-1",
    podcastName: "",
    episodeTitle: "",
    episodeDescription: "",
    release: new Date(0),
    duration: "00:01:00",
    ...fields,
  };
}

function service(respond: (filter: string) => Observable<unknown>) {
  const filters: string[] = [];
  const episode = new EpisodeService({
    getEntities: (_url: string, request: { filter: string }) => {
      filters.push(request.filter);
      return respond(request.filter);
    },
  } as never, {} as never);
  return { filters, episode };
}

describe("EpisodeService", () => {
  it("returns the one seriesName hit and does not query podcastName", async () => {
    const { filters, episode } = service(() => of({
      status: 200,
      entities: [hit({ title: "Hello", seriesName: "Show" })],
    }));

    const found = await episode.GetEpisodeDetailsFromApi("ep-1", "Show");

    expect(found?.episodeTitle).toBe("Hello");
    expect(found?.podcastName).toBe("Show");
    expect(filters).toEqual(["(seriesName eq 'Show') and (id eq 'ep-1')"]);
  });

  it("returns undefined when seriesName is 200 and the hit count is not one, without querying podcastName", async () => {
    for (const entities of [[], [hit({}), hit({})]]) {
      const { filters, episode } = service(() => of({ status: 200, entities }));
      await expect(episode.GetEpisodeDetailsFromApi("ep-1", "Show")).resolves.toBeUndefined();
      expect(filters).toEqual(["(seriesName eq 'Show') and (id eq 'ep-1')"]);
    }
  });

  it("queries podcastName only when seriesName fails as an unknown field", async () => {
    const { filters, episode } = service((filter) => {
      if (filter.includes("seriesName")) {
        return throwError(() => unknownField());
      }
      return of({ status: 200, entities: [hit({ episodeTitle: "Live", podcastName: "Show" })] });
    });

    const found = await episode.GetEpisodeDetailsFromApi("ep-1", "Show");

    expect(found?.episodeTitle).toBe("Live");
    expect(filters[0]).toContain("seriesName");
    expect(filters[1]).toContain("podcastName");
    expect(filters).toHaveLength(2);
  });

  it("throws and does not query podcastName when seriesName fails for another reason", async () => {
    const server = new HttpErrorResponse({ status: 500, statusText: "Server Error", error: { message: "timeout" } });
    const { filters, episode } = service(() => throwError(() => server));

    await expect(episode.GetEpisodeDetailsFromApi("ep-1", "Show")).rejects.toBe(server);
    expect(filters).toHaveLength(1);
    expect(filters[0]).toContain("seriesName");
  });
});
