import { Injectable, InjectionToken, PLATFORM_ID, inject } from "@angular/core";
import { isPlatformBrowser } from "@angular/common";
import { DEFAULT_VIEWER_LOCALE, normaliseViewerLocale } from "./languages";

/**
 * Viewer locale for server rendering, provided per request by `server.ts`
 * from the first `Accept-Language` tag. Absent during prerender, where
 * labels render in {@link DEFAULT_VIEWER_LOCALE}.
 */
export const SERVER_VIEWER_LOCALE = new InjectionToken<string>("SERVER_VIEWER_LOCALE");

/** First language tag of an `Accept-Language` header (`es-ES,es;q=0.9` → `es-ES`). */
export function firstAcceptLanguage(header: string | null | undefined): string | undefined {
  const first = header?.split(",")[0]?.split(";")[0]?.trim();
  return first && first !== "*" ? first : undefined;
}

/**
 * Locale used for language labels. Browser: `navigator.languages[0]` (the same
 * preference the browser sends as `Accept-Language`, so SSR text normally matches
 * at hydration; if not, the bound text is simply updated — text values are not
 * part of hydration's DOM-structure check). Server: {@link SERVER_VIEWER_LOCALE}
 * or the default.
 */
@Injectable({ providedIn: "root" })
export class ViewerLocaleService {
  readonly locale: string;

  constructor() {
    const platformId = inject(PLATFORM_ID);
    if (isPlatformBrowser(platformId) && typeof navigator !== "undefined") {
      this.locale = normaliseViewerLocale(navigator.languages?.[0] ?? navigator.language);
    } else {
      this.locale = normaliseViewerLocale(
        inject(SERVER_VIEWER_LOCALE, { optional: true }) ?? DEFAULT_VIEWER_LOCALE);
    }
  }
}
