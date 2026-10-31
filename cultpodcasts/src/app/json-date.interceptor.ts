import { Injectable } from '@angular/core';
import { HttpContextToken, HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

const NO_KEYS: ReadonlySet<string> = new Set();

/**
 * Request-scoped opt-out: response keys (at any depth) that {@link JsonDateInterceptor} leaves as text for this
 * request only. Default: none.
 *
 * EXCEPTION to UTC-only: the discovery schedule's `slotStartUk` is UK local wall-clock time with its UK offset
 * (curators set run times in local time, which moves against UTC with daylight saving). A `Date` would drop that
 * offset, so the discovery-schedule requests set this token to `slotStartUk`.
 */
export const KEEP_AS_TEXT_KEYS = new HttpContextToken<ReadonlySet<string>>(() => NO_KEYS);

/**
 * Turns ISO-8601 date-time strings in API responses into `Date` objects.
 *
 * - The API emits every date-time as a UTC instant ending in `Z`; an explicit offset (`+01:00`) is also read as
 *   that instant.
 * - A zone-less date-time (`yyyy-MM-ddTHH:mm:ss[.fff]`) is read as UTC (a `Z` is appended), never as
 *   browser-local time.
 * - Fractional seconds are cut or padded to exactly 3 digits before parsing (.NET sends 7), because parsing other
 *   lengths is engine-specific (the iOS app runs on WKWebView/JavaScriptCore).
 * - A value that matches the shape but is not a real date-time (e.g. `T25:00:00`, `+25:00`) stays as text.
 * - Date-only text (`yyyy-MM-dd`), years and other strings are left as text.
 * - Keys in the request's {@link KEEP_AS_TEXT_KEYS} stay as text.
 */
@Injectable()
export class JsonDateInterceptor implements HttpInterceptor {

  private readonly _isoDateFormat =
    /^(?<base>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(?<fraction>\d+))?(?<zone>Z|[+-]\d{2}:\d{2})?$/;

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const keepAsText = req.context.get(KEEP_AS_TEXT_KEYS);
    return next.handle(req).pipe(map((val: HttpEvent<any>) => {
      if (val instanceof HttpResponse) {
        this.convert(val.body, keepAsText);
      }
      return val;
    }));
  }

  convert(body: any, keepAsText: ReadonlySet<string> = NO_KEYS) {
    if (body === null || body === undefined || typeof body !== 'object') {
      return body;
    }
    for (const key of Object.keys(body)) {
      if (keepAsText.has(key)) {
        continue;
      }
      const value = body[key];
      const date = this.tryParse(value);
      if (date) {
        body[key] = date;
      } else if (typeof value === 'object') {
        this.convert(value, keepAsText);
      }
    }
    return body;
  }

  /** `Date` for an ISO date-time string (zone-less read as UTC), or `null` to leave the value unchanged. */
  private tryParse(value: unknown): Date | null {
    if (typeof value !== 'string') {
      return null;
    }
    const groups = this._isoDateFormat.exec(value)?.groups;
    if (!groups) {
      return null;
    }
    const millis = (groups['fraction'] ?? '').padEnd(3, '0').slice(0, 3);
    const date = new Date(`${groups['base']}.${millis}${groups['zone'] ?? 'Z'}`);
    return isNaN(date.getTime()) ? null : date;
  }
}
