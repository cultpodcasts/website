import { isPodcastGuid, podcastGetPath } from "./podcast-get-path";

describe("podcastGetPath", () => {
  const podcastId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const episodeId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  it("looks up by podcast guid alone so a trailing episode id cannot be treated as a name route", () => {
    expect(isPodcastGuid(podcastId)).toBe(true);
    expect(podcastGetPath(podcastId, episodeId)).toBe(`/podcast/${podcastId}`);
  });

  it("percent-encodes '+' in a podcast name so the path is not form-decoded as a space", () => {
    expect(podcastGetPath("News+Weather", episodeId)).toBe(
      `/podcast/${encodeURIComponent("News+Weather")}/${episodeId}`
    );
    expect(podcastGetPath("News+Weather", episodeId)).toContain("News%2BWeather");
  });

  it("looks up by encoded name alone when there is no episode id", () => {
    expect(podcastGetPath("News+Weather")).toBe(`/podcast/${encodeURIComponent("News+Weather")}`);
  });
});
