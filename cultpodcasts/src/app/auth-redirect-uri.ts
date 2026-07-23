/**
 * Auth0 redirect / logout return URL for the current browser origin.
 * Preview deploys use ever-changing *.pages.dev hosts — never bake those into
 * environment.staging.ts. SSR falls back to environment.assetHost.
 */
export function authRedirectUri(fallback: string): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return fallback.replace(/\/$/, '');
}
