import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { EditTvShowEpisodeCanonicalDialogComponent } from '../edit-tv-show-episode-canonical-dialog/edit-tv-show-episode-canonical-dialog.component';
import { EpisodeService } from '../episode.service';
import { GuidService } from '../guid.service';
import { SeoService } from '../seo.service';
import { TvShowEpisodeComponent } from './tv-show-episode.component';

describe('TvShowEpisodeComponent', () => {
  let fixture: ComponentFixture<TvShowEpisodeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TvShowEpisodeComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: GuidService, useValue: { parseCatalogueShortId: () => null, getEpisodeUuid: () => '' } },
        { provide: SeoService, useValue: { AddMetaTags: () => undefined } },
        { provide: EpisodeService, useValue: { GetEpisodeDetailsFromApi: async () => undefined, getPlayableById: async () => undefined } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TvShowEpisodeComponent);
    fixture.detectChanges();
  });

  it('opens the identity dialog from the TV episode shell, not the shared playable view', () => {
    const open = TestBed.inject(MatDialog).open as ReturnType<typeof vi.fn>;
    open.mockReturnValue({ afterClosed: () => of(undefined) });

    fixture.componentInstance.editIdentity('ep-tv');

    expect(open).toHaveBeenCalledWith(
      EditTvShowEpisodeCanonicalDialogComponent,
      expect.objectContaining({ data: { episodeId: 'ep-tv' } })
    );
  });
});
