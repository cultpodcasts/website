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
     * that environment: submit needs RPP SubmitUrl to accept a parent target (otherwise Azure ignores
     * the target and would file the URL as a new podcast), edit needs RPP #1053 + Api #174, rename
     * needs the admin rename routes from the same PRs.
     */
    catalogueParentCuration: CatalogueParentCurationFlags;
}

export interface CatalogueParentCurationFlags {
    submit: boolean;
    edit: boolean;
    rename: boolean;
}