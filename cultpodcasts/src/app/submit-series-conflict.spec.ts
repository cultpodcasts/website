import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it, vi } from 'vitest';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { resolveAmbiguousPodcastIds, resolveSeriesForAttach, resolveSeriesForSubmit, resolveSubmitNameConflict } from './submit-series-conflict';
import { SubmitSeriesResolveService } from './submit-series-resolve.service';
import { Podcast } from './podcast.interface';

const uniqueId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const otherId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

function cataloguePodcast(id: string, name: string): Podcast {
  return {
    id,
    name,
    removed: false,
    indexAllEpisodes: false,
    bypassShortEpisodeChecking: false,
    alwaysPromoteAsHero: false,
    spotifyId: 'show-token',
    appleId: null,
    youTubePublicationDelay: '',
    skipEnrichingFromYouTube: false,
    twitterHandle: '',
    blueskyHandle: '',
    titleRegex: '',
    descriptionRegex: '',
    episodeMatchRegex: '',
    episodeIncludeTitleRegex: '',
    defaultSubject: null,
    ignoreAllEpisodes: false,
    youTubeChannelId: '',
    youTubePlaylistId: '',
    ignoredAssociatedSubjects: [],
    ignoredSubjects: [],
    lang: 'en',
    knownTerms: [],
    minimumDuration: '',
    enrichmentHashTags: null,
    hashTag: null
  };
}

