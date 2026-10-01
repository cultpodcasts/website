import { TestBed } from "@angular/core/testing";
import { RESPONSE_INIT, provideZonelessChangeDetection } from "@angular/core";
import { provideRouter, Router, UrlTree } from "@angular/router";
import { of, throwError } from "rxjs";
import { HttpErrorResponse } from "@angular/common/http";
import { redirectMovedKind } from "./redirect-moved-kind.guard";
import { EpisodeService } from "./episode.service";
import { GuidService } from "./guid.service";
import { ODataService } from "./odata.service";
import { SearchResult } from "./search-result.interface";

const id = "00112233-4455-4677-8899-aabbccddeeff";

function hit(overrides: Partial<SearchResult>): SearchResult {
  return {
    id,
    podcastName: "Old Show",
    episodeTitle: "One Off",
    episodeDescription: "",
    release: new Date(0),
    duration: "01:00:00",
    ...overrides,
  };
}

describe("redirectMovedKind", () => {
  const guids = new GuidService();

  async function run(
    episode: SearchResult | undefined,
    path: string,
    responseInit?: { status?: number; headers: Headers },
    options?: {
      query?: string | null;
      podcastName?: string;
      seriesHits?: SearchResult[];
      seriesError?: HttpErrorResponse;
    }
  ) {
    const lookedUp: string[] = [];
    const seriesCalls: { filter?: string }[] = [];
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        GuidService,
        ...(responseInit ? [{ provide: RESPONSE_INIT, useValue: responseInit }] : []),
        {
          provide: EpisodeService,
          useValue: {
            GetEpisodeDetailsFromApi: async (episodeId: string) => {
              lookedUp.push(episodeId);
              return episode;
            },
            getPlayableById: async () => episode,
          },
        },
        {
          provide: ODataService,
          useValue: {
            getEntities: (_url: string, request: { filter?: string; top?: number }) => {
              seriesCalls.push(request);
              if (options?.seriesError && seriesCalls.length === 1) {
                return throwError(() => options.seriesError);
              }
              let hits = options?.seriesHits ?? [];
              if (request.filter?.includes("NewsReport") || request.filter?.includes("TvShowEpisode")) {
                hits = hits.filter((row) =>
                  row.contentKind === "NewsReport" || row.contentKind === "TvShowEpisode"
                );
              }
              return of({ entities: hits.slice(0, request.top ?? hits.length) });
            },
          },
        },
      ],
    }).compileComponents();
    const router = TestBed.inject(Router);
    const podcastName = options?.podcastName ?? "Old Show";
    const query = options && "query" in options ? options.query : path.split("/").pop()!;
    const result = await TestBed.runInInjectionContext(() => redirectMovedKind(
      { paramMap: { get: (key: string) => key === "query" ? query : podcastName } } as never,
      { url: path } as never
    ));
    return { result, lookedUp, router, seriesCalls };
  }

  it("resolves an old unprefixed short id to the same guid and sends a film to /film/", async () => {
    const shortId = guids.toBase64(id);
    const responseInit: { status?: number; headers: Headers } = { headers: new Headers() };
    const { result, lookedUp, seriesCalls } = await run(
      hit({ contentKind: "Film", podcastName: "", episodeTitle: "One Off" }),
      `/podcast/${encodeURIComponent("Old Show")}/${shortId}`,
      responseInit
    );
    expect(lookedUp).toEqual([id]);
    expect(seriesCalls).toHaveLength(0);
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe(`/film/${encodeURIComponent("One Off")}/${guids.toCatalogueShortId(id, "Film")}`);
    expect(responseInit.headers.get("Location")).toContain("/film/");
    expect(responseInit.status).toBe(301);
  });

  it("sends a moved TV episode to /tv/ and leaves an Episode on the podcast route", async () => {
    const shortId = guids.toBase64(id);
    const moved = await run(
      hit({ contentKind: "TvShowEpisode", podcastName: "Nightly", episodeTitle: "Part" }),
      `/podcast/Old%20Show/${shortId}`
    );
    expect((moved.result as UrlTree).toString()).toBe(`/tv/${encodeURIComponent("Nightly")}/${guids.toCatalogueShortId(id, "TvShowEpisode")}`);

    const stayed = await run(
      hit({ contentKind: "Episode", podcastName: "Show", episodeTitle: "Part" }),
      `/podcast/Show/${shortId}`
    );
    expect(stayed.result).toBe(true);
  });

  it("sends a moved news report to /news/ and leaves the podcast page for an Episode", async () => {
    const shortId = guids.toBase64(id);
    const moved = await run(
      hit({ contentKind: "NewsReport", podcastName: "Desk", episodeTitle: "Bulletin" }),
      `/podcast/Old%20Show/${shortId}`
    );
    expect((moved.result as UrlTree).toString()).toBe(`/news/${encodeURIComponent("Desk")}/${guids.toCatalogueShortId(id, "NewsReport")}`);

    const stayed = await run(
      hit({ contentKind: "Episode", podcastName: "Show", episodeTitle: "Part" }),
      `/podcast/Show/${guids.toCatalogueShortId(id, "Episode")}`
    );
    expect(stayed.result).toBe(true);
    expect(stayed.lookedUp).toEqual([id]);
  });

  it("sends a transferred news series from /podcast/Name to /news/Name with a 301", async () => {
    const responseInit: { status?: number; headers: Headers } = { headers: new Headers() };
    const { result, lookedUp, seriesCalls } = await run(
      undefined,
      `/podcast/${encodeURIComponent("Show A")}`,
      responseInit,
      {
        query: null,
        podcastName: "Show A",
        seriesHits: [hit({ contentKind: "NewsReport", podcastName: "Show A", episodeTitle: "Bulletin" })],
      }
    );
    expect(lookedUp).toEqual([]);
    expect(seriesCalls[0].filter).toBe(
      "(seriesName eq 'Show A') and (contentKind eq 'NewsReport' or contentKind eq 'TvShowEpisode')"
    );
    expect(result).toBeInstanceOf(UrlTree);
    expect((result as UrlTree).toString()).toBe(`/news/${encodeURIComponent("Show A")}`);
    expect(responseInit.status).toBe(301);
    expect(responseInit.headers.get("Location")).toBe(`/news/${encodeURIComponent("Show A")}`);
  });

  it("sends a transferred TV series from /podcast/Name to /tv/Name", async () => {
    const { result } = await run(
      undefined,
      `/podcast/${encodeURIComponent("Show A")}`,
      undefined,
      {
        query: null,
        podcastName: "Show A",
        seriesHits: [hit({ contentKind: "TvShowEpisode", podcastName: "Show A", episodeTitle: "Part" })],
      }
    );
    expect((result as UrlTree).toString()).toBe(`/tv/${encodeURIComponent("Show A")}`);
  });

  it("leaves a remaining podcast series on /podcast/", async () => {
    const { result, seriesCalls } = await run(
      undefined,
      `/podcast/${encodeURIComponent("Show A")}`,
      undefined,
      {
        query: null,
        podcastName: "Show A",
        seriesHits: [hit({ contentKind: "Episode", podcastName: "Show A", episodeTitle: "Part" })],
      }
    );
    expect(result).toBe(true);
    expect(seriesCalls).toHaveLength(1);
    expect(seriesCalls[0].filter).toContain("NewsReport");
  });

  it("redirects a mixed series when an older NewsReport exists even if the newest row is still Episode", async () => {
    const { result, seriesCalls } = await run(
      undefined,
      `/podcast/${encodeURIComponent("Show A")}`,
      undefined,
      {
        query: null,
        podcastName: "Show A",
        seriesHits: [
          hit({ contentKind: "Episode", podcastName: "Show A", episodeTitle: "Newest", release: new Date("2026-09-01") }),
          hit({
            id: "11112222-3333-4444-5555-666677778888",
            contentKind: "NewsReport",
            podcastName: "Show A",
            episodeTitle: "Older bulletin",
            release: new Date("2026-01-01"),
          }),
        ],
      }
    );
    expect(seriesCalls[0].filter).toContain("NewsReport");
    expect((result as UrlTree).toString()).toBe(`/news/${encodeURIComponent("Show A")}`);
  });

  it("latches podcastName when seriesName is unknown then redirects a NewsReport", async () => {
    const unknownSeriesName = new HttpErrorResponse({
      status: 400,
      statusText: "Bad Request",
      error: {
        error: {
          message: "Invalid expression: Could not find a property named 'seriesName' on type 'search.document'.",
        },
      },
    });
    const { result, seriesCalls } = await run(
      undefined,
      `/podcast/${encodeURIComponent("Show A")}`,
      undefined,
      {
        query: null,
        podcastName: "Show A",
        seriesError: unknownSeriesName,
        seriesHits: [hit({ contentKind: "NewsReport", podcastName: "Show A", episodeTitle: "Bulletin" })],
      }
    );
    expect(seriesCalls).toHaveLength(2);
    expect(seriesCalls[0].filter).toContain("seriesName eq 'Show A'");
    expect(seriesCalls[1].filter).toBe(
      "(podcastName eq 'Show A') and (contentKind eq 'NewsReport' or contentKind eq 'TvShowEpisode')"
    );
    expect((result as UrlTree).toString()).toBe(`/news/${encodeURIComponent("Show A")}`);
  });

  it("stays on /podcast/ when the transferred-kind probe is empty", async () => {
    const { result } = await run(
      undefined,
      `/podcast/${encodeURIComponent("Show A")}`,
      undefined,
      { query: null, podcastName: "Show A", seriesHits: [] }
    );
    expect(result).toBe(true);
  });

  it("stays on /podcast/ when the series probe fails with a non-unknown 500", async () => {
    const { result, seriesCalls } = await run(
      undefined,
      `/podcast/${encodeURIComponent("Show A")}`,
      undefined,
      {
        query: null,
        podcastName: "Show A",
        seriesError: new HttpErrorResponse({ status: 500, statusText: "Server Error", error: { message: "timeout" } }),
      }
    );
    expect(seriesCalls).toHaveLength(1);
    expect(result).toBe(true);
  });

  it("does not redirect a Film hit because Film is not a parent hub", async () => {
    const { result } = await run(
      undefined,
      `/podcast/${encodeURIComponent("Show A")}`,
      undefined,
      {
        query: null,
        podcastName: "Show A",
        seriesHits: [hit({ contentKind: "Film", podcastName: "", episodeTitle: "One Off" })],
      }
    );
    expect(result).toBe(true);
  });
});
