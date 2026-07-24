import { IAuth0 } from "./IAuth0";

export interface IEnvironment {
    auth0: IAuth0;
    api: string;
    bundleAssetHost: string;
    assetHost: string;
    shortner: string;
    name: string;
    vapidPublicKey: string;
    ssrIgnoresSsl?: boolean;
    /** Homepage Flix promo. Overridden at build time by Cloudflare `FLIX_PROMO_ENABLED`. */
    flixPromoEnabled: boolean;
}