import { describe, expect, it } from "vitest";
import {
  additionalServiceUrls,
  collectEpisodeServices,
  DEFAULT_UI_SERVICE_KEYS,
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

  it("resolves Netflix and iPlayer URLs to catalog keys for logos", () => {
    expect(resolveServiceKey(new URL("https://www.netflix.com/title/80057281"))).toBe("netflix");
    expect(resolveServiceKey(new URL("https://www.bbc.co.uk/iplayer/episode/p0abcd12"))).toBe("bbcIplayer");
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

  it("labels a pasted URL from its host so the editor does not need a service picker", () => {
    expect(serviceLabelForUrl("https://vimeo.com/123456789")).toBe("Vimeo");
  });
});
