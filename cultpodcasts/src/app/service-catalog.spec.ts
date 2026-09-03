import { describe, expect, it } from "vitest";
import {
  additionalServiceLinks,
  additionalServiceUrls,
  collectEpisodeServices,
  DEFAULT_UI_SERVICE_KEYS,
  SERVICE_CATALOG,
  expandSvc,
  resolveServiceKey,
  serviceLabelForUrl
} from "./service-catalog";

describe("service-catalog", () => {
  it("expands compact BBC Sounds and Vimeo svc tokens to full URLs", () => {
    const expanded = expandSvc("bbcSounds:p0example|vimeo:123456789");
    expect(expanded.map((x) => x.key)).toEqual(["bbcSounds", "vimeo"]);
    expect(expanded[0].url.href).toBe("https://www.bbc.co.uk/sounds/play/p0example");
    expect(expanded[1].url.href).toBe("https://vimeo.com/123456789");
  });

  it("resolves Netflix, iPlayer, Paramount+, HBO Max, Play Suisse, and TVNZ+ URLs to catalog keys for logos", () => {
    expect(resolveServiceKey(new URL("https://www.netflix.com/title/80057281"))).toBe("netflix");
    expect(resolveServiceKey(new URL("https://www.bbc.co.uk/iplayer/episode/p0abcd12"))).toBe("bbcIplayer");
    expect(resolveServiceKey(new URL("https://www.paramountplus.com/shows/example/"))).toBe("paramountPlus");
    expect(resolveServiceKey(new URL("https://www.max.com/shows/example"))).toBe("hboMax");
    expect(resolveServiceKey(new URL("https://www.hbomax.com/series/urn:hbo:series:example"))).toBe("hboMax");
    expect(resolveServiceKey(new URL("https://www.playsuisse.ch/watch/example"))).toBe("playSuisse");
    expect(resolveServiceKey(new URL("https://www.tvnz.co.nz/shows/example"))).toBe("tvnzPlus");
    expect(resolveServiceKey(new URL("https://notmax.com/watch"))).toBe("notmaxcom");
  });

  it("orders every service with a URL in catalog order, including Spotify and Vimeo together", () => {
    const links = collectEpisodeServices({
      spotify: new URL("https://open.spotify.com/episode/opaqueid00000000000000"),
      svc: "vimeo:123456789"
    });
    expect(links.map((x) => x.key)).toEqual(["spotify", "vimeo"]);
  });

  it("lists URLs that are not the default Spotify/Apple/YouTube editor slots", () => {
    expect(DEFAULT_UI_SERVICE_KEYS).toEqual(["spotify", "apple", "youtube"]);
    const extra = additionalServiceUrls({
      spotify: new URL("https://open.spotify.com/episode/opaqueid00000000000000"),
      bbc: new URL("https://www.bbc.co.uk/sounds/play/p0example"),
      svc: "vimeo:123456789"
    });
    expect(extra.map((url) => url.href)).toEqual([
      "https://www.bbc.co.uk/sounds/play/p0example",
      "https://vimeo.com/123456789"
    ]);
  });

  it("pairs extra-service URLs with adjacent services.{key}.image artwork", () => {
    const extra = additionalServiceLinks({
      bbc: new URL("https://www.bbc.co.uk/sounds/play/p0example"),
      services: {
        bbcSounds: { image: "https://ichef.bbci.co.uk/images/ic/1200x675/p0example.jpg" },
        vimeo: { url: "https://vimeo.com/123456789", image: "https://i.vimeocdn.com/video/abc.jpg" }
      }
    });
    expect(extra.map((item) => ({ href: item.url.href, image: item.image?.href }))).toEqual([
      {
        href: "https://www.bbc.co.uk/sounds/play/p0example",
        image: "https://ichef.bbci.co.uk/images/ic/1200x675/p0example.jpg"
      },
      {
        href: "https://vimeo.com/123456789",
        image: "https://i.vimeocdn.com/video/abc.jpg"
      }
    ]);
  });

  it("labels a pasted URL from its host so the editor does not need a service picker", () => {
    expect(serviceLabelForUrl("https://vimeo.com/123456789")).toBe("Vimeo");
  });

  it("reconstructs Spotify and YouTube listen URLs from ids when services are absent", () => {
    const links = collectEpisodeServices({
      ids: { spotify: "opaqueid00000000000000", youtube: "yt123456789" }
    });
    expect(links.map((x) => x.key)).toEqual(["youtube", "spotify"]);
    expect(links[0].url.href).toBe("https://www.youtube.com/watch?v=yt123456789");
    expect(links[1].url.href).toBe("https://open.spotify.com/episode/opaqueid00000000000000");
  });

  it("does not treat other as a defined listen service", () => {
    expect(SERVICE_CATALOG.some((d) => d.key === "other")).toBe(false);
    expect(SERVICE_CATALOG.map((d) => d.key)).toEqual(
      expect.arrayContaining(["paramountPlus", "hboMax", "playSuisse", "tvnzPlus"])
    );
    expect(resolveServiceKey(new URL("https://www.dailymotion.com/video/xexample"))).toBe("dailymotioncom");
    const links = collectEpisodeServices({
      services: {
        other: { url: "https://cdn.example.test/watch" }
      }
    });
    expect(links.map((x) => x.key)).not.toContain("other");
  });
});
