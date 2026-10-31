import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Turns ISO-8601 date-time strings in API responses into `Date` objects.
 *
 * - The API emits every date-time as a UTC instant ending in `Z`; an explicit offset (`+01:00`) is also read as
 *   that instant.
 * - A zone-less date-time (`yyyy-MM-ddTHH:mm:ss[.fff]`) is read as UTC (a `Z` is appended), never as
 *   browser-local time.
 * - Date-only text (`yyyy-MM-dd`), years and other strings are left as text.
 * - Keys in {@link LOCAL_TIME_KEYS} stay as text. EXCEPTION to UTC-only: the discovery schedule's `slotStartUk`
 *   is UK local wall-clock time with its UK offset (curators set run times in local time, which moves against UTC
 *   with daylight saving). A `Date` would drop that offset, so it is kept as the API sent it.
 */
export const LOCAL_TIME_KEYS: ReadonlySet<string> = new Set(['slotStartUk']);

@Injectable()
export class JsonDateInterceptor implements HttpInterceptor {

  private _isoDateFormat = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?<zone>Z|[+-]\d{2}:\d{2})?$/;

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    return next.handle(req).pipe(map((val: HttpEvent<any>) => {
      if (val instanceof HttpResponse) {
        const body = val.body;
        this.convert(body);
      }
      return val;
    }));
  }

  isIsoDateString(value: any): boolean {
    if (value === null || value === undefined) {
      return false;
    }
    if (typeof value === 'string') {
      return this._isoDateFormat.test(value);
    }
    return false;
  }

  /** `Date` for an ISO date-time string; zone-less text is read as UTC. */
  toDate(value: string): Date {
    const zone = this._isoDateFormat.exec(value)?.groups?.['zone'];
    return new Date(zone ? value : `${value}Z`);
  }

  convert(body: any) {
    if (body === null || body === undefined) {
      return body;
    }
    if (typeof body !== 'object') {
      return body;
    }
    for (const key of Object.keys(body)) {
      const value = body[key];
      if (LOCAL_TIME_KEYS.has(key)) {
        continue;
      }
      if (this.isIsoDateString(value)) {
        body[key] = this.toDate(value);
      } else if (typeof value === 'object') {
        this.convert(value);
      }
    }
  }
}
