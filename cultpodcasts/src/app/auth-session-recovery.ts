import { isAuthClientOnlyPath } from './auth-client-only-path';

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

/**
 * Prefer returning the user to the page they were on after Auth0 callback.
 * Only same-origin relative paths (leading `/`, not `//…`) — never absolute or
 * protocol-relative URLs (open-redirect safe for `appState.target`).
 */
export function currentAppPath(): string {
  if (typeof window === 'undefined') {
    return '/';
  }
  const path = `${window.location.pathname}${window.location.search}${window.location.hash}` || '/';
  return isSafeAppReturnPath(path) ? path : '/';
}

/** True for in-app return targets safe to pass as Auth0 `appState.target`. */
export function isSafeAppReturnPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//');
}

/**
 * Auth0 Allowed Logout URLs are origin-only (no path wildcards). Stash the
 * public path before federated logout; restore after Auth0 returns to `/`.
 */
export const POST_LOGOUT_RETURN_PATH_KEY = 'postLogoutReturnPath';

/**
 * Set when an interactive sign-in has been started for an expired session.
 * Survives the Auth0 redirect in this tab so a failed bounce does not loop,
 * and is cleared once a session is actually signed in.
 */
export const SESSION_RECOVERY_ATTEMPT_KEY = 'authSessionRecoveryAttempted';

export function sessionRecoveryAlreadyAttempted(): boolean {
  return typeof sessionStorage !== 'undefined' &&
    sessionStorage.getItem(SESSION_RECOVERY_ATTEMPT_KEY) === '1';
}

export function markSessionRecoveryAttempted(): void {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(SESSION_RECOVERY_ATTEMPT_KEY, '1');
  }
}

export function clearSessionRecoveryAttempt(): void {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(SESSION_RECOVERY_ATTEMPT_KEY);
  }
}

/** API rejection that means the caller is not signed in, rather than lacking a role. */
export function isCredentialFailure(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('status' in error)) {
    return false;
  }
  const status = Number((error as { status: unknown }).status);
  if (status === 401) {
    return true;
  }
  const body = 'error' in error ? (error as { error: unknown }).error : undefined;
  const text = credentialFailureText(body);
  return text === 'unauthorised' || text === 'unauthorized';
}

function credentialFailureText(body: unknown): string {
  if (typeof body === 'string') {
    return body.trim().toLowerCase();
  }
  if (!body || typeof body !== 'object') {
    return '';
  }
  const record = body as { error?: unknown; message?: unknown };
  const value = record.error ?? record.message;
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/** Call immediately before Auth0 logout when the user should return to this page. */
export function stashPostLogoutReturnPath(): void {
  if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') {
    return;
  }
  const pathname = window.location.pathname || '/';
  if (isAuthClientOnlyPath(pathname)) {
    sessionStorage.removeItem(POST_LOGOUT_RETURN_PATH_KEY);
    return;
  }
  const path = currentAppPath();
  if (path === '/' || path === '') {
    sessionStorage.removeItem(POST_LOGOUT_RETURN_PATH_KEY);
    return;
  }
  if (isSafeAppReturnPath(path)) {
    sessionStorage.setItem(POST_LOGOUT_RETURN_PATH_KEY, path);
  }
}

/**
 * Read-and-clear the path stashed by {@link stashPostLogoutReturnPath}.
 * Returns null for missing/unsafe/auth-gated targets.
 */
export function consumePostLogoutReturnPath(): string | null {
  if (typeof sessionStorage === 'undefined') {
    return null;
  }
  const path = sessionStorage.getItem(POST_LOGOUT_RETURN_PATH_KEY);
  sessionStorage.removeItem(POST_LOGOUT_RETURN_PATH_KEY);
  if (!path || !isSafeAppReturnPath(path)) {
    return null;
  }
  const pathname = path.split('?')[0].split('#')[0] || '/';
  if (isAuthClientOnlyPath(pathname)) {
    return null;
  }
  return path;
}
