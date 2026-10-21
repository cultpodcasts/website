import { IAuth0 } from "./IAuth0";

export interface IEnvironment {
    auth0: IAuth0;
    api: string;
    assetHost: string;
    shortner: string;
    name: string;
    vapidPublicKey: string;
    /**
     * Curator menu on the /news and /tv hubs. Each item stays hidden until its backend is live in
     * that environment:
     * - submit: RPP #1054 (https://github.com/cultpodcasts/RedditPodcastPoster/pull/1054) must accept
     *   `POST /submit {url, parentKind, parentId, parentName}`, and the Api Worker's `hasSeriesAttachTarget`
     *   (src/submit.ts) must count the parent fields. Before that Azure ignores the target and would file
     *   the URL as a new podcast. Keep this off until #1054 is deployed.
     * - edit: RPP #1053 + Api #174 (publisher fields and service ids).
     * - rename: the admin rename routes from the same PRs.
     */
    catalogueParentCuration: CatalogueParentCurationFlags;
}

export interface CatalogueParentCurationFlags {
    submit: boolean;
    edit: boolean;
    rename: boolean;
}