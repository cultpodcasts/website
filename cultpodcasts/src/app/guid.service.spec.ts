import { GuidService } from "./guid.service";

describe("GuidService catalogue short ids", () => {
  const guids = new GuidService();
  const id = "00112233-4455-4677-8899-aabbccddeeff";

  it("keeps a podcast episode short id unprefixed", () => {
    const encoded = guids.toCatalogueShortId(id, "Episode");
    expect(encoded).toBe(guids.toBase64(id));
    expect(guids.parseCatalogueShortId(encoded)).toEqual({ id, contentKind: null });
  });

  it("prefixes Film, TV, and News and decodes the same id", () => {
    for (const kind of ["Film", "TvShowEpisode", "NewsReport"]) {
      const encoded = guids.toCatalogueShortId(id, kind);
      expect(encoded).not.toBe(guids.toBase64(id));
      expect(guids.parseCatalogueShortId(encoded)).toEqual({ id, contentKind: kind });
    }
  });

  it("keeps an old unprefixed key and points a moved film at /film/", () => {
    const legacy = guids.toBase64(id);
    expect(guids.parseCatalogueShortId(legacy)).toEqual({ id, contentKind: null });
    expect(guids.movedPlayablePath("current-slug", id, "Film")).toBe(
      `/film/current-slug/${guids.toCatalogueShortId(id, "Film")}`
    );
    expect(guids.movedPlayablePath("current-slug", id, "Episode")).toBeNull();
  });
});
