import { appleUrl, episodeArtAspect, episodeImageUrl, expandImage, isYoutubeThumbnailUrl, spotifyUrl, youtubeUrl } from "./search-result-links";
import { SearchResult } from "./search-result.interface";
import { HomepageEpisode } from "./homepage-episode.interface";

describe("search-result-links", () => {
  const searchResult: SearchResult = {
    id: "id",
    podcastName: "Podcast",
    episodeTitle: "Title",
    episodeDescription: "Description",
    release: new Date("2026-07-17T00:00:00Z"),
    duration: "00:01:02",
    spotifyId: "spotify123",
    youtubeId: "yt123456789",
    appleId: "987654321",
    podcastAppleId: "1234567890"
  };

  it("reconstructs platform URLs from compact ids", () => {
    expect(spotifyUrl(searchResult)?.toString()).toBe("https://open.spotify.com/episode/spotify123");
    expect(youtubeUrl(searchResult)?.toString()).toBe("https://www.youtube.com/watch?v=yt123456789");
    expect(appleUrl(searchResult)?.toString()).toBe("https://podcasts.apple.com/podcast/id1234567890?i=987654321");
  });

  it("expands a compacted image token to its exact thumbnail URL", () => {
    // "Marbury Vale Broadcasting" — the sddefault thumbnail was probed and compacted to "ys".
    const withToken: SearchResult = { ...searchResult, image: "ys" };
    expect(episodeImageUrl(withToken)?.toString())
      .toBe("https://i.ytimg.com/vi/yt123456789/sddefault.jpg");
  });

  it("detects YouTube thumbnail hosts and compact y-tokens vs square podcast art", () => {
    expect(isYoutubeThumbnailUrl("https://i.ytimg.com/vi/abc/hqdefault.jpg")).toBeTrue();
    expect(isYoutubeThumbnailUrl(new URL("https://i.ytimg.com/vi/abc/maxresdefault.jpg"))).toBeTrue();
    expect(isYoutubeThumbnailUrl("yh")).toBeTrue();
    expect(isYoutubeThumbnailUrl("https://i.scdn.co/image/opaque")).toBeFalse();
    expect(isYoutubeThumbnailUrl("https://is3-ssl.mzstatic.com/image/thumb/Music/x.jpg")).toBeFalse();
    expect(isYoutubeThumbnailUrl("sab6765")).toBeFalse();
    expect(isYoutubeThumbnailUrl(undefined)).toBeFalse();
  });

  it("picks wide aspect for YouTube art and square otherwise", () => {
    const yt: SearchResult = { ...searchResult, image: "yx" };
    const spotify: SearchResult = { ...searchResult, image: "sab6765cover", youtubeId: undefined };
    const homepageSquare: HomepageEpisode = {
      id: "id",
      podcastName: "Podcast",
      episodeTitle: "Title",
      episodeDescription: "Description",
      release: new Date("2026-07-17T00:00:00Z"),
      duration: "00:01:02",
      spotify: undefined,
      apple: undefined,
      youtube: undefined,
      bbc: undefined,
      internetArchive: undefined,
      subjects: [],
      image: new URL("https://i.scdn.co/image/opaque")
    };
    const homepageYt: HomepageEpisode = {
      ...homepageSquare,
      image: new URL("https://i.ytimg.com/vi/abc/hqdefault.jpg")
    };

    expect(episodeArtAspect(yt)).toBe("wide");
    expect(episodeArtAspect(spotify)).toBe("square");
    expect(episodeArtAspect(homepageSquare)).toBe("square");
    expect(episodeArtAspect(homepageYt)).toBe("wide");
  });

  it("keeps opaque homepage URLs unchanged", () => {
    const homepage: HomepageEpisode = {
      id: "id",
      podcastName: "Podcast",
      episodeTitle: "Title",
      episodeDescription: "Description",
      release: new Date("2026-07-17T00:00:00Z"),
      duration: "00:01:02",
      spotify: new URL("https://open.spotify.com/episode/homepage"),
      apple: undefined,
      youtube: undefined,
      bbc: undefined,
      internetArchive: undefined,
      subjects: [],
      image: new URL("https://i.scdn.co/image/opaque")
    };

    expect(spotifyUrl(homepage)?.toString()).toBe("https://open.spotify.com/episode/homepage");
    expect(episodeImageUrl(homepage)?.toString()).toBe("https://i.scdn.co/image/opaque");
  });

  it("returns undefined when required ids are missing", () => {
    const incomplete: SearchResult = {
      ...searchResult,
      spotifyId: undefined,
      appleId: undefined,
      youtubeId: undefined
    };

    expect(spotifyUrl(incomplete)).toBeUndefined();
    expect(appleUrl(incomplete)).toBeUndefined();
    expect(youtubeUrl(incomplete)).toBeUndefined();
    expect(episodeImageUrl(incomplete)).toBeUndefined();
  });

  describe("expandImage (loss-less compaction inverse)", () => {
    it("expands every YouTube quality code back to its exact filename", () => {
      const cases: Record<string, string> = {
        yx: "maxresdefault",
        ys: "sddefault",
        yh: "hqdefault",
        ym: "mqdefault",
        yd: "default"
      };
      for (const [token, quality] of Object.entries(cases)) {
        expect(expandImage(token, "griffinsong42")?.toString())
          .toBe(`https://i.ytimg.com/vi/griffinsong42/${quality}.jpg`);
      }
    });

    it("expands Spotify and Apple tokens verbatim", () => {
      expect(expandImage("sab6765ferngully00cover", undefined)?.toString())
        .toBe("https://i.scdn.co/image/ab6765ferngully00cover");
      expect(expandImage("a3Music/draymoor/600x600bb.jpg", undefined)?.toString())
        .toBe("https://is3-ssl.mzstatic.com/image/thumb/Music/draymoor/600x600bb.jpg");
    });

    it("returns full URLs unchanged and ignores unusable input", () => {
      expect(expandImage("https://feeds.saltandcinder.example/art.jpg", undefined)?.toString())
        .toBe("https://feeds.saltandcinder.example/art.jpg");
      expect(expandImage("yx", undefined)).toBeUndefined(); // youtube token needs youtubeId
      expect(expandImage(undefined, "griffinsong42")).toBeUndefined();
    });
  });
});
