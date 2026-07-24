import { IEnvironment } from "./IEnvironment";

export const environment: IEnvironment = {
   auth0: {
      clientId: "o1YtyIzzhBEQ7c7IEZzovb1TGov1AGSs",
      domain: "auth-staging.cultpodcasts.com"
   },
   api: 'https://api-preview.jonbreen.workers.dev',
   // Auth redirect uses window.location.origin at runtime (see auth-redirect-uri.ts).
   // Keep a stable fallback for SSR only — not a specific preview hostname.
   assetHost: 'https://website-83e.pages.dev',
   // Empty = same-origin relative /assets/... so icons work on any preview URL.
   bundleAssetHost: '',
   shortner: 'https://s.cultpodcasts.com',
   name: "stg",
   vapidPublicKey: "BKx7EI56y8biaGTAo_bagpNPTR9f4AkHqtuUoHaRM7nNduX5ExbAHO74-YAKa6_c9wLVYWHZklhrpPl6Bbx_3Is",
   flixPromoEnabled: true
};
