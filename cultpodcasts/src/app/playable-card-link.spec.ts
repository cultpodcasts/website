import { parentCommands, playableCommands } from "./playable-card-link";

describe("playable card links", () => {
  const episode = {
    id: "id-1",
    episodeTitle: "Title",
    podcastName: "Show",
    episodeDescription: "",
    release: new Date(),
    duration: "1:00",
    subjects: [],
    image: undefined
  };

  it("links a film to /film/ and shows no parent", () => {
    const film = { ...episode, contentKind: "Film", podcastName: "" };
    expect(playableCommands(film)).toEqual(["/film", "Title", "id-1"]);
    expect(parentCommands(film)).toBeNull();
  });

  it("links a TV episode under its show", () => {
    const tv = { ...episode, contentKind: "TvShowEpisode" };
    expect(playableCommands(tv)).toEqual(["/tv", "Show", "id-1"]);
    expect(parentCommands(tv)).toEqual(["/tv", "Show"]);
  });

  it("keeps a podcast episode on /podcast/", () => {
    expect(playableCommands(episode)).toEqual(["/podcast", "Show", "id-1"]);
    expect(parentCommands(episode)).toEqual(["/podcast", "Show"]);
  });
});
