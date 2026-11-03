import { utcCalendarDateText } from './utc-calendar-date';

describe('utcCalendarDateText', () => {
  it('formats a Date (JsonDateInterceptor) as its UTC yyyy-MM-dd', () => {
    expect(utcCalendarDateText(new Date('2026-10-27T13:00:00Z'))).toBe('2026-10-27');
  });

  it('strips ISO DateTimeUtc / offset strings to the UTC calendar date', () => {
    expect(utcCalendarDateText('2026-10-27T13:00:00Z')).toBe('2026-10-27');
    expect(utcCalendarDateText('2026-10-30T23:30:00-02:00')).toBe('2026-10-31');
  });

  it('reads zoneless DateTime as UTC (append Z)', () => {
    expect(utcCalendarDateText('2026-10-30T23:45:12')).toBe('2026-10-30');
  });

  it('keeps year-only and date-only editor shapes', () => {
    expect(utcCalendarDateText('1999')).toBe('1999');
    expect(utcCalendarDateText('2026-10-27')).toBe('2026-10-27');
  });

  it('returns empty for null, blank, or invalid', () => {
    expect(utcCalendarDateText(null)).toBe('');
    expect(utcCalendarDateText(undefined)).toBe('');
    expect(utcCalendarDateText('')).toBe('');
    expect(utcCalendarDateText(new Date('not-a-date'))).toBe('');
    expect(utcCalendarDateText('not a date')).toBe('');
  });
});