describe('resolveSeriesForSubmit', () => {
  it('returns podcastId when GET finds a unique series', async () => {
    const name = 'Unique Series Title';
    const resolve = {
      probeByName: vi.fn().mockResolvedValue({
        kind: 'unique',
        podcast: cataloguePodcast(uniqueId, name)
      })
    } as unknown as SubmitSeriesResolveService;
    const dialog = { open: vi.fn() } as unknown as MatDialog;

    const outcome = await resolveSeriesForSubmit(resolve, dialog, name);

    expect(outcome).toEqual({
      kind: 'selection',
      selection: { podcastId: uniqueId, podcastName: name }
    });
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('returns name-only when the series is missing so submit can create', async () => {
    const name = 'New Series Title';
    const resolve = {
      probeByName: vi.fn().mockResolvedValue({ kind: 'missing' })
    } as unknown as SubmitSeriesResolveService;
    const dialog = { open: vi.fn() } as unknown as MatDialog;

    const outcome = await resolveSeriesForSubmit(resolve, dialog, name);

    expect(outcome).toEqual({
      kind: 'selection',
      selection: { podcastId: undefined, podcastName: name }
    });
  });

  it('opens the conflict picker and uses the chosen catalogue row', async () => {
    const name = 'Duplicate Series Title';
    const first = cataloguePodcast(uniqueId, name);
    const second = cataloguePodcast(otherId, name);
    const resolve = {
      probeByName: vi.fn().mockResolvedValue({
        kind: 'conflict',
        ids: [uniqueId, otherId],
        podcasts: [first, second]
      })
    } as unknown as SubmitSeriesResolveService;
    const dialog = {
      open: vi.fn().mockReturnValue({
        afterClosed: () => of({ id: otherId, name })
      })
    } as unknown as MatDialog;

    const outcome = await resolveSeriesForSubmit(resolve, dialog, name);

    expect(outcome).toEqual({
      kind: 'selection',
      selection: { podcastId: otherId, podcastName: name }
    });
    expect(dialog.open).toHaveBeenCalled();
  });
});

describe('resolveSeriesForAttach', () => {
  it('errors instead of creating when a podcast-page name is missing', async () => {
    const resolve = {
      probeByName: vi.fn().mockResolvedValue({ kind: 'missing' })
    } as unknown as SubmitSeriesResolveService;
    const dialog = { open: vi.fn() } as unknown as MatDialog;

    const outcome = await resolveSeriesForAttach(resolve, dialog, 'Missing Series Title');

    expect(outcome).toEqual({ kind: 'error' });
  });
});

describe('resolveSubmitNameConflict', () => {
  it('loads POST /submit 409 UUIDs and returns the chosen podcastId for resubmit', async () => {
    const name = 'Duplicate Series Title';
    const first = cataloguePodcast(uniqueId, name);
    const second = cataloguePodcast(otherId, name);
    const resolve = {
      loadByIds: vi.fn().mockResolvedValue([first, second])
    } as unknown as SubmitSeriesResolveService;
    const dialog = {
      open: vi.fn().mockReturnValue({
        afterClosed: () => of({ id: otherId, name })
      })
    } as unknown as MatDialog;
    const error = new HttpErrorResponse({
      status: 409,
      statusText: 'Conflict',
      error: [uniqueId, otherId]
    });

    const outcome = await resolveSubmitNameConflict(resolve, dialog, error, name);

    expect(resolve.loadByIds).toHaveBeenCalledWith([uniqueId, otherId]);
    expect(outcome).toEqual({
      kind: 'selection',
      selection: { podcastId: otherId, podcastName: name }
    });
  });

  it('does not open the picker when 409 has no UUID list', async () => {
    const resolve = { loadByIds: vi.fn() } as unknown as SubmitSeriesResolveService;
    const dialog = { open: vi.fn() } as unknown as MatDialog;
    const error = new HttpErrorResponse({
      status: 409,
      statusText: 'Conflict',
      error: { message: 'name collision' }
    });

    const outcome = await resolveSubmitNameConflict(resolve, dialog, error, 'Series');

    expect(outcome).toEqual({ kind: 'error' });
    expect(resolve.loadByIds).not.toHaveBeenCalled();
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('treats a 400 submit error as not a name collision', async () => {
    const resolve = { loadByIds: vi.fn() } as unknown as SubmitSeriesResolveService;
    const dialog = { open: vi.fn() } as unknown as MatDialog;
    const error = new HttpErrorResponse({
      status: 400,
      statusText: 'Bad Request',
      error: { message: 'url must be absolute http(s)' }
    });

    const outcome = await resolveSubmitNameConflict(resolve, dialog, error, 'Series');

    expect(outcome).toEqual({ kind: 'error' });
    expect(resolve.loadByIds).not.toHaveBeenCalled();
  });

  it('treats a 404 submit error as not a name collision', async () => {
    const resolve = { loadByIds: vi.fn() } as unknown as SubmitSeriesResolveService;
    const dialog = { open: vi.fn() } as unknown as MatDialog;
    const error = new HttpErrorResponse({
      status: 404,
      statusText: 'Not Found',
      error: { message: 'not found' }
    });

    const outcome = await resolveSubmitNameConflict(resolve, dialog, error, 'Series');

    expect(outcome).toEqual({ kind: 'error' });
    expect(resolve.loadByIds).not.toHaveBeenCalled();
  });

  it('returns cancelled when the curator dismisses the picker', async () => {
    const name = 'Duplicate Series Title';
    const first = cataloguePodcast(uniqueId, name);
    const second = cataloguePodcast(otherId, name);
    const resolve = {
      loadByIds: vi.fn().mockResolvedValue([first, second])
    } as unknown as SubmitSeriesResolveService;
    const dialog = {
      open: vi.fn().mockReturnValue({
        afterClosed: () => of(undefined)
      })
    } as unknown as MatDialog;
    const error = new HttpErrorResponse({
      status: 409,
      statusText: 'Conflict',
      error: [uniqueId, otherId]
    });

    const outcome = await resolveSubmitNameConflict(resolve, dialog, error, name);

    expect(outcome).toEqual({ kind: 'cancelled' });
  });

  it('errors when any conflict UUID fails to load, instead of showing a partial picker', async () => {
    const name = 'Duplicate Series Title';
    const first = cataloguePodcast(uniqueId, name);
    const resolve = {
      loadByIds: vi.fn().mockResolvedValue([first])
    } as unknown as SubmitSeriesResolveService;
    const dialog = { open: vi.fn() } as unknown as MatDialog;
    const error = new HttpErrorResponse({
      status: 409,
      statusText: 'Conflict',
      error: [uniqueId, otherId]
    });

    const outcome = await resolveSubmitNameConflict(resolve, dialog, error, name);

    expect(outcome).toEqual({ kind: 'error' });
    expect(dialog.open).not.toHaveBeenCalled();
  });

  it('is not a submit-name conflict when the status is not 409', async () => {
    const resolve = { loadByIds: vi.fn() } as unknown as SubmitSeriesResolveService;
    const dialog = { open: vi.fn() } as unknown as MatDialog;
    const error = new HttpErrorResponse({ status: 500, statusText: 'Server Error' });

    const outcome = await resolveSubmitNameConflict(resolve, dialog, error, 'Series');

    expect(outcome).toEqual({ kind: 'error' });
    expect(resolve.loadByIds).not.toHaveBeenCalled();
  });
});

describe('resolveAmbiguousPodcastIds', () => {
  it('opens the conflict picker for lookup podcastIds and returns the chosen id', async () => {
    const name = 'Duplicate Series Title';
    const first = cataloguePodcast(uniqueId, name);
    const second = cataloguePodcast(otherId, name);
    const resolve = {
      loadByIds: vi.fn().mockResolvedValue([first, second])
    } as unknown as SubmitSeriesResolveService;
    const dialog = {
      open: vi.fn().mockReturnValue({
        afterClosed: () => of({ id: otherId, name })
      })
    } as unknown as MatDialog;

    const outcome = await resolveAmbiguousPodcastIds(resolve, dialog, [uniqueId, otherId], undefined);

    expect(resolve.loadByIds).toHaveBeenCalledWith([uniqueId, otherId]);
    expect(outcome).toEqual({
      kind: 'selection',
      selection: { podcastId: otherId, podcastName: name }
    });
  });

  it('returns cancelled when the curator dismisses, so Save stays on the form', async () => {
    const first = cataloguePodcast(uniqueId, 'Series A');
    const second = cataloguePodcast(otherId, 'Series B');
    const resolve = {
      loadByIds: vi.fn().mockResolvedValue([first, second])
    } as unknown as SubmitSeriesResolveService;
    const dialog = {
      open: vi.fn().mockReturnValue({
        afterClosed: () => of(undefined)
      })
    } as unknown as MatDialog;

    const outcome = await resolveAmbiguousPodcastIds(resolve, dialog, [uniqueId, otherId], undefined);

    expect(outcome).toEqual({ kind: 'cancelled' });
  });

  it('errors on a partial UUID load instead of a one-row picker', async () => {
    const first = cataloguePodcast(uniqueId, 'Series A');
    const resolve = {
      loadByIds: vi.fn().mockResolvedValue([first])
    } as unknown as SubmitSeriesResolveService;
    const dialog = { open: vi.fn() } as unknown as MatDialog;

    const outcome = await resolveAmbiguousPodcastIds(resolve, dialog, [uniqueId, otherId], undefined);

    expect(outcome).toEqual({ kind: 'error' });
    expect(dialog.open).not.toHaveBeenCalled();
  });
});
