import { appleUrl, episodeImageUrl, spotifyUrl, youtubeUrl } from "./search-result-links";
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
    podcastAppleId: "1234567890",
    youtubeImageVariant: "hq"
  };

  it("reconstructs platform URLs from compact ids", () => {
    expect(spotifyUrl(searchResult)?.toString()).toBe("https://open.spotify.com/episode/spotify123");
    expect(youtubeUrl(searchResult)?.toString()).toBe("https://www.youtube.com/watch?v=yt123456789");
    expect(appleUrl(searchResult)?.toString()).toBe("https://podcasts.apple.com/podcast/id1234567890?i=987654321");
  });

  it("derives YouTube thumbnail when image is omitted", () => {
    expect(episodeImageUrl(searchResult)?.toString())
      .toBe("https://i.ytimg.com/vi/yt123456789/hqdefault.jpg");
  });

  it("prefers the YouTube thumbnail over a stale image when a variant is present", () => {
    const withStaleImage: SearchResult = {
      ...searchResult,
      youtubeId: "abcDEF12345",
      youtubeImageVariant: "maxres",
      image: "https://i.scdn.co/image/staleCoverArt"
    };

    expect(episodeImageUrl(withStaleImage)?.toString())
      .toBe("https://i.ytimg.com/vi/abcDEF12345/maxresdefault.jpg");
  });

  it("reconstructs the Spotify cover from spotifyImageId when no YouTube variant is present", () => {
    const spotifyOnly: SearchResult = {
      ...searchResult,
      youtubeId: undefined,
      youtubeImageVariant: undefined,
      spotifyImageId: "ab6765630000ba8aharbourvale"
    };

    expect(episodeImageUrl(spotifyOnly)?.toString())
      .toBe("https://i.scdn.co/image/ab6765630000ba8aharbourvale");
  });

  it("prefers the YouTube thumbnail over a Spotify id when both are present", () => {
    const both: SearchResult = {
      ...searchResult,
      youtubeId: "ytPreferred",
      youtubeImageVariant: "sd",
      spotifyImageId: "shouldBeIgnored"
    };

    expect(episodeImageUrl(both)?.toString())
      .toBe("https://i.ytimg.com/vi/ytPreferred/sddefault.jpg");
  });

  it("falls back to image when neither a YouTube variant nor a Spotify id is present", () => {
    const audioOnly: SearchResult = {
      ...searchResult,
      youtubeId: undefined,
      youtubeImageVariant: undefined,
      spotifyImageId: undefined,
      image: "https://is1-ssl.mzstatic.com/image/thumb/apple/600x600bb.jpg"
    };

    expect(episodeImageUrl(audioOnly)?.toString())
      .toBe("https://is1-ssl.mzstatic.com/image/thumb/apple/600x600bb.jpg");
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
      youtubeId: undefined,
      youtubeImageVariant: undefined
    };

    expect(spotifyUrl(incomplete)).toBeUndefined();
    expect(appleUrl(incomplete)).toBeUndefined();
    expect(youtubeUrl(incomplete)).toBeUndefined();
    expect(episodeImageUrl(incomplete)).toBeUndefined();
  });
});
