import { GuidService } from "./guid.service";
import { episodeIdFromRouteQuery } from "./playable-route";

describe("episode route ids", () => {
  const guids = new GuidService();
  const id = "00112233-4455-4677-8899-aabbccddeeff";

  it("reads a legacy unprefixed short id as the same guid", () => {
    expect(episodeIdFromRouteQuery(guids, guids.toBase64(id))).toBe(id);
  });

  it("reads a prefixed film, TV, and news short id as the same guid", () => {
    for (const kind of ["Film", "TvShowEpisode", "NewsReport"]) {
      expect(episodeIdFromRouteQuery(guids, guids.toCatalogueShortId(id, kind))).toBe(id);
    }
  });

  it("reads the raw guid a card puts in the path", () => {
    expect(episodeIdFromRouteQuery(guids, id)).toBe(id);
  });
});
