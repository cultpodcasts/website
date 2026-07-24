import { dateFromKey, dateKey } from './homepage-date.util';

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
