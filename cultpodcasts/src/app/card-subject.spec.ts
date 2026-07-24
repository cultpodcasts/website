import { pickCardSubject } from './card-subject';

describe('pickCardSubject', () => {
  it('prefers a named group over a topic tag', () => {
    expect(pickCardSubject(['Cult Psychology', 'Geelong Revival Centre'])).toBe(
      'Geelong Revival Centre'
    );
  });

  it('falls back to a topic tag rather than leaving a card with no subject', () => {
    expect(pickCardSubject(['Cult Recovery', 'Psychology'])).toBe('Cult Recovery');
  });

  it('skips hidden underscore-prefixed subjects', () => {
    expect(pickCardSubject(['_hoisted', 'Oneida Community'])).toBe('Oneida Community');
    expect(pickCardSubject(['_hoisted'])).toBeUndefined();
  });

  it('drops the surrounding view\'s own subject so the chip adds new information', () => {
    expect(pickCardSubject(['Scientology', 'Oneida Community'], 'Scientology')).toBe(
      'Oneida Community'
    );
    expect(pickCardSubject(['Scientology'], '  scientology ')).toBeUndefined();
  });

  it('handles missing and empty subject lists', () => {
    expect(pickCardSubject(undefined)).toBeUndefined();
    expect(pickCardSubject([])).toBeUndefined();
    expect(pickCardSubject(['', 'Twelve Tribes'])).toBe('Twelve Tribes');
  });
});
