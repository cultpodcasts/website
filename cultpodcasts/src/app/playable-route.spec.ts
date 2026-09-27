import { GuidService } from "./guid.service";
import { episodeIdFromRouteQuery, movedKindRedirect } from "./playable-route";

describe("moved kind routes", () => {
  const guids = new GuidService();
  const id = "00112233-4455-4677-8899-aabbccddeeff";

  it("reads a legacy unprefixed short id as the same guid", () => {
    expect(episodeIdFromRouteQuery(guids, guids.toBase64(id))).toBe(id);
  });

  it("sends a podcast-page guid that is now a film to /film/", () => {
    const target = movedKindRedirect(
      `/podcast/Old%20Show/${id}`,
      { id, contentKind: "Film", episodeTitle: "One Off", podcastName: "" },
      guids
    );
    expect(target).toBe(`/film/${encodeURIComponent("One Off")}/${guids.toCatalogueShortId(id, "Film")}`);
  });

  it("leaves an episode on the podcast page", () => {
    expect(movedKindRedirect(
      `/podcast/Show/${id}`,
      { id, contentKind: "Episode", episodeTitle: "Part", podcastName: "Show" },
      guids
    )).toBeNull();
  });
});
