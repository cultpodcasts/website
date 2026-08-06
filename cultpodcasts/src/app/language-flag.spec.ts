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

  it('maps Filipino and Tagalog to the Philippines', () => {
    expect(languageFlagBadge('fil')?.flag).toBe('🇵🇭');
    expect(languageFlagBadge('tl')?.flag).toBe('🇵🇭');
    expect(languageFlagBadge('fil')?.label).toContain('Filipino');
  });

  it('maps Baltic, Balkan, and South Asian codes that have a clear country', () => {
    expect(languageFlagBadge('lt')?.flag).toBe('🇱🇹');
    expect(languageFlagBadge('lv')?.flag).toBe('🇱🇻');
    expect(languageFlagBadge('et')?.flag).toBe('🇪🇪');
    expect(languageFlagBadge('bs')?.flag).toBe('🇧🇦');
    expect(languageFlagBadge('mk')?.flag).toBe('🇲🇰');
    expect(languageFlagBadge('si')?.flag).toBe('🇱🇰');
    expect(languageFlagBadge('te')?.flag).toBe('🇮🇳');
    expect(languageFlagBadge('mr')?.flag).toBe('🇮🇳');
  });

  it('shows uppercase ISO codes for Punjabi and Yiddish (no country flag)', () => {
    const punjabi = languageFlagBadge('pa');
    expect(punjabi?.flag).toBe('PA');
    expect(punjabi?.isCode).toBe(true);
    expect(punjabi?.label).toContain('Punjabi');

    const yiddish = languageFlagBadge('yi');
    expect(yiddish?.flag).toBe('YI');
    expect(yiddish?.isCode).toBe(true);
    expect(yiddish?.label).toContain('Yiddish');
  });

  it('omits English and empty codes', () => {
    expect(languageFlagBadge('en')).toBeUndefined();
    expect(languageFlagBadge('en-GB')).toBeUndefined();
    expect(languageFlagBadge('')).toBeUndefined();
    expect(languageFlagBadge(undefined)).toBeUndefined();
    expect(isEnglishLanguageCode(null)).toBe(true);
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
