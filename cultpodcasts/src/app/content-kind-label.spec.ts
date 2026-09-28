import { contentKindLabel } from "./content-kind-label";

describe("content kind labels", () => {
  it("names the public kinds", () => {
    expect(contentKindLabel("Episode")).toBe("Podcast");
    expect(contentKindLabel("TvShowEpisode")).toBe("TV");
    expect(contentKindLabel("Film")).toBe("Film");
    expect(contentKindLabel("NewsReport")).toBe("News");
  });
});
