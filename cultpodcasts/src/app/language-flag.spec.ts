import {
  languageFlagBadge,
  languageFlagBadgeForEpisode,
  isEnglishLanguageCode,
  episodeLanguageCode
} from './language-flag';

describe('language-flag', () => {
  it('maps Spanish to Spain and Portuguese to Portugal', () => {
    expect(languageFlagBadge('es')?.flag).toBe('🇪🇸');
    expect(languageFlagBadge('pt')?.flag).toBe('🇵🇹');
    expect(languageFlagBadge('pt-BR')?.flag).toBe('🇧🇷');
  });

  it('omits English and empty codes', () => {
    expect(languageFlagBadge('en')).toBeUndefined();
    expect(languageFlagBadge('en-GB')).toBeUndefined();
    expect(languageFlagBadge('')).toBeUndefined();
    expect(languageFlagBadge(undefined)).toBeUndefined();
    expect(isEnglishLanguageCode(null)).toBeTrue();
  });

  it('falls back to base language for unknown regions', () => {
    expect(languageFlagBadge('de-AT')?.flag).toBe('🇩🇪');
    expect(languageFlagBadge('fr')?.label).toContain('French');
  });

  it('reads homepage language or search lang from an episode', () => {
    expect(episodeLanguageCode({ language: 'es' })).toBe('es');
    expect(episodeLanguageCode({ lang: 'pt' })).toBe('pt');
    expect(languageFlagBadgeForEpisode({ language: 'es' })?.flag).toBe('🇪🇸');
    expect(languageFlagBadgeForEpisode({ lang: 'ro' })?.flag).toBe('🇷🇴');
  });
});
