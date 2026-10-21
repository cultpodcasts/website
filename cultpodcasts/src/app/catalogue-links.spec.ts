import { CatalogueParentKind } from "./catalogue-parent-kind.enum";
import { GuidService } from "./guid.service";
import {
  applyTransferredPodcastKindClose,
  catalogueParentHubCommands,
  catalogueParentLink,
  cataloguePlayableLink,
  catalogueShareUrl,
  catalogueShortPageId,
  filmPageCommands,
  movedKindRedirect,
  movedSeriesHubPath,
  newsReportPageCommands,
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

  it("keeps a podcast episode on /podcast/", () => {
    expect(cataloguePlayableLink(item)).toEqual(["/podcast", "Show", id]);
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

    it("keeps podcast episode links unchanged", () => {
      expect(cataloguePlayableLink({ ...item, contentKind: "Episode" })).toEqual(["/podcast", "Show", id]);
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
