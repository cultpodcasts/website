import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { Podcast } from './podcast.interface';
import { SimplePodcast } from './simple-podcast.interface';
import {
  SubmitSeriesConflictDialogComponent,
  SubmitSeriesConflictDialogData
} from './submit-series-conflict-dialog/submit-series-conflict-dialog.component';
import { SubmitSeriesResolveService } from './submit-series-resolve.service';
import { SubmitSeriesSelection, seriesNameFromForm } from './submit-series.util';

export type ResolveSeriesOutcome =
  | { kind: 'selection'; selection: SubmitSeriesSelection }
  | { kind: 'cancelled' }
  | { kind: 'error' };

/**
 * Probe GET /podcast/{name}. Unique → id; missing → name-only (create);
 * conflict → curator picks by catalogue details. Cancel leaves the form.
 */
export async function resolveSeriesForSubmit(
  resolve: SubmitSeriesResolveService,
  dialog: MatDialog,
  name: string
): Promise<ResolveSeriesOutcome> {
  const probe = await resolve.probeByName(name);
  if (probe.kind === 'error') {
    return { kind: 'error' };
  }
  if (probe.kind === 'missing') {
    return {
      kind: 'selection',
      selection: { podcastId: undefined, podcastName: name.trim() }
    };
  }
  if (probe.kind === 'unique') {
    const id = probe.podcast.id;
    if (!id) {
      return { kind: 'error' };
    }
    return {
      kind: 'selection',
      selection: {
        podcastId: id,
        podcastName: probe.podcast.name ?? name.trim()
      }
    };
  }

  const picked = await chooseSeriesOnConflict(dialog, probe.podcasts, name);
  if (!picked) {
    return { kind: 'cancelled' };
  }
  return {
    kind: 'selection',
    selection: { podcastId: picked.id, podcastName: picked.name }
  };
}

/** Podcast-page attach: name must already exist; 404 is an error, not create. */
export async function resolveSeriesForAttach(
  resolve: SubmitSeriesResolveService,
  dialog: MatDialog,
  name: string
): Promise<ResolveSeriesOutcome> {
  const outcome = await resolveSeriesForSubmit(resolve, dialog, name);
  if (outcome.kind === 'selection' && !outcome.selection.podcastId) {
    return { kind: 'error' };
  }
  return outcome;
}

export async function chooseSeriesOnConflict(
  dialog: MatDialog,
  podcasts: Podcast[],
  name: string
): Promise<SimplePodcast | undefined> {
  return firstValueFrom(
    dialog.open<SubmitSeriesConflictDialogComponent, SubmitSeriesConflictDialogData, SimplePodcast | undefined>(
      SubmitSeriesConflictDialogComponent,
      {
        data: { podcasts, name },
        disableClose: true,
        autoFocus: true,
        width: '90%'
      }
    ).afterClosed()
  );
}

export { seriesNameFromForm };
