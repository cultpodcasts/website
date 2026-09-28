import { GuidService } from "../guid.service";
import { catalogueParentLink, cataloguePlayableLink, movedKindRedirect } from "./catalogue-links";

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
});
