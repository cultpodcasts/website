import { currentAppPath, isSessionRecoveryError } from './auth-session-recovery';

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

describe('currentAppPath', () => {
  it('returns path, query, and hash from window.location', () => {
    expect(currentAppPath()).toMatch(/^\//);
  });
});
