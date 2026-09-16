import { isPodcastGuid, podcastGetPath } from "./podcast-get-path";

describe("podcastGetPath", () => {
  const podcastId = "ffed5bfd-335d-402a-a406-e4d627b674f5";
  const episodeId = "e1ff6d85-b545-4fac-962c-61728ae13fa9";

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
