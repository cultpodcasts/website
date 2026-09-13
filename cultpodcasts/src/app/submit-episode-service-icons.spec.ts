import { describe, expect, it } from "vitest";
import { submitEpisodeServiceIconRows } from "./submit-episode-service-icons";

describe("submitEpisodeServiceIconRows", () => {
  it("emits only the default trio from named flags when extraServiceKeys is absent", () => {
    const rows = submitEpisodeServiceIconRows({
      spotify: true,
      apple: true,
      youtube: true
    });
    expect(rows.map((row) => row.key)).toEqual(["spotify", "apple", "youtube"]);
    expect(rows.map((row) => row.icon)).toEqual(["spotify", "apple", "youtube"]);
    expect(rows.map((row) => row.usesAppleMark)).toEqual([false, true, false]);
  });

  it("appends catalog icon names for extraServiceKeys vimeo and bitchute", () => {
    const rows = submitEpisodeServiceIconRows({
      spotify: false,
      apple: false,
      youtube: false,
      extraServiceKeys: ["vimeo", "bitchute"]
    });
    expect(rows.map((row) => row.key)).toEqual(["vimeo", "bitchute"]);
    expect(rows.map((row) => row.icon)).toEqual(["vimeo", "bitchute"]);
    expect(rows.map((row) => row.displayName)).toEqual(["Vimeo", "BitChute"]);
  });

  it("falls back to the external-service icon for an unknown extraServiceKeys entry", () => {
    const rows = submitEpisodeServiceIconRows({
      spotify: false,
      apple: false,
      youtube: false,
      extraServiceKeys: ["notARealService"]
    });
    expect(rows).toEqual([
      {
        key: "notARealService",
        icon: "external-service",
        displayName: "notARealService",
        usesAppleMark: false
      }
    ]);
  });

  it("skips stray Spotify Apple YouTube keys in extraServiceKeys so they cannot double-render", () => {
    const rows = submitEpisodeServiceIconRows({
      spotify: true,
      apple: false,
      youtube: false,
      extraServiceKeys: ["spotify", "apple", "youtube", "tubi"]
    });
    expect(rows.map((row) => row.key)).toEqual(["spotify", "tubi"]);
  });

  it("treats null extraServiceKeys as an empty list", () => {
    const rows = submitEpisodeServiceIconRows({
      spotify: true,
      apple: false,
      youtube: false,
      extraServiceKeys: null
    });
    expect(rows.map((row) => row.key)).toEqual(["spotify"]);
  });
});
