import { authRedirectUri } from './auth-redirect-uri';

describe('authRedirectUri', () => {
  it('returns the current browser origin', () => {
    expect(authRedirectUri('https://fallback.example/')).toBe(window.location.origin);
  });
});
