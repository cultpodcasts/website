import { ALL_LANGUAGES_VALUE, ENGLISH_LANGUAGE_VALUE } from './subject-language-filter';
import { nextLanguageChipValues } from './language-chip-click';

describe('nextLanguageChipValues', () => {
  it('replaces the untouched English default with just the clicked language', () => {
    expect(nextLanguageChipValues([ENGLISH_LANGUAGE_VALUE], 'sw', false)).toEqual(['sw']);
  });

  it('keeps English only when English is the first click', () => {
    expect(nextLanguageChipValues([ENGLISH_LANGUAGE_VALUE], ENGLISH_LANGUAGE_VALUE, false))
      .toEqual([ENGLISH_LANGUAGE_VALUE]);
  });

  it('adds and removes languages once touched', () => {
    expect(nextLanguageChipValues(['sw'], 'ki', true)).toEqual(['sw', 'ki']);
    expect(nextLanguageChipValues(['sw', 'ki'], 'sw', true)).toEqual(['ki']);
    expect(nextLanguageChipValues([ENGLISH_LANGUAGE_VALUE], 'sw', true)).toEqual([ENGLISH_LANGUAGE_VALUE, 'sw']);
  });

  it('falls back to All when the last language is removed', () => {
    expect(nextLanguageChipValues(['ki'], 'ki', true)).toEqual([ALL_LANGUAGES_VALUE]);
  });

  it('starts from just the clicked language when All is selected', () => {
    expect(nextLanguageChipValues([ALL_LANGUAGES_VALUE], 'sw', true)).toEqual(['sw']);
    expect(nextLanguageChipValues([ALL_LANGUAGES_VALUE], 'sw', false)).toEqual(['sw']);
  });

  it('always gives All on its own for the All chip', () => {
    expect(nextLanguageChipValues(['sw', 'ki'], ALL_LANGUAGES_VALUE, true)).toEqual([ALL_LANGUAGES_VALUE]);
  });
});
