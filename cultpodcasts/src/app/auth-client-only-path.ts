/**
 * Routes that require Auth0 (curator/user) and must not stay put after logout.
 * Kept in sync with server.ts CSR-shell skip list.
 */
export function isAuthClientOnlyPath(pathname: string): boolean {
  return pathname === '/discovery'
    || pathname === '/outgoingEpisodes'
    || pathname === '/split-offs'
    || pathname === '/bookmarks'
    || pathname === '/unauthorised'
    || pathname.startsWith('/episodes/');
}
