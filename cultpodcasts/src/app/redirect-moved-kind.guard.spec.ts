import { TestBed } from "@angular/core/testing";
import { RESPONSE_INIT, provideZonelessChangeDetection } from "@angular/core";
import { provideRouter, Router, UrlTree } from "@angular/router";
import { redirectMovedKind } from "./redirect-moved-kind.guard";
import { EpisodeService } from "./episode.service";
import { GuidService } from "./guid.service";
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

  async function run(episode: SearchResult | undefined, path: string, responseInit?: { status?: number; headers: Headers }) {
    const lookedUp: string[] = [];
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
      ],
    }).compileComponents();
    const router = TestBed.inject(Router);
    const result = await TestBed.runInInjectionContext(() => redirectMovedKind(
      { paramMap: { get: (key: string) => key === "query" ? path.split("/").pop()! : "Old Show" } } as never,
      { url: path } as never
    ));
    return { result, lookedUp, router };
  }

  it("resolves an old unprefixed short id to the same guid and sends a film to /film/", async () => {
    const shortId = guids.toBase64(id);
    const responseInit: { status?: number; headers: Headers } = { headers: new Headers() };
    const { result, lookedUp } = await run(
      hit({ contentKind: "Film", podcastName: "", episodeTitle: "One Off" }),
      `/podcast/${encodeURIComponent("Old Show")}/${shortId}`,
      responseInit
    );
    expect(lookedUp).toEqual([id]);
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
});
