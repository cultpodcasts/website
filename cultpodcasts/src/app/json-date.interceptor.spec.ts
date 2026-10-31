import { JsonDateInterceptor } from './json-date.interceptor';

describe('JsonDateInterceptor', () => {
  const interceptor = new JsonDateInterceptor();

  it('turns a UTC Z date-time into that instant', () => {
    const body = { at: '2026-10-30T23:45:12.345Z' };
    interceptor.convert(body);
    expect(body.at).toBeInstanceOf(Date);
    expect((body.at as unknown as Date).toISOString()).toBe('2026-10-30T23:45:12.345Z');
  });

  it('turns a date-time with an offset into the same UTC instant', () => {
    const body = { at: '2026-07-15T21:00:00+01:00', other: '2026-01-15T16:00:00-05:00' };
    interceptor.convert(body);
    expect((body.at as unknown as Date).toISOString()).toBe('2026-07-15T20:00:00.000Z');
    expect((body.other as unknown as Date).toISOString()).toBe('2026-01-15T21:00:00.000Z');
  });

  it('reads a zone-less date-time as UTC, not browser-local time', () => {
    const body = { at: '2026-07-15T21:00:00', fractional: '2026-07-15T21:00:00.1234567' };
    interceptor.convert(body);
    expect((body.at as unknown as Date).toISOString()).toBe('2026-07-15T21:00:00.000Z');
    expect((body.fractional as unknown as Date).toISOString()).toBe('2026-07-15T21:00:00.123Z');
  });

  it('leaves date-only text, years, times and other strings as text', () => {
    const body = { day: '2026-07-15', year: '2026', yearNumber: 2026, time: '21:30', label: '2026-10-08 22:30 UK', bad: '2026-07-15T21:00:00+0100' };
    interceptor.convert(body);
    expect(body).toEqual({ day: '2026-07-15', year: '2026', yearNumber: 2026, time: '21:30', label: '2026-10-08 22:30 UK', bad: '2026-07-15T21:00:00+0100' });
  });

  it('keeps the discovery schedule slotStartUk as local text with its offset while slotStartUtc becomes a Date', () => {
    const body = {
      nextRuns: [
        { slotId: '2026-10-08 22:30 UK', slotStartUtc: '2026-10-08T21:30:00Z', slotStartUk: '2026-10-08T22:30:00+01:00' },
        { slotId: '2026-12-08 22:30 UK', slotStartUtc: '2026-12-08T22:30:00Z', slotStartUk: '2026-12-08T22:30:00+00:00' },
      ],
    };
    interceptor.convert(body);
    expect(body.nextRuns[0].slotStartUk).toBe('2026-10-08T22:30:00+01:00');
    expect(body.nextRuns[1].slotStartUk).toBe('2026-12-08T22:30:00+00:00');
    expect((body.nextRuns[0].slotStartUtc as unknown as Date).toISOString()).toBe('2026-10-08T21:30:00.000Z');
    expect(body.nextRuns[0].slotId).toBe('2026-10-08 22:30 UK');
  });

  it('converts nested arrays and objects', () => {
    const body = { parent: { history: [{ id: 'x', replacedAt: '2026-01-02T03:04:05Z' }] } };
    interceptor.convert(body);
    expect(body.parent.history[0].replacedAt).toBeInstanceOf(Date);
  });
});
