import { HttpErrorResponse } from '@angular/common/http';
import type { SubmitUrlLookupResponse } from './submit-url-lookup.interface';

/** Dialog / snackbar copy when POST /submit fails without a rejected message. */
export const GENERIC_SUBMIT_URL_ERROR = 'Error sending Url to CultPodcasts.com';

/**
 * True when GET /submit/lookup (or a typed lookup body) refuses the URL.
 * Older Api omits `rejected` — treat missing as not rejected.
 */
export function isSubmitUrlLookupRejected(
  lookup: SubmitUrlLookupResponse | 'error' | null | undefined
): lookup is SubmitUrlLookupResponse & { rejected: true } {
  return !!lookup && lookup !== 'error' && lookup.rejected === true;
}

/** Server message for a rejected lookup, when present and non-blank. */
export function submitUrlLookupRejectionMessage(
  lookup: SubmitUrlLookupResponse | 'error' | null | undefined
): string | undefined {
  if (!isSubmitUrlLookupRejected(lookup)) {
    return undefined;
  }
  const message = lookup.message?.trim();
  return message || undefined;
}

/**
 * Message for a 400 POST /submit body with `rejected: true`.
 * Returns undefined for other statuses, missing `rejected`, or blank/absent `message`
 * (e.g. Netflix title hubs) so callers keep the generic submit error.
 */
export function submitUrlHttpRejectionMessage(error: unknown): string | undefined {
  if (!(error instanceof HttpErrorResponse) || error.status !== 400) {
    return undefined;
  }
  const raw = error.error;
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }
  const body = raw as { rejected?: unknown; message?: unknown };
  if (body.rejected !== true) {
    return undefined;
  }
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  return message || undefined;
}

/** Display text for a failed submit: server rejection message or the generic fallback. */
export function submitUrlErrorDisplay(error: unknown): string {
  return submitUrlHttpRejectionMessage(error) ?? GENERIC_SUBMIT_URL_ERROR;
}
