import { describe, expect, it } from "vitest";
import {
  additionalServiceLinks,
  additionalServiceUrls,
  collectEpisodeServices,
  DEFAULT_UI_SERVICE_KEYS,
  isKnownServiceKey,
  isStreamingServiceKey,
  SERVICE_CATALOG,
  expandSvc,
  resolveServiceKey,
  serviceLabelForUrl
} from "./service-catalog";
import { streamingServiceKeys } from "./streaming-submit-contract";
import { svgIconLiterals } from "./svg-icon-literals";

describe("service-catalog", () => {
  it("keeps SERVICE_CATALOG streaming keys identical to streamingServiceKeys (wire enum parity)", () => {
    const catalogStreaming = SERVICE_CATALOG.map((d) => d.key).filter(isStreamingServiceKey);
    expect(new Set(catalogStreaming)).toEqual(new Set(streamingServiceKeys));
    expect(catalogStreaming).toHaveLength(streamingServiceKeys.length);
    for (const key of DEFAULT_UI_SERVICE_KEYS) {
      expect(isStreamingServiceKey(key)).toBe(false);
      expect(isKnownServiceKey(key)).toBe(true);
    }
    expect(isKnownServiceKey("franceTv")).toBe(true);
    expect(isKnownServiceKey("dailymotioncom")).toBe(false);
  });

  it("expands compact BBC Sounds and Vimeo svc tokens to full URLs", () => {
    const expanded = expandSvc("bbcSounds:p0example|vimeo:123456789");
    expect(expanded.map((x) => x.key)).toEqual(["bbcSounds", "vimeo"]);
    expect(expanded[0].url.href).toBe("https://www.bbc.co.uk/sounds/play/p0example");
    expect(expanded[1].url.href).toBe("https://vimeo.com/123456789");
  });

  it("expands a compact BitChute svc token to the canonical /video/ URL", () => {
    expect(expandSvc("bitchute:32qXfqGEf4Qx")).toEqual([
      { key: "bitchute", url: new URL("https://www.bitchute.com/video/32qXfqGEf4Qx") }
    ]);
  });

  it("expands a compact Tubi svc token to the canonical /movies/{id} URL", () => {
    expect(expandSvc("tubi:movies/1")).toEqual([
      { key: "tubi", url: new URL("https://tubitv.com/movies/1") }
    ]);
  });

  it("resolves Netflix, iPlayer, Paramount+, HBO Max, Play Suisse, and TVNZ+ URLs to catalog keys for logos", () => {
    expect(resolveServiceKey(new URL("https://www.netflix.com/title/80057281"))).toBe("netflix");
    expect(resolveServiceKey(new URL("https://www.bbc.co.uk/iplayer/episode/p0abcd12"))).toBe("bbcIplayer");
    expect(resolveServiceKey(new URL("https://www.paramountplus.com/shows/example/"))).toBe("paramountPlus");
    expect(resolveServiceKey(new URL("https://www.max.com/shows/example"))).toBe("hboMax");
    expect(resolveServiceKey(new URL("https://www.hbomax.com/series/urn:hbo:series:example"))).toBe("hboMax");
    expect(resolveServiceKey(new URL("https://www.playsuisse.ch/watch/example"))).toBe("playSuisse");
    expect(resolveServiceKey(new URL("https://www.rts.ch/play/tv/example-show/video/example-episode"))).toBe("playRts");
    expect(resolveServiceKey(new URL("https://foorts.ch/play/tv/x"))).not.toBe("playRts");
    expect(resolveServiceKey(new URL("https://www.tvnz.co.nz/shows/example"))).toBe("tvnzPlus");
    expect(resolveServiceKey(new URL("https://www.itv.com/watch/example/1a2345"))).toBe("itvx");
    expect(resolveServiceKey(new URL("https://notitv.com/watch/example"))).not.toBe("itvx");
    expect(resolveServiceKey(new URL("https://www.channel4.com/programmes/example"))).toBe("channel4");
    expect(resolveServiceKey(new URL("https://www.all4.com/programmes/example"))).toBe("channel4");
    expect(resolveServiceKey(new URL("https://fawesome.tv/movies/1/example"))).toBe("fawesome");
    expect(resolveServiceKey(new URL("https://www.disneyplus.com/series/example"))).toBe("disneyPlus");
    expect(resolveServiceKey(new URL("https://www.discoveryplus.com/show/example"))).toBe("discoveryPlus");
    expect(resolveServiceKey(new URL('https://www.bitchute.com/video/32qXfqGEf4Qx/'))).toBe("bitchute");
    expect(resolveServiceKey(new URL('https://evilbitchute.com/video/32qXfqGEf4Qx/'))).not.toBe("bitchute");
    expect(resolveServiceKey(new URL("https://tubitv.com/en-au/movies/1/example-slug"))).toBe("tubi");
    expect(resolveServiceKey(new URL("https://eviltubitv.com/movies/1/example-slug"))).not.toBe("tubi");
    expect(resolveServiceKey(new URL("https://www.france.tv/slash/example-show/"))).toBe("franceTv");
    expect(resolveServiceKey(new URL("https://notmax.com/watch"))).toBe("notmaxcom");
  });

  it("registers every catalog icon name in the generated svgIconLiterals map", () => {
    const registered = new Map(svgIconLiterals);
    for (const descriptor of SERVICE_CATALOG) {
      if (descriptor.key === "apple") {
        continue;
      }
      expect(registered.has(descriptor.icon), descriptor.icon).toBe(true);
    }
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
    expect(serviceLabelForUrl("https://www.channel4.com/programmes/example")).toBe("Channel 4");
    expect(serviceLabelForUrl("https://www.itv.com/watch/example/1a2345")).toBe("ITVX");
    expect(serviceLabelForUrl("https://www.disneyplus.com/series/example")).toBe("Disney+");
    expect(serviceLabelForUrl("https://www.discoveryplus.com/show/example")).toBe("discovery+");
    expect(serviceLabelForUrl('https://www.bitchute.com/video/32qXfqGEf4Qx/')).toBe("BitChute");
    expect(serviceLabelForUrl("https://tubitv.com/movies/1/example-slug")).toBe("Tubi");
    expect(serviceLabelForUrl("https://www.france.tv/slash/example-show/")).toBe("France TV");
    expect(serviceLabelForUrl("https://www.playsuisse.ch/watch/example")).toBe("Play Suisse");
    expect(serviceLabelForUrl("https://www.rts.ch/play/tv/example-show/video/example-episode")).toBe("Play RTS");
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
      expect.arrayContaining(["paramountPlus", "hboMax", "playSuisse", "playRts", "tvnzPlus", "itvx", "channel4", "fawesome", "disneyPlus", "discoveryPlus", "bitchute", "tubi", "franceTv"])
    );
    expect(SERVICE_CATALOG.some((d) => d.key === "bitchute")).toBe(true);
    expect(SERVICE_CATALOG.some((d) => d.key === "tubi")).toBe(true);
    expect(resolveServiceKey(new URL("https://www.dailymotion.com/video/xexample"))).toBe("dailymotioncom");
    const links = collectEpisodeServices({
      services: {
        other: { url: "https://cdn.example.test/watch" }
      }
    });
    expect(links.map((x) => x.key)).not.toContain("other");
  });
});
