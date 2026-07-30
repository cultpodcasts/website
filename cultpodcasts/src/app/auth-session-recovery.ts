/**
 * Auth0 SPA errors that mean the local session cannot be renewed silently
 * and need an interactive login (usually SSO bounce, not a full password entry).
 */
export function isSessionRecoveryError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const code = 'error' in error ? String((error as { error?: unknown }).error ?? '') : '';
  const message = 'message' in error ? String((error as { message?: unknown }).message ?? '') : '';
  return (
    code === 'missing_refresh_token' ||
    code === 'invalid_grant' ||
    message.startsWith('Missing Refresh Token')
  );
}

/** Prefer returning the user to the page they were on after Auth0 callback. */
export function currentAppPath(): string {
  if (typeof window === 'undefined') {
    return '/';
  }
  return `${window.location.pathname}${window.location.search}${window.location.hash}` || '/';
}
