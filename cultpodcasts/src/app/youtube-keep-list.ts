import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, switchMap, throwError } from 'rxjs';

/**
 * Shown when an additional YouTube upload appeared after this editor loaded, so a keep-list PATCH would drop it.
 * `item` is the thing being edited ("film", "news report", "TV episode", "episode").
 */
export function staleYouTubeAlternatesMessage(added: number, item: string): string {
  const verb = added === 1
    ? 'An additional YouTube upload was'
    : `${added} additional YouTube uploads were`;
  return `${verb} added to this ${item} after the editor opened. Close and reopen the ${item} to edit them.`;
}

/**
 * 409 body for a YouTube keep-list. `unexpectedAdditionalYouTubeIds` means the server saw an upload this editor
 * did not list. A message with an empty id list (for example a uniqueness conflict) is shown as-is.
 */
export function staleKeepListMessage(
  error: { error?: { unexpectedAdditionalYouTubeIds?: unknown; message?: unknown } | null },
  item: string
): string {
  const body = error.error;
  const youTubeIds = body && typeof body === 'object' ? body.unexpectedAdditionalYouTubeIds : undefined;
  if (Array.isArray(youTubeIds) && youTubeIds.length > 0) {
    return staleYouTubeAlternatesMessage(youTubeIds.length, item);
  }
  const message = body && typeof body === 'object' && typeof body.message === 'string' ? body.message.trim() : '';
  if (message) {
    return message;
  }
  return staleYouTubeAlternatesMessage(1, item);
}

/**
 * Re-reads the playable when the PATCH carries `additionalYouTube` and refuses a stale keep-list. A 409 whose
 * body names `unexpectedAdditionalYouTubeIds` is shown as a 400 with {@link staleKeepListMessage}.
 */
export function patchWithYouTubeKeepList<T extends { additionalYouTube?: { youTubeId: string }[] | null }, R>(
  changes: { additionalYouTube?: unknown },
  known: readonly { youTubeId: string }[] | null | undefined,
  reload: Observable<T>,
  send: () => Observable<R>,
  item: string
): Observable<R> {
  const guarded = () => send().pipe(
    catchError(error => error instanceof HttpErrorResponse && error.status === 409
      ? throwError(() => new HttpErrorResponse({
        status: 400,
        statusText: 'Conflict',
        error: { message: staleKeepListMessage(error, item) }
      }))
      : throwError(() => error))
  );
  if (changes.additionalYouTube === undefined) {
    return guarded();
  }
  const knownIds = new Set((known ?? []).map(row => row.youTubeId));
  return reload.pipe(
    switchMap(latest => {
      const added = (latest.additionalYouTube ?? []).filter(row => !knownIds.has(row.youTubeId));
      if (added.length > 0) {
        return throwError(() => new HttpErrorResponse({
          status: 400,
          statusText: 'YouTube uploads changed',
          error: { message: staleYouTubeAlternatesMessage(added.length, item) }
        }));
      }
      return guarded();
    })
  );
}
