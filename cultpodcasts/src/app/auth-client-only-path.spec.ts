import { isAuthClientOnlyPath } from './auth-client-only-path';

describe('isAuthClientOnlyPath', () => {
  it('matches curator and signed-in-only routes', () => {
    expect(isAuthClientOnlyPath('/discovery')).toBe(true);
    expect(isAuthClientOnlyPath('/outgoingEpisodes')).toBe(true);
    expect(isAuthClientOnlyPath('/bookmarks')).toBe(true);
    expect(isAuthClientOnlyPath('/unauthorised')).toBe(true);
    expect(isAuthClientOnlyPath('/episodes/abc')).toBe(true);
  });

  it('allows public browse and content routes', () => {
    expect(isAuthClientOnlyPath('/')).toBe(false);
    expect(isAuthClientOnlyPath('/podcast/example')).toBe(false);
    expect(isAuthClientOnlyPath('/subject/example')).toBe(false);
    expect(isAuthClientOnlyPath('/search/foo')).toBe(false);
    expect(isAuthClientOnlyPath('/content/privacy-policy')).toBe(false);
    expect(isAuthClientOnlyPath('/episode/abc')).toBe(false);
  });
});
