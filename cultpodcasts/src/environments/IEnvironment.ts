import { IAuth0 } from "./IAuth0";

export interface IEnvironment {
    auth0: IAuth0;
    api: string;
    assetHost: string;
    shortner: string;
    name: string;
    vapidPublicKey: string;
    /**
     * Curator menu on the /news and /tv hubs. Each item is a build-time switch, on in every environment
     * now that its backend is live (turn one off to hide that item). Each depends on:
     * - submit: RPP #1054 (https://github.com/cultpodcasts/RedditPodcastPoster/pull/1054) must accept
     *   `POST /submit {url, parentKind, parentId, parentName}`, and the Api Worker's `hasSeriesAttachTarget`
     *   (src/submit.ts) must count the parent fields. Before that Azure ignores the target and would file
     *   the URL as a new podcast. Both are merged and deployed (Api #176), so this is on.
     * - edit: RPP #1053 + Api #174 (publisher fields and service ids).
     * - rename: the admin rename routes from the same PRs.
     */
    catalogueParentCuration: CatalogueParentCurationFlags;
}

export interface CatalogueParentCurationFlags {
    submit: boolean;
    edit: boolean;
    rename: boolean;
    /** Curator "Index {label}": run the indexer for this outlet / show now (Api `POST /{kind}/index/:identifier`). */
    index: boolean;
}