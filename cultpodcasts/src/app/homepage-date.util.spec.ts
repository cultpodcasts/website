import { dateFromKey, dateKey, hasBeenReleased } from './homepage-date.util';

describe('homepage-date.util', () => {
  it('keeps day and month distinct for a date where day <= 12 (regression: 11 July was rendered as 7 November)', () => {
    const eleventhOfJuly = new Date(2026, 6, 11); // month is 0-indexed: 6 = July
    const key = dateKey(eleventhOfJuly);

    expect(key).toBe('2026-07-11');

    const roundTripped = dateFromKey(key);
    expect(roundTripped.getFullYear()).toBe(2026);
    expect(roundTripped.getMonth()).toBe(6); // July
    expect(roundTripped.getDate()).toBe(11);
  });

  it('round-trips a date where day > 12 (would fail loudly if month/day order were ever swapped)', () => {
    const twentiethOfNovember = new Date(2026, 10, 20); // month is 0-indexed: 10 = November
    const key = dateKey(twentiethOfNovember);

    expect(key).toBe('2026-11-20');

    const roundTripped = dateFromKey(key);
    expect(roundTripped.getFullYear()).toBe(2026);
    expect(roundTripped.getMonth()).toBe(10); // November
    expect(roundTripped.getDate()).toBe(20);
  });

  it('pads single-digit month and day', () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('hasBeenReleased', () => {
  const release = new Date('2026-11-19T00:00:00Z');

  it('hides an item while now is before its release', () => {
    expect(hasBeenReleased(release, new Date('2026-11-18T23:59:59.999Z'))).toBe(false);
    expect(hasBeenReleased(release, new Date('2026-11-15T19:58:00Z'))).toBe(false);
  });

  it('shows an item once now is on or after its release date', () => {
    expect(hasBeenReleased(release, new Date('2026-11-19T00:00:00.000Z'))).toBe(true);
    expect(hasBeenReleased(release, new Date('2026-11-19T12:00:00Z'))).toBe(true);
  });
});
