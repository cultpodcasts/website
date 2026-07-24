import { IEnvironment } from "./IEnvironment";

export const environment: IEnvironment = {
   auth0: {
      clientId: 'sJKkpr6HaOJhKpcTwjVVHzqvwSxa122P',
      domain: 'auth-local.cultpodcasts.com'
   },
   api: 'https://local.cultpodcasts.com:8787',
   assetHost: 'https://local.cultpodcasts.com:8788/',
   bundleAssetHost: 'https://local.cultpodcasts.com:8788',
   shortner: 'https://s.cultpodcasts.com',
   name: "dev",
   vapidPublicKey: "BKx7EI56y8biaGTAo_bagpNPTR9f4AkHqtuUoHaRM7nNduX5ExbAHO74-YAKa6_c9wLVYWHZklhrpPl6Bbx_3Is",
   ssrIgnoresSsl: true
};
