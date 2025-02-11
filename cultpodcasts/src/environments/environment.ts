import { IEnvironment } from "./IEnvironment";

export const environment: IEnvironment = {
   auth0: {
      domain: 'dev-q3x2z6aofdzbjkkf.us.auth0.com',
      clientId: 'sJKkpr6HaOJhKpcTwjVVHzqvwSxa122P',
   },
   api: 'https://127.0.0.1:8787',
   assetHost: 'https://local.cultpodcasts.com:4200/',
   bundleAssetHost: 'https://local.cultpodcasts.com:4200',
   shortner: 'https://s.cultpodcasts.com',
   name: "dev",
   vapidPublicKey: "BKx7EI56y8biaGTAo_bagpNPTR9f4AkHqtuUoHaRM7nNduX5ExbAHO74-YAKa6_c9wLVYWHZklhrpPl6Bbx_3Is",
   ssrIgnoresSsl: true
};
