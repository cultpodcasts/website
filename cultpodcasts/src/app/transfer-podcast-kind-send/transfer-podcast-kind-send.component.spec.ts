import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { CatalogueParentKind } from '../catalogue-parent-kind.enum';
import { CurationSubmitService } from '../curation-submit.service';
import {
  PodcastKindTransferJobStatusResponse,
  PodcastKindTransferResponse
} from '../podcast-kind-transfer-response.interface';
import {
  YOU_TUBE_PLAYLIST_LOOKUP_FAILED,
  YOU_TUBE_PLAYLIST_NOT_FOUND,
  YOU_TUBE_PLAYLIST_NOT_FOUND_MESSAGE,
  YOU_TUBE_PLAYLIST_OWNER_LOOKUP_FAILED_MESSAGE
} from '../youtube-playlist-edit-error';
import {
  TRANSFER_STILL_RUNNING_MESSAGE,
  TRANSFER_UNCONFIRMED_MESSAGE,
  TransferPodcastKindSendComponent
} from './transfer-podcast-kind-send.component';

describe('TransferPodcastKindSendComponent', () => {
  let fixture: ComponentFixture<TransferPodcastKindSendComponent>;
  let component: TransferPodcastKindSendComponent;
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let postPodcastKind: ReturnType<typeof vi.fn>;
  let getPodcastKind: ReturnType<typeof vi.fn>;
  let getCatalogueParent: ReturnType<typeof vi.fn>;
  let getPodcast: ReturnType<typeof vi.fn>;

  const podcastId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const parentDto = { id: podcastId, name: 'Synthetic Show' };
  const completedJob: PodcastKindTransferJobStatusResponse = {
    status: 'Completed',
    parentId: podcastId,
    targetKind: CatalogueParentKind.TvShow,
    failureIndexingPlayables: true
  };

  beforeEach(async () => {
    dialogRef = { close: vi.fn() };
    postPodcastKind = vi.fn();
    getPodcastKind = vi.fn();
    getCatalogueParent = vi.fn();
    getPodcast = vi.fn();
    await TestBed.configureTestingModule({
      imports: [TransferPodcastKindSendComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MatDialogRef, useValue: dialogRef },
        {
          provide: CurationSubmitService,
          useValue: {
            postPodcastKind,
            getPodcastKind,
            getCatalogueParent,
            getPodcast
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TransferPodcastKindSendComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function expectTransferredClose(body: PodcastKindTransferResponse | null | undefined) {
    expect(dialogRef.close).toHaveBeenCalledWith({
      transferred: true,
      targetKind: CatalogueParentKind.TvShow,
      parentId: body?.parentId,
      response: body
    });
  }

  it('says transferred on 202 Queued only after GET status is Completed', async () => {
    const body: PodcastKindTransferResponse = {
      status: 'Queued',
      parentId: podcastId,
      targetKind: CatalogueParentKind.TvShow,
      statusPath: `podcast/${podcastId}/kind`
    };
    postPodcastKind.mockReturnValue(of({ status: 202, body }));
    getPodcastKind.mockReturnValue(of(completedJob));

    component.submit(podcastId, CatalogueParentKind.TvShow);
    await vi.waitFor(() => expect(dialogRef.close).toHaveBeenCalled());

    expectTransferredClose({
      parentId: podcastId,
      targetKind: CatalogueParentKind.TvShow,
      failureIndexingPlayables: true
    });
    expect(component.sendError()).toBe(false);
    expect(component.progressMessage()).toBe('Transfer queued. Checking that it finished…');
    expect(getPodcastKind).toHaveBeenCalledWith(podcastId);
  });

  it('sets sendError on a non-recoverable HTTP error', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    postPodcastKind.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 400,
      statusText: 'Bad Request'
    })));

    component.submit(podcastId, CatalogueParentKind.NewsOrganisation);
    await Promise.resolve();

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(component.sendError()).toBe(true);
    expect(component.isSending()).toBe(false);
    errorSpy.mockRestore();
  });

  it('surfaces playlist lookup-failed 503 via youtubePlaylistEditError without polling', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    postPodcastKind.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 503,
      statusText: 'Service Unavailable',
      error: {
        error: 'Could not check YouTube playlist',
        code: YOU_TUBE_PLAYLIST_LOOKUP_FAILED,
        retryable: true
      }
    })));

    component.submit(podcastId, CatalogueParentKind.TvShow);
    await vi.waitFor(() => expect(component.sendError()).toBe(true));

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(getPodcastKind).not.toHaveBeenCalled();
    expect(component.retryable()).toBe(true);
    expect(component.errorMessage()).toBe(YOU_TUBE_PLAYLIST_OWNER_LOOKUP_FAILED_MESSAGE);
    errorSpy.mockRestore();
  });

  it('offers Try again on lookup-failed 503 and re-POSTs the same transfer', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    postPodcastKind
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({
        status: 503,
        statusText: 'Service Unavailable',
        error: {
          error: 'Could not check YouTube playlist',
          code: YOU_TUBE_PLAYLIST_LOOKUP_FAILED,
          retryable: true
        }
      })))
      .mockReturnValueOnce(of({
        status: 202,
        body: { status: 'Queued', parentId: podcastId, targetKind: CatalogueParentKind.TvShow }
      }));
    getPodcastKind.mockReturnValue(of(completedJob));

    component.submit(podcastId, CatalogueParentKind.TvShow);
    await vi.waitFor(() => expect(component.sendError()).toBe(true));
    expect(postPodcastKind).toHaveBeenCalledTimes(1);

    component.retry();
    await vi.waitFor(() => expect(dialogRef.close).toHaveBeenCalled());

    expect(postPodcastKind).toHaveBeenCalledTimes(2);
    expect(getPodcastKind).toHaveBeenCalled();
    expectTransferredClose({
      parentId: podcastId,
      targetKind: CatalogueParentKind.TvShow,
      failureIndexingPlayables: true
    });
    errorSpy.mockRestore();
  });

  it('surfaces playlist not-found 400 without treating it as transfer recovery', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    postPodcastKind.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 400,
      statusText: 'Bad Request',
      error: {
        error: "YouTube playlist 'PLx' was not found (it does not exist or is private).",
        code: YOU_TUBE_PLAYLIST_NOT_FOUND
      }
    })));

    component.submit(podcastId, CatalogueParentKind.NewsOrganisation);
    await vi.waitFor(() => expect(component.sendError()).toBe(true));

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(getPodcastKind).not.toHaveBeenCalled();
    expect(component.retryable()).toBe(false);
    expect(component.errorMessage()).toBe(YOU_TUBE_PLAYLIST_NOT_FOUND_MESSAGE);
    errorSpy.mockRestore();
  });

  it('recovers from a 5xx when GET status is Completed', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    postPodcastKind.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 500,
      statusText: 'Server Error'
    })));
    getPodcastKind.mockReturnValue(of(completedJob));

    component.submit(podcastId, CatalogueParentKind.TvShow);
    await vi.waitFor(() => expect(dialogRef.close).toHaveBeenCalled());

    expect(component.progressMessage()).toBe('Checking transfer status…');
    expectTransferredClose({
      parentId: podcastId,
      targetKind: CatalogueParentKind.TvShow,
      failureIndexingPlayables: true
    });
    expect(component.sendError()).toBe(false);
    errorSpy.mockRestore();
  });

  it('recovers from a network drop (status 0) the same way as a 5xx', async () => {
    postPodcastKind.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 0,
      statusText: 'Unknown Error'
    })));
    getPodcastKind.mockReturnValue(of({
      status: 'Completed',
      parentId: podcastId,
      targetKind: CatalogueParentKind.NewsOrganisation
    }));

    component.submit(podcastId, CatalogueParentKind.NewsOrganisation);
    await vi.waitFor(() => expect(dialogRef.close).toHaveBeenCalled());

    expect(dialogRef.close).toHaveBeenCalledWith({
      transferred: true,
      targetKind: CatalogueParentKind.NewsOrganisation,
      parentId: podcastId,
      response: { parentId: podcastId, targetKind: CatalogueParentKind.NewsOrganisation }
    });
  });

  it('says the transfer is still running when a 5xx recovery ends with GET still Running', async () => {
    vi.useFakeTimers();
    postPodcastKind.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 504,
      statusText: 'Gateway Timeout'
    })));
    getPodcastKind.mockReturnValue(of({ status: 'Running', parentId: podcastId }));

    component.submit(podcastId, CatalogueParentKind.TvShow);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(120_000);
    await vi.waitFor(() => expect(component.sendError()).toBe(true));

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(component.isSending()).toBe(false);
    expect(component.errorMessage()).toBe(TRANSFER_STILL_RUNNING_MESSAGE);
    expect(component.retryable()).toBe(true);
  });

  it('fails a 5xx promptly when GET status is Idle and the parent is missing', async () => {
    vi.useFakeTimers();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    postPodcastKind.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 504,
      statusText: 'Gateway Timeout'
    })));
    getPodcastKind.mockReturnValue(of({ status: 'Idle' }));
    getCatalogueParent.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    getPodcast.mockReturnValue(of({ id: podcastId, name: 'Still Here' }));

    component.submit(podcastId, CatalogueParentKind.TvShow);
    await Promise.resolve();
    // One short re-read (first backoff delay), not the ~120s budget.
    await vi.advanceTimersByTimeAsync(2_000);
    await vi.waitFor(() => expect(component.sendError()).toBe(true));

    expect(getPodcastKind).toHaveBeenCalledTimes(2);
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(component.isSending()).toBe(false);
    errorSpy.mockRestore();
  });

  it('recovers a 5xx via the parent/podcast fallback when GET status is Idle', async () => {
    vi.useFakeTimers();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    postPodcastKind.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 504,
      statusText: 'Gateway Timeout'
    })));
    getPodcastKind.mockReturnValue(of({ status: 'Idle' }));
    getCatalogueParent.mockReturnValue(of(parentDto));
    getPodcast.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));

    component.submit(podcastId, CatalogueParentKind.TvShow);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(2_000);
    await vi.waitFor(() => expect(dialogRef.close).toHaveBeenCalled());

    expectTransferredClose({ parentId: podcastId, targetKind: CatalogueParentKind.TvShow });
    expect(component.sendError()).toBe(false);
    errorSpy.mockRestore();
  });

  it('does not recover when the parent exists but the podcast row is still present', async () => {
    vi.useFakeTimers();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    postPodcastKind.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 502 })));
    getPodcastKind.mockReturnValue(of({ status: 'Idle' }));
    getCatalogueParent.mockReturnValue(of(parentDto));
    getPodcast.mockReturnValue(of({ id: podcastId, name: 'Still Here' }));

    component.submit(podcastId, CatalogueParentKind.TvShow);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(2_000);
    await vi.waitFor(() => expect(component.sendError()).toBe(true));

    expect(dialogRef.close).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('treats 409 AlreadyRunning by polling GET until Completed', async () => {
    vi.useFakeTimers();
    postPodcastKind.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 409,
      statusText: 'Conflict',
      error: { status: 'AlreadyRunning', parentId: podcastId }
    })));
    getPodcastKind
      .mockReturnValueOnce(of({ status: 'Running', parentId: podcastId }))
      .mockReturnValue(of(completedJob));

    component.submit(podcastId, CatalogueParentKind.TvShow);
    await Promise.resolve();
    expect(component.progressMessage()).toBe('Transfer already running');
    expect(dialogRef.close).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2_000);
    await vi.waitFor(() => expect(dialogRef.close).toHaveBeenCalled());

    expectTransferredClose({
      parentId: podcastId,
      targetKind: CatalogueParentKind.TvShow,
      failureIndexingPlayables: true
    });
    expect(getPodcastKind.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('shows Failed from GET status with the failure reason', async () => {
    postPodcastKind.mockReturnValue(of({
      status: 202,
      body: { status: 'Queued', parentId: podcastId, targetKind: CatalogueParentKind.TvShow }
    }));
    getPodcastKind.mockReturnValue(of({
      status: 'Failed',
      parentId: podcastId,
      failureReason: 'Synthetic failure reason'
    }));

    component.submit(podcastId, CatalogueParentKind.TvShow);
    await vi.waitFor(() => expect(component.sendError()).toBe(true));

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(component.errorMessage()).toBe('Synthetic failure reason');
    expect(component.retryable()).toBe(true);
  });

  it('offers Try again for Failed without a reason using the default text', async () => {
    postPodcastKind.mockReturnValue(of({ status: 202, body: { status: 'Queued' } }));
    getPodcastKind.mockReturnValue(of({ status: 'Failed', parentId: podcastId, failureReason: '  ' }));

    component.submit(podcastId, CatalogueParentKind.TvShow);
    await vi.waitFor(() => expect(component.sendError()).toBe(true));

    expect(component.errorMessage()).toBe('The transfer failed.');
    expect(component.retryable()).toBe(true);
  });

  it('shows Incomplete as retryable with the default text', async () => {
    postPodcastKind.mockReturnValue(of({ status: 202, body: { status: 'Queued' } }));
    getPodcastKind.mockReturnValue(of({ status: 'Incomplete', parentId: podcastId }));

    component.submit(podcastId, CatalogueParentKind.TvShow);
    await vi.waitFor(() => expect(component.sendError()).toBe(true));

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(component.errorMessage()).toBe('The transfer did not finish. Wait a few minutes and try again.');
    expect(component.retryable()).toBe(true);
  });

  it('re-POSTs after a Failed job when the curator chooses Try again', async () => {
    postPodcastKind.mockReturnValue(of({ status: 202, body: { status: 'Queued' } }));
    getPodcastKind
      .mockReturnValueOnce(of({ status: 'Failed', parentId: podcastId }))
      .mockReturnValue(of(completedJob));

    component.submit(podcastId, CatalogueParentKind.TvShow);
    await vi.waitFor(() => expect(component.retryable()).toBe(true));
    component.retry();
    await vi.waitFor(() => expect(dialogRef.close).toHaveBeenCalled());

    expect(postPodcastKind).toHaveBeenCalledTimes(2);
  });

  it('falls back to the podcast id and requested kind when a Completed job has no parentId', async () => {
    postPodcastKind.mockReturnValue(of({ status: 202, body: { status: 'Queued' } }));
    getPodcastKind.mockReturnValue(of({ status: 'Completed', parentId: null, targetKind: null }));

    component.submit(podcastId, CatalogueParentKind.TvShow);
    await vi.waitFor(() => expect(dialogRef.close).toHaveBeenCalled());

    expectTransferredClose({ parentId: podcastId, targetKind: CatalogueParentKind.TvShow });
  });

  it('closes with the podcast id when recovery proves Completed on a job without parentId', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    postPodcastKind.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    getPodcastKind.mockReturnValue(of({ status: 'Completed' }));

    component.submit(podcastId, CatalogueParentKind.TvShow);
    await vi.waitFor(() => expect(dialogRef.close).toHaveBeenCalled());

    expectTransferredClose({ parentId: podcastId, targetKind: CatalogueParentKind.TvShow });
    errorSpy.mockRestore();
  });

  it('polls the legacy 409 { transferInProgress: true } body until Completed', async () => {
    vi.useFakeTimers();
    postPodcastKind.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 409,
      statusText: 'Conflict',
      error: { transferInProgress: true }
    })));
    getPodcastKind
      .mockReturnValueOnce(of({ status: 'Running', parentId: podcastId }))
      .mockReturnValue(of(completedJob));

    component.submit(podcastId, CatalogueParentKind.TvShow);
    await Promise.resolve();
    expect(component.progressMessage()).toBe('Transfer already running');
    await vi.advanceTimersByTimeAsync(2_000);
    await vi.waitFor(() => expect(dialogRef.close).toHaveBeenCalled());

    expectTransferredClose({
      parentId: podcastId,
      targetKind: CatalogueParentKind.TvShow,
      failureIndexingPlayables: true
    });
  });

  it('tolerates one Idle read after an accepted 202 and then closes on Completed', async () => {
    vi.useFakeTimers();
    postPodcastKind.mockReturnValue(of({ status: 202, body: { status: 'Queued' } }));
    getPodcastKind
      .mockReturnValueOnce(of({ status: 'Idle' }))
      .mockReturnValue(of(completedJob));

    component.submit(podcastId, CatalogueParentKind.TvShow);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(2_000);
    await vi.waitFor(() => expect(dialogRef.close).toHaveBeenCalled());

    expect(getPodcastKind).toHaveBeenCalledTimes(2);
  });

  it('recovers a 202 via the parent/podcast fallback when GET status errors for the whole budget', async () => {
    vi.useFakeTimers();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    postPodcastKind.mockReturnValue(of({ status: 202, body: { status: 'Queued' } }));
    getPodcastKind.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    getCatalogueParent.mockReturnValue(of(parentDto));
    getPodcast.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));

    component.submit(podcastId, CatalogueParentKind.TvShow);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(120_000);
    await vi.waitFor(() => expect(dialogRef.close).toHaveBeenCalled());

    expectTransferredClose({ parentId: podcastId, targetKind: CatalogueParentKind.TvShow });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('reports an unconfirmed transfer on a 202 when GET is 404 and the fallback finds no move', async () => {
    vi.useFakeTimers();
    postPodcastKind.mockReturnValue(of({ status: 202, body: { status: 'Queued' } }));
    getPodcastKind.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    getCatalogueParent.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    getPodcast.mockReturnValue(of({ id: podcastId, name: 'Still Here' }));

    component.submit(podcastId, CatalogueParentKind.TvShow);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(120_000);
    await vi.waitFor(() => expect(component.sendError()).toBe(true));

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(component.errorMessage()).toBe(TRANSFER_UNCONFIRMED_MESSAGE);
    expect(component.retryable()).toBe(true);
  });

  it('stops polling and surfaces the error when the status GET is forbidden', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    postPodcastKind.mockReturnValue(of({ status: 202, body: { status: 'Queued' } }));
    getPodcastKind.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));

    component.submit(podcastId, CatalogueParentKind.TvShow);
    await vi.waitFor(() => expect(component.sendError()).toBe(true));

    expect(getPodcastKind).toHaveBeenCalledTimes(1);
    expect(getCatalogueParent).not.toHaveBeenCalled();
    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(component.retryable()).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('stops polling when the status GET is unauthorised during 5xx recovery', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    postPodcastKind.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    getPodcastKind.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));

    component.submit(podcastId, CatalogueParentKind.TvShow);
    await vi.waitFor(() => expect(component.sendError()).toBe(true));

    expect(getPodcastKind).toHaveBeenCalledTimes(1);
    expect(dialogRef.close).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('does not say the podcast was transferred when 202 is accepted but GET stays Running', async () => {
    vi.useFakeTimers();
    postPodcastKind.mockReturnValue(of({
      status: 202,
      body: { status: 'Queued', parentId: podcastId, targetKind: CatalogueParentKind.NewsOrganisation }
    }));
    getPodcastKind.mockReturnValue(of({ status: 'Running', parentId: podcastId }));

    component.submit(podcastId, CatalogueParentKind.NewsOrganisation);
    await Promise.resolve();
    expect(component.progressMessage()).toBe('Transfer queued. Checking that it finished…');
    expect(dialogRef.close).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(120_000);
    await vi.waitFor(() => expect(component.sendError()).toBe(true));

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(component.retryable()).toBe(true);
    expect(component.errorMessage()).toBe(TRANSFER_STILL_RUNNING_MESSAGE);
    expect(component.errorMessage()).not.toContain('episodes');
  });

  it('keeps the spinner and progress text while sending (disableClose dialog stays open)', async () => {
    const deferred = new Subject<{ status: number; body: PodcastKindTransferResponse }>();
    postPodcastKind.mockReturnValue(deferred.asObservable());
    getPodcastKind.mockReturnValue(of(completedJob));

    component.submit(podcastId, CatalogueParentKind.TvShow);
    await Promise.resolve();

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(component.isSending()).toBe(true);
    expect(component.sendError()).toBe(false);
    expect(component.progressMessage()).toBe('Transferring podcast…');

    deferred.next({
      status: 202,
      body: { status: 'Queued', parentId: podcastId, targetKind: CatalogueParentKind.TvShow }
    });
    deferred.complete();
    await vi.waitFor(() => expect(dialogRef.close).toHaveBeenCalled());

    expectTransferredClose({
      parentId: podcastId,
      targetKind: CatalogueParentKind.TvShow,
      failureIndexingPlayables: true
    });
  });
});
