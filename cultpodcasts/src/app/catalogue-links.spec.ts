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
  movedKindRedirect,
  movedSeriesHubPath
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
    expect(cataloguePlayableLink(film)).toEqual(["/film", "One Off", id]);
    expect(catalogueParentLink(film)).toBeNull();
  });

  it("links a TV episode under its show", () => {
    const tv = { ...item, contentKind: "TvShowEpisode" };
    expect(cataloguePlayableLink(tv)).toEqual(["/tv", "Show", id]);
    expect(catalogueParentLink(tv)).toEqual(["/tv", "Show"]);
  });

  it("links a news report under its organisation", () => {
    const news = { ...item, contentKind: "NewsReport" };
    expect(cataloguePlayableLink(news)).toEqual(["/news", "Show", id]);
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
});

describe('cataloguePlayableCommands', () => {
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  const guids = new GuidService();

  it('routes news reports and TV episodes under their parent hub by short id', () => {
    expect(cataloguePlayableCommands('NewsReport', 'Desk', id, guids)).toEqual(['/news', 'Desk', guids.toCatalogueShortId(id, 'NewsReport')]);
    expect(cataloguePlayableCommands('TvShowEpisode', 'Nightly', id, guids)).toEqual(['/tv', 'Nightly', guids.toCatalogueShortId(id, 'TvShowEpisode')]);
  });

  it('is null without a parent name or id, and for films and podcast episodes', () => {
    expect(cataloguePlayableCommands('NewsReport', '', id, guids)).toBeNull();
    expect(cataloguePlayableCommands('NewsReport', 'Desk', undefined, guids)).toBeNull();
    expect(cataloguePlayableCommands('Film', 'One Off', id, guids)).toBeNull();
    expect(cataloguePlayableCommands('Episode', 'Show', id, guids)).toBeNull();
  });
});

describe('review page row links', () => {
  const guids = new GuidService();
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  it('keeps /podcast/{name}/{guid} for podcast episodes and rows without a contentKind', () => {
    expect(reviewPlayableLink({ id, title: 'Part', podcastName: 'Show' }, guids)).toEqual(['/podcast', 'Show', id]);
    expect(reviewPlayableLink({ id, title: 'Part', podcastName: 'Show', contentKind: 'Episode' }, guids)).toEqual(['/podcast', 'Show', id]);
    expect(reviewParentLink({ podcastName: 'Show' })).toEqual(['/podcast', 'Show']);
  });

  it('uses the kind hub and the short base-64 id for news, TV and film', () => {
    expect(reviewPlayableLink({ id, title: 'Bulletin', podcastName: 'Desk', contentKind: 'NewsReport' }, guids))
      .toEqual(['/news', 'Desk', guids.toCatalogueShortId(id, 'NewsReport')]);
    expect(reviewPlayableLink({ id, title: 'Part', podcastName: 'Nightly', contentKind: 'TvShowEpisode' }, guids))
      .toEqual(['/tv', 'Nightly', guids.toCatalogueShortId(id, 'TvShowEpisode')]);
    expect(reviewPlayableLink({ id, title: 'One Off', contentKind: 'Film' }, guids))
      .toEqual(['/film', 'One Off', guids.toCatalogueShortId(id, 'Film')]);
    expect(reviewParentLink({ podcastName: 'Desk', contentKind: 'NewsReport' })).toEqual(['/news', 'Desk']);
    expect(reviewParentLink({ podcastName: 'Nightly', contentKind: 'TvShowEpisode' })).toEqual(['/tv', 'Nightly']);
    expect(reviewParentLink({ podcastName: 'x', contentKind: 'Film' })).toBeNull();
    expect(reviewParentLink({ contentKind: 'NewsReport' })).toBeNull();
  });
});
