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
import { IndexDialogComponent } from '../index-dialog/index-dialog.component';
import { EditPodcastDialogComponent } from './edit-podcast-dialog.component';

describe('EditPodcastDialogComponent', () => {
  let dialogOpen: ReturnType<typeof vi.fn>;
  let snackOpen: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    dialogOpen = vi.fn(() => ({ afterClosed: () => of({ updated: true, episodeIds: ['p/e'] }) }));
    snackOpen = vi.fn();
    await TestBed.configureTestingModule({
      imports: [EditPodcastDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: MAT_DIALOG_DATA, useValue: { podcastName: 'Clothesline Desk' } },
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
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

  it('indexBacklog opens IndexDialog for the podcast name and snacks the result', () => {
    const fixture = TestBed.createComponent(EditPodcastDialogComponent);
    const sut = fixture.componentInstance;
    sut.podcastName = 'Clothesline Desk';

    sut.indexBacklog();

    expect(dialogOpen).toHaveBeenCalledWith(
      IndexDialogComponent,
      expect.objectContaining({
        data: { kind: 'podcast', name: 'Clothesline Desk' }
      })
    );
    expect(snackOpen).toHaveBeenCalledWith(
      'Podcast Indexed. 1 episode updated',
      'Ok',
      { duration: 10000 }
    );
  });
});
