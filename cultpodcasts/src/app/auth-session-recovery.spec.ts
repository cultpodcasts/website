import { currentAppPath, isSafeAppReturnPath, isSessionRecoveryError, POST_LOGOUT_RETURN_PATH_KEY, stashPostLogoutReturnPath, consumePostLogoutReturnPath } from './auth-session-recovery';

describe('isSessionRecoveryError', () => {
  it('matches Auth0 missing_refresh_token errors', () => {
    expect(
      isSessionRecoveryError({
        error: 'missing_refresh_token',
        message: "Missing Refresh Token (audience: 'https://api.cultpodcasts.com/', scope: 'openid')"
      })
    ).toBe(true);
  });

  it('matches invalid_grant refresh failures', () => {
    expect(isSessionRecoveryError({ error: 'invalid_grant', message: 'Unknown or invalid refresh token.' })).toBe(true);
  });

  it('matches Missing Refresh Token message without an error code', () => {
    expect(
      isSessionRecoveryError(
        new Error("Missing Refresh Token (audience: 'https://api.cultpodcasts.com/', scope: 'openid')")
      )
    ).toBe(true);
  });

  it('ignores login_required and other auth noise', () => {
    expect(isSessionRecoveryError({ error: 'login_required', message: 'Login required' })).toBe(false);
    expect(isSessionRecoveryError(new Error('network_error'))).toBe(false);
    expect(isSessionRecoveryError(null)).toBe(false);
  });
});

describe('isSafeAppReturnPath', () => {
  it('allows same-origin relative paths with query and hash', () => {
    expect(isSafeAppReturnPath('/content/privacy-policy')).toBe(true);
    expect(isSafeAppReturnPath('/podcast/foo?x=1#bar')).toBe(true);
  });

  it('rejects absolute and protocol-relative URLs', () => {
    expect(isSafeAppReturnPath('https://evil.example/phish')).toBe(false);
    expect(isSafeAppReturnPath('//evil.example/phish')).toBe(false);
    expect(isSafeAppReturnPath('evil.example')).toBe(false);
  });
});

describe('currentAppPath', () => {
  it('returns path, query, and hash from window.location', () => {
    expect(currentAppPath()).toMatch(/^\//);
    expect(currentAppPath().startsWith('//')).toBe(false);
  });
});

describe('post-logout return path stash', () => {
  afterEach(() => {
    sessionStorage.removeItem(POST_LOGOUT_RETURN_PATH_KEY);
  });

  it('stashes the current public path for restore after Auth0 logout', () => {
    stashPostLogoutReturnPath();
    const stashed = sessionStorage.getItem(POST_LOGOUT_RETURN_PATH_KEY);
    // jsdom location is typically `/` in unit tests — home clears the stash.
    if (window.location.pathname === '/' || window.location.pathname === '') {
      expect(stashed).toBeNull();
      expect(consumePostLogoutReturnPath()).toBeNull();
    } else {
      expect(stashed).toMatch(/^\//);
      expect(consumePostLogoutReturnPath()).toBe(stashed);
      expect(sessionStorage.getItem(POST_LOGOUT_RETURN_PATH_KEY)).toBeNull();
    }
  });

  it('consumePostLogoutReturnPath rejects unsafe and auth-gated targets', () => {
    sessionStorage.setItem(POST_LOGOUT_RETURN_PATH_KEY, '//evil.example');
    expect(consumePostLogoutReturnPath()).toBeNull();

    sessionStorage.setItem(POST_LOGOUT_RETURN_PATH_KEY, '/discovery');
    expect(consumePostLogoutReturnPath()).toBeNull();

    sessionStorage.setItem(POST_LOGOUT_RETURN_PATH_KEY, '/podcast/safe');
    expect(consumePostLogoutReturnPath()).toBe('/podcast/safe');
  });
});
