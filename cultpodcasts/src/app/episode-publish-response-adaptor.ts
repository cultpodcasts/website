import { EpisodePublishResponse } from "./episode-publish-response";
import { PostEpisodeModel } from "./post-episode-model";

export class EpisodePublishResponseAdaptor {
    createMessage(response: EpisodePublishResponse, expectation: PostEpisodeModel): string {
        let successes: string[] = [];
        let failures: string[] = [];
        let message: string;
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
                failures.push("b;uesky-post");
            }
        }
        if (failures.length == 0) {
            message = `Episode ${successes.join(" and ")}`;
        } else {
            if (successes.length == 0) {
                message = `Episode failed to ${failures.join(" and ")}`
            } else {
                message = `Episode ${successes.join(" and ")}`;
                if (failures.length > 0) {
                    message += `. Failed to ${failures.join(" and ")}`;
                }
            }
        }
        return message;
    }
}
