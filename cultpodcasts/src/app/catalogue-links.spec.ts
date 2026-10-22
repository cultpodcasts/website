import { CatalogueParentKind } from "./catalogue-parent-kind.enum";
import { GuidService } from "./guid.service";
import {
  applyTransferredPodcastKindClose,
  catalogueParentHubCommands,
  cataloguePlayableCommands,
  reviewParentLink,
  reviewPlayableLink,
  catalogueParentLink,
  cataloguePlayableLink,
  catalogueShareUrl,
  catalogueShortPageId,
  filmPageCommands,
  movedKindRedirect,
  movedSeriesHubPath,
  newsReportPageCommands,
  podcastEpisodePageCommands,
  podcastEpisodeShortIdRedirect,
  podcastEpisodeShortPageId,
  samePath,
  tvShowEpisodePageCommands
} from "./catalogue-links";

describe("catalogue links", () => {
  const guids = new GuidService();
  const id = "00112233-4455-4677-8899-aabbccddeeff";
  const item = {
    id,
    episodeTitle: "One Off",
    podcastName: "Show",
    episodeDescription: "",
    release: new Date(),
    duration: "1:00",
  };

  it("links a film to /film/ and gives it no parent", () => {
    const film = { ...item, contentKind: "Film", podcastName: "Studio" };
    expect(cataloguePlayableLink(film)).toEqual(["/film", "One Off", guids.toCatalogueShortId(id, "Film")]);
    expect(catalogueParentLink(film)).toBeNull();
  });

  it("links a TV episode under its show", () => {
    const tv = { ...item, contentKind: "TvShowEpisode" };
    expect(cataloguePlayableLink(tv)).toEqual(["/tv", "Show", guids.toCatalogueShortId(id, "TvShowEpisode")]);
    expect(catalogueParentLink(tv)).toEqual(["/tv", "Show"]);
  });

  it("links a news report under its organisation", () => {
    const news = { ...item, contentKind: "NewsReport" };
    expect(cataloguePlayableLink(news)).toEqual(["/news", "Show", guids.toCatalogueShortId(id, "NewsReport")]);
    expect(catalogueParentLink(news)).toEqual(["/news", "Show"]);
  });

  it("keeps a podcast episode on /podcast/ with its unprefixed short id", () => {
    expect(cataloguePlayableLink(item)).toEqual(["/podcast", "Show", guids.toBase64(id)]);
    expect(catalogueParentLink(item)).toEqual(["/podcast", "Show"]);
    expect(movedKindRedirect(`/podcast/Show/${id}`, { ...item, contentKind: "Episode" }, guids)).toBeNull();
  });

  it("sends an old podcast guid that is now a film to /film/", () => {
    const target = movedKindRedirect(
      `/podcast/Old%20Show/${id}`,
      { id, contentKind: "Film", episodeTitle: "One Off", podcastName: "" },
      guids
    );
    expect(target).toBe(`/film/${encodeURIComponent("One Off")}/${guids.toCatalogueShortId(id, "Film")}`);
  });

  it("maps TV and news parent kinds to slug hubs and rejects unexpected kinds", () => {
    expect(catalogueParentHubCommands(CatalogueParentKind.TvShow, "Show A")).toEqual(["/tv", "Show A"]);
    expect(catalogueParentHubCommands(CatalogueParentKind.NewsOrganisation, "Show A")).toEqual(["/news", "Show A"]);
    expect(catalogueParentHubCommands("Film" as CatalogueParentKind, "Show A")).toBeNull();
    expect(catalogueParentHubCommands(undefined, "Show A")).toBeNull();
    expect(catalogueParentHubCommands(CatalogueParentKind.TvShow, "")).toBeNull();
  });

  it("navigates a transferred TV close to /tv/slug and stays put for an unknown kind", () => {
    const snackBar = { open: vi.fn() };
    const router = { navigate: vi.fn() };

    expect(applyTransferredPodcastKindClose(
      { transferred: true, targetKind: CatalogueParentKind.TvShow },
      "Show A",
      snackBar,
      router
    )).toBe(true);
    expect(router.navigate).toHaveBeenCalledWith(["/tv", "Show A"]);

    router.navigate.mockClear();
    expect(applyTransferredPodcastKindClose(
      { transferred: true, targetKind: CatalogueParentKind.NewsOrganisation },
      "Show A",
      snackBar,
      router
    )).toBe(true);
    expect(router.navigate).toHaveBeenCalledWith(["/news", "Show A"]);

    router.navigate.mockClear();
    expect(applyTransferredPodcastKindClose(
      { transferred: true, targetKind: "Film" as CatalogueParentKind },
      "Show A",
      snackBar,
      router
    )).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
    expect(snackBar.open).toHaveBeenCalledWith(
      "Podcast transferred but destination is unknown",
      "Ok",
      { duration: 10000 }
    );

    expect(applyTransferredPodcastKindClose({ updated: true } as never, "Show A", snackBar, router)).toBe(false);
  });

  it("sends a transferred news or TV series off /podcast/ and leaves a podcast series", () => {
    expect(movedSeriesHubPath("/podcast/Show%20A", "Show A", "NewsReport")).toBe(`/news/${encodeURIComponent("Show A")}`);
    expect(movedSeriesHubPath("/podcast/Show%20A", "Show A", "TvShowEpisode")).toBe(`/tv/${encodeURIComponent("Show A")}`);
    expect(movedSeriesHubPath("/podcast/Show%20A", "Show A", "Episode")).toBeNull();
    expect(movedSeriesHubPath(`/news/${encodeURIComponent("Show A")}`, "Show A", "NewsReport")).toBeNull();
  });

  describe("short page ids", () => {
    it("uses the kind-prefixed short id for film, TV, and news pages and never the raw guid", () => {
      const film = filmPageCommands("One Off", id);
      const tv = tvShowEpisodePageCommands("Show", id);
      const news = newsReportPageCommands("Desk", id);
      expect(film).toEqual(["/film", "One Off", guids.toCatalogueShortId(id, "Film")]);
      expect(tv).toEqual(["/tv", "Show", guids.toCatalogueShortId(id, "TvShowEpisode")]);
      expect(news).toEqual(["/news", "Desk", guids.toCatalogueShortId(id, "NewsReport")]);
      for (const commands of [film, tv, news]) {
        expect(commands[2]).not.toMatch(/^[0-9a-f]{8}-/i);
        expect(commands[2]).not.toBe(id);
        expect(guids.parseCatalogueShortId(commands[2])?.id).toBe(id);
      }
      expect(guids.parseCatalogueShortId(film[2])?.contentKind).toBe("Film");
      expect(guids.parseCatalogueShortId(tv[2])?.contentKind).toBe("TvShowEpisode");
      expect(guids.parseCatalogueShortId(news[2])?.contentKind).toBe("NewsReport");
    });

    it("builds exactly the path the moved-kind redirect expects, so a card click has no 301 hop", () => {
      for (const kind of ["Film", "TvShowEpisode", "NewsReport"] as const) {
        const episode = { ...item, contentKind: kind, podcastName: "Law & Order: SVU" };
        const commands = cataloguePlayableLink(episode);
        const path = `${commands[0]}/${encodeURIComponent(commands[1])}/${commands[2]}`;
        expect(movedKindRedirect(path, episode, guids)).toBeNull();
      }
    });

    it("leaves non-guid ids untouched", () => {
      expect(catalogueShortPageId("not-a-guid", "NewsReport")).toBe("not-a-guid");
      expect(catalogueShortPageId("", "Film")).toBe("");
    });

    it("links podcast episodes (Episode or no kind) by the unprefixed 22-char short id", () => {
      const short = guids.toBase64(id);
      expect(short).toHaveLength(22);
      expect(cataloguePlayableLink({ ...item, contentKind: "Episode" })).toEqual(["/podcast", "Show", short]);
      expect(cataloguePlayableLink(item)).toEqual(["/podcast", "Show", short]);
      expect(podcastEpisodePageCommands("Show", id)).toEqual(["/podcast", "Show", short]);
      expect(guids.parseCatalogueShortId(short)).toEqual({ id, contentKind: null });
    });

    it("leaves non-guid podcast episode ids untouched", () => {
      expect(podcastEpisodeShortPageId("id-1")).toBe("id-1");
      expect(podcastEpisodeShortPageId("")).toBe("");
    });
  });

  describe("podcast episode GUID redirect", () => {
    it("moves a full GUID URL to the short id once", () => {
      const short = guids.toBase64(id);
      expect(podcastEpisodeShortIdRedirect(`/podcast/Show/${id}`, "Show", id)).toBe(`/podcast/Show/${short}`);
      expect(podcastEpisodeShortIdRedirect(`/podcast/Show/${short}`, "Show", short)).toBeNull();
    });

    it("encodes the podcast name and never loops when it has reserved characters", () => {
      const name = "Law & Order: Pod, $ @";
      const target = podcastEpisodeShortIdRedirect(`/podcast/Law%20&%20Order:%20Pod,%20$%20@/${id}`, name, id)!;
      expect(target).toBe(`/podcast/${encodeURIComponent(name)}/${guids.toBase64(id)}`);
      expect(podcastEpisodeShortIdRedirect(target, name, guids.toBase64(id))).toBeNull();
    });

    it("ignores search terms, short ids, and a missing podcast name", () => {
      expect(podcastEpisodeShortIdRedirect("/podcast/Show/cults", "Show", "cults")).toBeNull();
      expect(podcastEpisodeShortIdRedirect(`/podcast//${id}`, "", id)).toBeNull();
    });
  });

  describe("samePath", () => {
    it("treats router-style and encodeURIComponent-style slugs as the same path", () => {
      expect(samePath("/tv/Law%20&%20Order:%20SVU/abc", `/tv/${encodeURIComponent("Law & Order: SVU")}/abc`)).toBe(true);
      expect(samePath("/news/A%2CB/abc?x=1#top", "/news/A,B/abc")).toBe(true);
      expect(samePath("/news/Desk/abc", "/news/Desk/abd")).toBe(false);
    });

    it("does not loop a TV episode whose show name has reserved characters", () => {
      const episode = { ...item, contentKind: "TvShowEpisode", podcastName: "Law & Order" };
      const short = guids.toCatalogueShortId(id, "TvShowEpisode");
      expect(movedKindRedirect(`/tv/Law%20&%20Order/${short}`, episode, guids)).toBeNull();
      expect(movedKindRedirect(`/tv/Law%20&%20Order/${id}`, episode, guids))
        .toBe(`/tv/${encodeURIComponent("Law & Order")}/${short}`);
    });
  });

  describe("share urls", () => {
    const origin = "https://example.test";
    const shortner = "https://s.example.test";

    it("shares film, TV, and news as their own page with the prefixed short id", () => {
      expect(catalogueShareUrl({ ...item, contentKind: "NewsReport", podcastName: "A & B" }, origin, shortner))
        .toBe(`${origin}/news/A%20%26%20B/${guids.toCatalogueShortId(id, "NewsReport")}`);
      expect(catalogueShareUrl({ ...item, contentKind: "TvShowEpisode" }, origin, shortner))
        .toBe(`${origin}/tv/Show/${guids.toCatalogueShortId(id, "TvShowEpisode")}`);
      expect(catalogueShareUrl({ ...item, contentKind: "Film" }, origin, shortner))
        .toBe(`${origin}/film/One%20Off/${guids.toCatalogueShortId(id, "Film")}`);
    });

    it("keeps podcast episodes on the 22-character shortener key", () => {
      const url = catalogueShareUrl({ ...item, contentKind: "Episode" }, origin, shortner);
      expect(url).toBe(`${shortner}/${guids.toBase64(id)}`);
      expect(guids.toBase64(id)).toHaveLength(22);
    });
  });
});

