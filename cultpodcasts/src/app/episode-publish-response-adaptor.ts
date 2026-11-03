import { playablePublishSubjectNoun } from "./content-kind-label";
import { EpisodePublishResponse } from "./episode-publish-response.interface";
import { PostEpisodeModel } from "./post-episode-model.interface";

export class EpisodePublishResponseAdaptor {
    createMessage(
        response: EpisodePublishResponse,
        expectation: PostEpisodeModel,
        contentKind?: string | null,
    ): string {
        let successes: string[] = [];
        let failures: string[] = [];
        let message: string;
        const subject = playablePublishSubjectNoun(contentKind);
        if (expectation.post) {
            if (response.posted) {
                successes.push("posted");
            } else {
                failures.push("post");
            }
        }
        if (expectation.tweet) {
            if (response.tweeted) {
                successes.push("tweeted");
            } else {
                failures.push("tweet");
            }
        }
        if (expectation.blueskyPost) {
            if (response.blueskyPosted) {
                successes.push("bluesky-posted");
            } else {
                failures.push("bluesky-post");
            }
        }
        if (failures.length == 0) {
            message = `${subject} ${successes.join(" and ")}`;
        } else {
            if (successes.length == 0) {
                message = `${subject} failed to ${failures.join(" and ")}`
            } else {
                message = `${subject} ${successes.join(" and ")}`;
                if (failures.length > 0) {
                    message += `. Failed to ${failures.join(" and ")}`;
                }
            }
        }
        return message;
    }
}
