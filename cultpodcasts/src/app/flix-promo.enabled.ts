import { InjectionToken, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

/** Meta written by the Pages worker from `FLIX_PROMO_ENABLED`. */
export const FLIX_PROMO_META_NAME = 'cp-flix-promo';

/**
 * Homepage Flix promo visibility.
 * Cloudflare Pages var `FLIX_PROMO_ENABLED` (`true`/`false`); unset defaults to on.
 * Local/dev without the meta also defaults to on.
 */
export const FLIX_PROMO_ENABLED = new InjectionToken<boolean>('FLIX_PROMO_ENABLED', {
  providedIn: 'root',
  factory: () => readFlixPromoEnabled(inject(DOCUMENT))
});

export function readFlixPromoEnabled(doc: Document): boolean {
  const content = doc.querySelector(`meta[name="${FLIX_PROMO_META_NAME}"]`)?.getAttribute('content');
  if (content == null || content === '') {
    return true;
  }
  const normalized = content.trim().toLowerCase();
  return normalized !== '0' && normalized !== 'false' && normalized !== 'off';
}

export function parseFlixPromoEnabled(raw: string | undefined): boolean {
  if (raw == null || raw === '') {
    return true;
  }
  const normalized = raw.trim().toLowerCase();
  return normalized !== '0' && normalized !== 'false' && normalized !== 'off';
}