describe('cataloguePlayableCommands', () => {
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const guids = new GuidService();

  it('routes news reports and TV episodes under their parent hub by short id', () => {
    expect(cataloguePlayableCommands('NewsReport', 'Desk', id)).toEqual(['/news', 'Desk', guids.toCatalogueShortId(id, 'NewsReport')]);
    expect(cataloguePlayableCommands('TvShowEpisode', 'Nightly', id)).toEqual(['/tv', 'Nightly', guids.toCatalogueShortId(id, 'TvShowEpisode')]);
  });

  it('is null without a parent name or id, and for films and podcast episodes', () => {
    expect(cataloguePlayableCommands('NewsReport', '', id)).toBeNull();
    expect(cataloguePlayableCommands('NewsReport', 'Desk', undefined)).toBeNull();
    expect(cataloguePlayableCommands('Film', 'One Off', id)).toBeNull();
    expect(cataloguePlayableCommands('Episode', 'Show', id)).toBeNull();
  });
});

describe('review page row links', () => {
  const guids = new GuidService();
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  it('links podcast episodes and rows without a contentKind to /podcast/{name}/{shortId}', () => {
    expect(reviewPlayableLink({ id, title: 'Part', podcastName: 'Show' })).toEqual(['/podcast', 'Show', guids.toBase64(id)]);
    expect(reviewPlayableLink({ id, title: 'Part', podcastName: 'Show', contentKind: 'Episode' })).toEqual(['/podcast', 'Show', guids.toBase64(id)]);
    expect(reviewParentLink({ podcastName: 'Show' })).toEqual(['/podcast', 'Show']);
  });

  it('uses the API path as-is when GET /episode/{id} returns one', () => {
    expect(reviewPlayableLink({ id, title: 'Bulletin', contentKind: 'NewsReport', path: '/news/NBC%20News/bqqq' }))
      .toBe('/news/NBC%20News/bqqq');
  });

  it('prefers parentName / slug from the API for the fallback and parent links', () => {
    expect(reviewPlayableLink({ id, title: 'Part', podcastName: 'x', parentName: 'Nightly', contentKind: 'TvShowEpisode' }))
      .toEqual(['/tv', 'Nightly', guids.toCatalogueShortId(id, 'TvShowEpisode')]);
    expect(reviewPlayableLink({ id, title: 'One Off (2020)', slug: 'One Off', contentKind: 'Film' }))
      .toEqual(['/film', 'One Off', guids.toCatalogueShortId(id, 'Film')]);
    expect(reviewParentLink({ podcastName: 'x', parentName: 'Desk', contentKind: 'NewsReport' })).toEqual(['/news', 'Desk']);
  });

  it('uses the kind hub and the short base-64 id for news, TV and film', () => {
    expect(reviewPlayableLink({ id, title: 'Bulletin', podcastName: 'Desk', contentKind: 'NewsReport' }))
      .toEqual(['/news', 'Desk', guids.toCatalogueShortId(id, 'NewsReport')]);
    expect(reviewPlayableLink({ id, title: 'Part', podcastName: 'Nightly', contentKind: 'TvShowEpisode' }))
      .toEqual(['/tv', 'Nightly', guids.toCatalogueShortId(id, 'TvShowEpisode')]);
    expect(reviewPlayableLink({ id, title: 'One Off', contentKind: 'Film' }))
      .toEqual(['/film', 'One Off', guids.toCatalogueShortId(id, 'Film')]);
    expect(reviewParentLink({ podcastName: 'Desk', contentKind: 'NewsReport' })).toEqual(['/news', 'Desk']);
    expect(reviewParentLink({ podcastName: 'Nightly', contentKind: 'TvShowEpisode' })).toEqual(['/tv', 'Nightly']);
    expect(reviewParentLink({ podcastName: 'x', contentKind: 'Film' })).toBeNull();
    expect(reviewParentLink({ contentKind: 'NewsReport' })).toBeNull();
  });
});
