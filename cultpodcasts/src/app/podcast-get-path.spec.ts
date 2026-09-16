import { environment } from "./../environments/environment";
import { EditPodcastDialogData } from "./edit-podcast-dialog-data.interface";
import { isPodcastGuid, podcastGetPath, podcastGetPathFromEditData } from "./podcast-get-path";

describe("podcastGetPath", () => {
  const podcastId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const episodeId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const origin = environment.api;

  it("looks up by podcast guid alone so a trailing episode id cannot be treated as a name route", () => {
    expect(isPodcastGuid(podcastId)).toBe(true);
    expect(podcastGetPath(podcastId, episodeId)).toBe(`/podcast/${podcastId}`);
  });

  it("percent-encodes '+' in a podcast name so the path is not form-decoded as a space", () => {
    expect(podcastGetPath("News+Weather", episodeId)).toBe(
      `/podcast/${encodeURIComponent("News+Weather")}/${episodeId}`
    );
  });

  it("looks up by encoded name alone when there is no episode id", () => {
    expect(podcastGetPath("News+Weather")).toBe(`/podcast/${encodeURIComponent("News+Weather")}`);
  });

  it("keeps News+Weather and the episode id in the path when composed with the API origin", () => {
    const url = new URL(podcastGetPath("News+Weather", episodeId), origin);
    expect(url.pathname).toContain("News%2BWeather");
    expect(url.pathname.split("/").filter(Boolean)).toEqual(["podcast", "News%2BWeather", episodeId]);
    expect(url.search).toBe("");
  });

  it("keeps a trailing question mark in the pathname instead of starting a query", () => {
    const encoded = new URL(podcastGetPath("Was I In A Cult?"), origin);
    expect(encoded.pathname.endsWith("Cult%3F")).toBe(true);
    expect(encoded.search).toBe("");

    const unencoded = new URL("/podcast/Was I In A Cult?", origin);
    expect(unencoded.pathname.endsWith("Cult%3F")).toBe(false);
    expect(unencoded.pathname.includes("?")).toBe(false);
    expect(unencoded.pathname.endsWith("Cult")).toBe(true);
  });

  it("composes a guid lookup as a single podcast segment even when an episode id is supplied", () => {
    const url = new URL(podcastGetPath(podcastId, episodeId), origin);
    expect(url.pathname).toBe(`/podcast/${podcastId}`);
    expect(url.pathname).not.toContain(episodeId);
    expect(url.href).toBe(new URL(`/podcast/${podcastId}`, origin).href);
    expect(url.search).toBe("");
  });

  it("uses named dialog fields so a podcast id is not taken as an episode id", () => {
    const review: EditPodcastDialogData = {
      podcastName: "News+Weather",
      episodeId,
      podcastId
    };
    const outgoing: EditPodcastDialogData = {
      podcastName: "News+Weather",
      podcastId
    };
    expect(new URL(podcastGetPathFromEditData(review), origin).pathname)
      .toBe(`/podcast/${podcastId}`);
    expect(new URL(podcastGetPathFromEditData(outgoing), origin).pathname)
      .toBe(`/podcast/${podcastId}`);
  });
});
