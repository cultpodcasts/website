import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, of } from 'rxjs';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { ProfileService } from '../profile.service';
import { SiteService } from '../site.service';
import { InfiniteScrollStrategy } from '../infinite-scroll-strategy';
import { PublicEpisode } from '../public-episode.interface';
import { EditEpisodeDialogComponent } from '../edit-episode-dialog/edit-episode-dialog.component';
import { EditNewsReportDialogComponent } from '../edit-news-report-dialog/edit-news-report-dialog.component';
import { EditFilmDialogComponent } from '../edit-film-dialog/edit-film-dialog.component';
import { ContentKindDto } from '@cultpodcasts/contracts';
import { BookmarksApiComponent } from './bookmarks-api.component';

/** Synthetic public episode (`GET /public/episode/:id`); no real titles or ids. */
function publicEpisode(overrides: Partial<PublicEpisode> = {}): PublicEpisode {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    podcastName: 'Synthetic Pod',
    title: 'Synthetic Episode',
    description: '',
    release: new Date('2026-01-02T00:00:00Z'),
    duration: '00:09:18',
    explicit: false,
    subjects: [],
    ids: null,
    services: null,
    image: null,
    ...overrides,
  } as PublicEpisode;
}

describe('BookmarksApiComponent curator Edit', () => {
  let dialog: { open: ReturnType<typeof vi.fn> };
  let component: BookmarksApiComponent;

  beforeEach(async () => {
    dialog = { open: vi.fn().mockReturnValue({ afterClosed: () => of(undefined) }) };
    await TestBed.configureTestingModule({
      imports: [BookmarksApiComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: MatDialog, useValue: dialog },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: AuthServiceWrapper, useValue: { roles: new BehaviorSubject<string[]>(['Curator']), authService: {} } },
        { provide: ProfileService, useValue: { bookmarks$: of(new Set<string>()) } },
        { provide: SiteService, useValue: { setQuery: vi.fn(), setPodcast: vi.fn(), setSubject: vi.fn() } },
        { provide: InfiniteScrollStrategy, useValue: { getTake: () => 10 } },
      ],
    }).compileComponents();
    // Not detectChanges(): ngOnInit would load bookmarks; these tests only drive edit()/canEdit().
    component = TestBed.createComponent(BookmarksApiComponent).componentInstance;
  });

  it('opens the episode dialog with podcastName as the podcast identifier (not undefined podcastId)', () => {
    const episode = publicEpisode({ contentKind: ContentKindDto.Episode });
    component.edit(episode);
    expect(dialog.open).toHaveBeenCalledTimes(1);
    const [type, config] = dialog.open.mock.calls[0];
    expect(type).toBe(EditEpisodeDialogComponent);
    expect(config.data).toEqual({ podcastIdentifier: 'Synthetic Pod', episodeId: episode.id });
  });

  it('treats a missing contentKind as a podcast episode', () => {
    component.edit(publicEpisode());
    expect(dialog.open.mock.calls[0][0]).toBe(EditEpisodeDialogComponent);
  });

  it('routes a news report to the news report dialog by guid, not the podcast episode dialog', () => {
    const episode = publicEpisode({ contentKind: ContentKindDto.NewsReport, podcastName: 'Synthetic Org' });
    component.edit(episode);
    const [type, config] = dialog.open.mock.calls[0];
    expect(type).toBe(EditNewsReportDialogComponent);
    expect(config.data).toEqual({ reportId: episode.id });
  });

  it('routes a film to the film dialog', () => {
    const episode = publicEpisode({ contentKind: ContentKindDto.Film, podcastName: '' });
    component.edit(episode);
    expect(dialog.open.mock.calls[0][0]).toBe(EditFilmDialogComponent);
  });

  it('offers Edit for a film with no parent name, but not for a podcast episode without a name', () => {
    expect(component.canEdit(publicEpisode({ contentKind: ContentKindDto.Film, podcastName: '' }))).toBe(true);
    expect(component.canEdit(publicEpisode({ contentKind: ContentKindDto.Episode, podcastName: '' }))).toBe(false);
    expect(component.canEdit(undefined)).toBe(false);
  });
});
