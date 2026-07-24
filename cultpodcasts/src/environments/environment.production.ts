import { IEnvironment } from "./IEnvironment";

export const environment: IEnvironment = {
   auth0: {
      clientId: "LbMkF8xiBGeuHGl7aBrzvkNuzWr3ryCt",
      domain: "auth.cultpodcasts.com"
   },
   api: 'https://api.cultpodcasts.com',
   assetHost: 'https://cultpodcasts.com',
   // Empty = same-origin /assets/... (flix + cultpodcasts.com); never bake localhost.
   bundleAssetHost: '',
   shortner: 'https://s.cultpodcasts.com',
   name: "prod",
   vapidPublicKey: "BKx7EI56y8biaGTAo_bagpNPTR9f4AkHqtuUoHaRM7nNduX5ExbAHO74-YAKa6_c9wLVYWHZklhrpPl6Bbx_3Is"
};
