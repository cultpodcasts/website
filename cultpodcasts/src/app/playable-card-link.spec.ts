import { GuidService } from "./guid.service";
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

  it("links a GUID podcast episode by its short id, never the raw GUID", () => {
    const id = "00112233-4455-4677-8899-aabbccddeeff";
    const commands = playableCommands({ ...episode, id });
    expect(commands).toEqual(["/podcast", "Show", new GuidService().toBase64(id)]);
    expect(commands.join("/")).not.toContain(id);
  });

  it("omits the parent when the show name is empty", () => {
    expect(parentCommands({ ...episode, podcastName: "" })).toBeNull();
  });
});
