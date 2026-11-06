import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideZonelessChangeDetection } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { Subject, of, throwError } from 'rxjs';
import { CatalogueParentKind } from '../catalogue-parent-kind.enum';
import { CurationSubmitService } from '../curation-submit.service';
import { PodcastKindTransferResponse } from '../podcast-kind-transfer-response.interface';
import {
  YOU_TUBE_PLAYLIST_LOOKUP_FAILED,
  YOU_TUBE_PLAYLIST_NOT_FOUND,
  YOU_TUBE_PLAYLIST_NOT_FOUND_MESSAGE,
  YOU_TUBE_PLAYLIST_OWNER_LOOKUP_FAILED_MESSAGE
} from '../youtube-playlist-edit-error';
import { TransferPodcastKindSendComponent } from './transfer-podcast-kind-send.component';

describe('TransferPodcastKindSendComponent', () => {
  let fixture: ComponentFixture<TransferPodcastKindSendComponent>;
  let component: TransferPodcastKindSendComponent;
  let dialogRef: { close: ReturnType<typeof vi.fn> };
  let postPodcastKind: ReturnType<typeof vi.fn>;
  let getCatalogueParent: ReturnType<typeof vi.fn>;
  let getPodcast: ReturnType<typeof vi.fn>;

  const podcastId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const parentDto = { id: podcastId, name: 'Synthetic Show' };

  beforeEach(async () => {
    dialogRef = { close: vi.fn() };
    postPodcastKind = vi.fn();
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

  it('says transferred on 202 only after the destination exists and the podcast is gone', async () => {
    const body: PodcastKindTransferResponse = {
      parentId: podcastId,
      targetKind: CatalogueParentKind.TvShow,
      failureIndexingPlayables: true
    };
    postPodcastKind.mockReturnValue(of({ status: 202, body }));
    getCatalogueParent.mockReturnValue(of(parentDto));
    getPodcast.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));

    component.submit(podcastId, CatalogueParentKind.TvShow);
    await vi.waitFor(() => expect(dialogRef.close).toHaveBeenCalled());

    expectTransferredClose(body);
    expect(component.sendError()).toBe(false);
    expect(component.progressMessage()).toBe('Transfer queued. Checking that it finished…');
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
    expect(getCatalogueParent).not.toHaveBeenCalled();
    expect(getPodcast).not.toHaveBeenCalled();
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
        body: { parentId: podcastId, targetKind: CatalogueParentKind.TvShow }
      }));
    getCatalogueParent.mockReturnValue(of(parentDto));
    getPodcast.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));

    component.submit(podcastId, CatalogueParentKind.TvShow);
    await vi.waitFor(() => expect(component.sendError()).toBe(true));
    expect(postPodcastKind).toHaveBeenCalledTimes(1);
    expect(postPodcastKind).toHaveBeenCalledWith(podcastId, CatalogueParentKind.TvShow);

    component.retry();
    await vi.waitFor(() => expect(dialogRef.close).toHaveBeenCalled());

    expect(postPodcastKind).toHaveBeenCalledTimes(2);
    expect(postPodcastKind).toHaveBeenNthCalledWith(2, podcastId, CatalogueParentKind.TvShow);
    expect(getCatalogueParent).toHaveBeenCalled();
    expectTransferredClose({ parentId: podcastId, targetKind: CatalogueParentKind.TvShow });
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
    expect(getCatalogueParent).not.toHaveBeenCalled();
    expect(component.retryable()).toBe(false);
    expect(component.errorMessage()).toBe(YOU_TUBE_PLAYLIST_NOT_FOUND_MESSAGE);
    errorSpy.mockRestore();
  });

  it('recovers from a 5xx when the target parent exists and the podcast is gone', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    postPodcastKind.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 500,
      statusText: 'Server Error'
    })));
    getCatalogueParent.mockReturnValue(of(parentDto));
    getPodcast.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));

    component.submit(podcastId, CatalogueParentKind.TvShow);
    await vi.waitFor(() => expect(dialogRef.close).toHaveBeenCalled());

    expect(component.progressMessage()).toBe('Checking transfer status…');
    expect(dialogRef.close).toHaveBeenCalledWith({
      transferred: true,
      targetKind: CatalogueParentKind.TvShow,
      parentId: podcastId,
      response: { parentId: podcastId, targetKind: CatalogueParentKind.TvShow }
    });
    expect(component.sendError()).toBe(false);
    errorSpy.mockRestore();
  });

  it('recovers from a network drop (status 0) the same way as a 5xx', async () => {
    postPodcastKind.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 0,
      statusText: 'Unknown Error'
    })));
    getCatalogueParent.mockReturnValue(of(parentDto));
    getPodcast.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));

    component.submit(podcastId, CatalogueParentKind.NewsOrganisation);
    await vi.waitFor(() => expect(dialogRef.close).toHaveBeenCalled());

    expect(dialogRef.close).toHaveBeenCalledWith({
      transferred: true,
      targetKind: CatalogueParentKind.NewsOrganisation,
      parentId: podcastId,
      response: { parentId: podcastId, targetKind: CatalogueParentKind.NewsOrganisation }
    });
  });

  it('fails a 5xx when the target parent is missing', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    postPodcastKind.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 504,
      statusText: 'Gateway Timeout'
    })));
    getCatalogueParent.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    getPodcast.mockReturnValue(of({ id: podcastId, name: 'Still Here' }));

    component.submit(podcastId, CatalogueParentKind.TvShow);
    await vi.waitFor(() => expect(component.sendError()).toBe(true));

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(component.isSending()).toBe(false);
    errorSpy.mockRestore();
  });

  it('treats 409 without transferInProgress as already transferred when the target exists and podcast is gone', async () => {
    postPodcastKind.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 409,
      statusText: 'Conflict',
      error: { parentId: podcastId, targetKind: CatalogueParentKind.TvShow }
    })));
    getCatalogueParent.mockReturnValue(of(parentDto));
    getPodcast.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));

    component.submit(podcastId, CatalogueParentKind.TvShow);
    await vi.waitFor(() => expect(dialogRef.close).toHaveBeenCalled());

    expect(component.progressMessage()).toBe('Checking whether the podcast was already transferred…');
    expect(dialogRef.close).toHaveBeenCalledWith({
      transferred: true,
      targetKind: CatalogueParentKind.TvShow,
      parentId: podcastId,
      response: { parentId: podcastId, targetKind: CatalogueParentKind.TvShow }
    });
  });

  it('does not treat Incomplete-style 409 as success when the podcast still exists', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    postPodcastKind.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 409,
      statusText: 'Conflict',
      error: { parentId: podcastId, retryRequired: true }
    })));
    getCatalogueParent.mockReturnValue(of(parentDto));
    getPodcast.mockReturnValue(of({ id: podcastId, name: 'Still Here' }));

    component.submit(podcastId, CatalogueParentKind.TvShow);
    await vi.waitFor(() => expect(component.sendError()).toBe(true));

    expect(dialogRef.close).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('shows Transfer already running on 409 transferInProgress and polls until the target exists', async () => {
    vi.useFakeTimers();
    postPodcastKind.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 409,
      statusText: 'Conflict',
      error: { transferInProgress: true, parentId: podcastId }
    })));
    getCatalogueParent
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 404 })))
      .mockReturnValue(of(parentDto));
    getPodcast
      .mockReturnValueOnce(of({ id: podcastId, name: 'Still Here' }))
      .mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));

    component.submit(podcastId, CatalogueParentKind.TvShow);
    await Promise.resolve();
    expect(component.progressMessage()).toBe('Transfer already running');
    expect(dialogRef.close).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2_000);
    await vi.waitFor(() => expect(dialogRef.close).toHaveBeenCalled());

    expect(dialogRef.close).toHaveBeenCalledWith({
      transferred: true,
      targetKind: CatalogueParentKind.TvShow,
      parentId: podcastId,
      response: { parentId: podcastId, targetKind: CatalogueParentKind.TvShow }
    });
    expect(getCatalogueParent.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('does not say the podcast was transferred when 202 is accepted but the destination never appears', async () => {
    vi.useFakeTimers();
    postPodcastKind.mockReturnValue(of({
      status: 202,
      body: { parentId: podcastId, targetKind: CatalogueParentKind.NewsOrganisation }
    }));
    getCatalogueParent.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    getPodcast.mockReturnValue(of({ id: podcastId, name: 'Still Here' }));

    component.submit(podcastId, CatalogueParentKind.NewsOrganisation);
    await Promise.resolve();
    expect(component.progressMessage()).toBe('Transfer queued. Checking that it finished…');
    expect(dialogRef.close).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(120_000);
    await vi.waitFor(() => expect(component.sendError()).toBe(true));

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(component.retryable()).toBe(true);
    expect(component.errorMessage()).toContain('not confirmed as moved');
  });

  it('keeps the spinner and progress text while sending (disableClose dialog stays open)', async () => {
    const deferred = new Subject<{ status: number; body: PodcastKindTransferResponse }>();
    postPodcastKind.mockReturnValue(deferred.asObservable());
    getCatalogueParent.mockReturnValue(of(parentDto));
    getPodcast.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));

    component.submit(podcastId, CatalogueParentKind.TvShow);
    await Promise.resolve();

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(component.isSending()).toBe(true);
    expect(component.sendError()).toBe(false);
    expect(component.progressMessage()).toBe('Transferring podcast…');

    deferred.next({
      status: 202,
      body: { parentId: podcastId, targetKind: CatalogueParentKind.TvShow }
    });
    deferred.complete();
    await vi.waitFor(() => expect(dialogRef.close).toHaveBeenCalled());

    expectTransferredClose({ parentId: podcastId, targetKind: CatalogueParentKind.TvShow });
  });
});
