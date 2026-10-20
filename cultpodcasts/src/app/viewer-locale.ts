import { Injectable, PLATFORM_ID, afterNextRender, inject, signal } from "@angular/core";
import { isPlatformBrowser } from "@angular/common";
import { DEFAULT_VIEWER_LOCALE, normaliseViewerLocale } from "./languages";

/**
 * The browser's preferred language: `navigator.languages[0]`, then
 * `navigator.language`, then English (also when there is no navigator: `null`).
 */
export function browserViewerLocale(
  nav: Pick<Navigator, "languages" | "language"> | null =
    typeof navigator === "undefined" ? null : navigator
): string {
  return normaliseViewerLocale(nav?.languages?.[0] ?? nav?.language ?? DEFAULT_VIEWER_LOCALE);
}

/**
 * Locale used for language labels.
 *
 * Starts as {@link DEFAULT_VIEWER_LOCALE} on every platform, so server-rendered
 * and prerendered HTML (e.g. homepage episode badges) and the first client
 * render agree during hydration. In the browser it switches to
 * {@link browserViewerLocale} after the next render; signal readers then
 * re-render in the visitor's language. Client-only views (the `@defer`ed search
 * and subject results with the language chips) render after the switch.
 */
@Injectable({ providedIn: "root" })
export class ViewerLocaleService {
  private readonly current = signal(DEFAULT_VIEWER_LOCALE);
  readonly locale = this.current.asReadonly();

  constructor() {
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      afterNextRender(() => this.current.set(browserViewerLocale()));
    }
  }
}
