import { describe, expect, it } from "vitest";
import { CataloguePlayableKind, isCataloguePlayableKindValue } from "./catalogue-playable-kind.enum";

describe("CataloguePlayableKind", () => {
  it("accepts the four wire values and rejects parents and Movie", () => {
    expect(isCataloguePlayableKindValue(CataloguePlayableKind.Episode)).toBe(true);
    expect(isCataloguePlayableKindValue("TvShowEpisode")).toBe(true);
    expect(isCataloguePlayableKindValue("Film")).toBe(true);
    expect(isCataloguePlayableKindValue("NewsReport")).toBe(true);
    expect(isCataloguePlayableKindValue("TvShow")).toBe(false);
    expect(isCataloguePlayableKindValue("NewsOrganisation")).toBe(false);
    expect(isCataloguePlayableKindValue("Movie")).toBe(false);
    expect(isCataloguePlayableKindValue(undefined)).toBe(false);
  });
});
