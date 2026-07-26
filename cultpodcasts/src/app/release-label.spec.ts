import { releaseDateLabel } from './release-label';

describe('releaseDateLabel', () => {
  it('formats a Date as day, short month, year', () => {
    expect(releaseDateLabel(new Date('2026-07-17T09:30:00Z'))).toBe('17 Jul 2026');
  });

  it('formats an ISO string the same as the equivalent Date', () => {
    const iso = '2019-11-03T12:00:00Z';
    expect(releaseDateLabel(iso)).toBe(releaseDateLabel(new Date(iso)));
  });

  it('keeps day-before-month ordering regardless of the runtime locale', () => {
    // en-US default would render "Jul 7, 2026" and read as 7 November when re-parsed.
    expect(releaseDateLabel(new Date(2026, 6, 7))).toBe('7 Jul 2026');
  });

  it('returns undefined for a missing or unparseable release', () => {
    expect(releaseDateLabel(undefined)).toBeUndefined();
    expect(releaseDateLabel('not-a-date')).toBeUndefined();
  });
});
