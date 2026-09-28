import { parentCommands, playableCommands } from "./playable-card-link";

describe("podcast card links", () => {
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

  it("keeps a podcast episode on /podcast/", () => {
    expect(playableCommands(episode)).toEqual(["/podcast", "Show", "id-1"]);
    expect(parentCommands(episode)).toEqual(["/podcast", "Show"]);
  });

  it("omits the parent when the show name is empty", () => {
    expect(parentCommands({ ...episode, podcastName: "" })).toBeNull();
  });
});
