import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { authInterceptor } from '../auth.interceptor';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { CatalogueParentKind } from '../catalogue-parent-kind.enum';
import { ConfirmComponent } from '../confirm/confirm.component';
import { IndexDialogComponent } from '../index-dialog/index-dialog.component';
import { TransferPodcastKindSendComponent } from '../transfer-podcast-kind-send/transfer-podcast-kind-send.component';
import { AddPodcastDialogComponent } from './add-podcast-dialog.component';

describe('AddPodcastDialogComponent', () => {
  let dialogOpen: ReturnType<typeof vi.fn>;
  let close: ReturnType<typeof vi.fn>;
  let snackOpen: ReturnType<typeof vi.fn>;
  const podcastId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

  beforeEach(async () => {
    dialogOpen = vi.fn(() => ({ afterClosed: () => of(undefined) }));
    close = vi.fn();
    snackOpen = vi.fn();
    await TestBed.configureTestingModule({
      imports: [AddPodcastDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        {
          provide: MAT_DIALOG_DATA,
          useValue: { podcastName: 'Clothesline Desk', podcastId }
        },
        { provide: MatDialogRef, useValue: { close } },
        { provide: MatSnackBar, useValue: { open: snackOpen } },
        {
          provide: AuthServiceWrapper,
          useValue: { authService: { getAccessTokenSilently: () => of('test-token') } }
        }
      ]
    })
      .overrideProvider(MatDialog, {
        useValue: {
          open: (...args: unknown[]) => (dialogOpen as unknown as (...a: unknown[]) => unknown)(...args)
        }
      })
      .compileComponents();
  });

  it('indexBacklog opens IndexDialog for the create-time podcast name', () => {
    dialogOpen.mockReturnValue({
      afterClosed: () => of({ updated: true, episodeIds: ['p/1', 'p/2'] })
    });
    const sut = TestBed.createComponent(AddPodcastDialogComponent).componentInstance;

    sut.indexBacklog();

    expect(dialogOpen).toHaveBeenCalledWith(
      IndexDialogComponent,
      expect.objectContaining({
        data: { kind: 'podcast', name: 'Clothesline Desk' }
      })
    );
    expect(snackOpen).toHaveBeenCalledWith(
      'Podcast Indexed. 2 episodes updated',
      'Ok',
      { duration: 10000 }
    );
  });

  it('transferKind confirms then opens TransferPodcastKindSend and closes transferred', async () => {
    const submit = vi.fn();
    dialogOpen
      .mockReturnValueOnce({ afterClosed: () => of({ result: true }) })
      .mockReturnValueOnce({
        componentInstance: { submit },
        afterClosed: () =>
          of({
            transferred: true,
            targetKind: CatalogueParentKind.NewsOrganisation,
            response: { failureIndexingPlayables: false }
          })
      });

    const sut = TestBed.createComponent(AddPodcastDialogComponent).componentInstance;
    sut.transferTarget.set(CatalogueParentKind.NewsOrganisation);

    await sut.transferKind();

    expect(dialogOpen.mock.calls[0][0]).toBe(ConfirmComponent);
    expect(dialogOpen.mock.calls[1][0]).toBe(TransferPodcastKindSendComponent);
    expect(submit).toHaveBeenCalledWith(podcastId, CatalogueParentKind.NewsOrganisation);
    expect(close).toHaveBeenCalledWith({
      transferred: true,
      targetKind: CatalogueParentKind.NewsOrganisation,
      response: { failureIndexingPlayables: false }
    });
  });

  it('transferKind does nothing when the curator cancels confirm', async () => {
    dialogOpen.mockReturnValue({ afterClosed: () => of({ result: false }) });
    const sut = TestBed.createComponent(AddPodcastDialogComponent).componentInstance;
    sut.transferTarget.set(CatalogueParentKind.TvShow);

    await sut.transferKind();

    expect(dialogOpen).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  });
});
