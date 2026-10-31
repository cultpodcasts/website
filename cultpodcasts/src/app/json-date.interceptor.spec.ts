import { HttpContext, HttpRequest, HttpResponse } from '@angular/common/http';
import { firstValueFrom, of } from 'rxjs';
import { JsonDateInterceptor, KEEP_AS_TEXT_KEYS, convertJsonDates } from './json-date.interceptor';

describe('JsonDateInterceptor', () => {
  const interceptor = new JsonDateInterceptor();

  it('turns a UTC Z date-time into that instant', () => {
    const body = { at: '2026-10-30T23:45:12.345Z' };
    convertJsonDates(body);
    expect(body.at).toBeInstanceOf(Date);
    expect((body.at as unknown as Date).toISOString()).toBe('2026-10-30T23:45:12.345Z');
  });

  it('turns a date-time with an offset into the same UTC instant', () => {
    const body = { at: '2026-07-15T21:00:00+01:00', other: '2026-01-15T16:00:00-05:00' };
    convertJsonDates(body);
    expect((body.at as unknown as Date).toISOString()).toBe('2026-07-15T20:00:00.000Z');
    expect((body.other as unknown as Date).toISOString()).toBe('2026-01-15T21:00:00.000Z');
  });

  it('reads a zone-less date-time as UTC, not browser-local time', () => {
    const body = { at: '2026-07-15T21:00:00', fractional: '2026-07-15T21:00:00.1234567' };
    convertJsonDates(body);
    expect((body.at as unknown as Date).toISOString()).toBe('2026-07-15T21:00:00.000Z');
    expect((body.fractional as unknown as Date).toISOString()).toBe('2026-07-15T21:00:00.123Z');
  });

  it('leaves date-only text, years, times and other strings as text', () => {
    const body = { day: '2026-07-15', year: '2026', yearNumber: 2026, time: '21:30', label: '2026-10-08 22:30 UK', bad: '2026-07-15T21:00:00+0100' };
    convertJsonDates(body);
    expect(body).toEqual({ day: '2026-07-15', year: '2026', yearNumber: 2026, time: '21:30', label: '2026-10-08 22:30 UK', bad: '2026-07-15T21:00:00+0100' });
  });

  const schedule = () => ({
    nextRuns: [
      { slotId: '2026-10-08 22:30 UK', slotStartUtc: '2026-10-08T21:30:00Z', slotStartUk: '2026-10-08T22:30:00+01:00' },
      { slotId: '2026-12-08 22:30 UK', slotStartUtc: '2026-12-08T22:30:00Z', slotStartUk: '2026-12-08T22:30:00+00:00' },
    ],
  });

  async function intercepted(body: object, context?: HttpContext) {
    const req = new HttpRequest('GET', 'https://api.example.test/x', { context });
    const event = await firstValueFrom(interceptor.intercept(req, { handle: () => of(new HttpResponse({ body })) }));
    return (event as HttpResponse<any>).body;
  }

  it('keeps slotStartUk as local text with its offset when the request opts out via KEEP_AS_TEXT_KEYS', async () => {
    const body = await intercepted(schedule(), new HttpContext().set(KEEP_AS_TEXT_KEYS, new Set(['slotStartUk'])));
    expect(body.nextRuns[0].slotStartUk).toBe('2026-10-08T22:30:00+01:00');
    expect(body.nextRuns[1].slotStartUk).toBe('2026-12-08T22:30:00+00:00');
    expect((body.nextRuns[0].slotStartUtc as Date).toISOString()).toBe('2026-10-08T21:30:00.000Z');
    expect(body.nextRuns[0].slotId).toBe('2026-10-08 22:30 UK');
  });

  it('converts every key, slotStartUk included, on a request without the opt-out', async () => {
    const body = await intercepted(schedule());
    expect(body.nextRuns[0].slotStartUk).toBeInstanceOf(Date);
    expect((body.nextRuns[0].slotStartUk as Date).toISOString()).toBe('2026-10-08T21:30:00.000Z');
  });

  it('leaves a value that matches the shape but is not a real date-time as text', () => {
    const body = { badOffset: '2026-07-15T21:00:00+25:00', badHour: '2026-07-15T25:00:00Z', badMonth: '2026-13-15T21:00:00' };
    convertJsonDates(body);
    expect(body).toEqual({ badOffset: '2026-07-15T21:00:00+25:00', badHour: '2026-07-15T25:00:00Z', badMonth: '2026-13-15T21:00:00' });
  });

  it('cuts or pads fractional seconds to 3 digits, so parsing does not depend on the JS engine', () => {
    const body = { seven: '2026-07-15T21:00:00.1234567Z', one: '2026-07-15T21:00:00.5Z', offset: '2026-07-15T22:00:00.9999+01:00' };
    convertJsonDates(body);
    expect((body.seven as unknown as Date).toISOString()).toBe('2026-07-15T21:00:00.123Z');
    expect((body.one as unknown as Date).toISOString()).toBe('2026-07-15T21:00:00.500Z');
    expect((body.offset as unknown as Date).toISOString()).toBe('2026-07-15T21:00:00.999Z');
  });

  it('converts nested arrays and objects', () => {
    const body = { parent: { history: [{ id: 'x', replacedAt: '2026-01-02T03:04:05Z' }] } };
    convertJsonDates(body);
    expect(body.parent.history[0].replacedAt).toBeInstanceOf(Date);
  });

  describe('convertJsonDates (JSON outside HttpClient, e.g. WebSocket frames)', () => {
    it('applies the same rules in place and returns the body', () => {
      const body = { state: { updatedAt: '2026-10-31T10:00:00Z', presence: { u1: '2026-10-31T10:00:01.5Z' }, day: '2026-10-31' } };
      const out = convertJsonDates(body);
      expect(out).toBe(body);
      const state = body.state as unknown as { updatedAt: Date; presence: Record<string, Date>; day: string };
      expect(state.updatedAt.toISOString()).toBe('2026-10-31T10:00:00.000Z');
      expect(state.presence['u1'].toISOString()).toBe('2026-10-31T10:00:01.500Z');
      expect(state.day).toBe('2026-10-31');
    });

    it('honours keep-as-text keys', () => {
      const body = { slotStartUk: '2026-10-31T09:00:00+00:00', slotStartUtc: '2026-10-31T09:00:00Z' };
      convertJsonDates(body, new Set(['slotStartUk']));
      expect(body.slotStartUk).toBe('2026-10-31T09:00:00+00:00');
      expect(body.slotStartUtc).toBeInstanceOf(Date);
    });

    it('leaves non-objects alone', () => {
      expect(convertJsonDates(null)).toBeNull();
      expect(convertJsonDates('2026-10-31T10:00:00Z')).toBe('2026-10-31T10:00:00Z');
    });
  });
});
