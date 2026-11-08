import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { OverlayContainer } from '@angular/cdk/overlay';
import { ApiEpisode } from '../api-episode.interface';
import { playableCuratorActionLabel } from '../content-kind-label';
import { CuratorPlayableCardComponent } from './curator-playable-card.component';

function row(contentKind?: string, overrides: Partial<ApiEpisode> = {}): ApiEpisode {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    title: 'Synthetic title',
    displayTitle: 'Synthetic title',
    description: '',
    displayDescription: '',
    posted: false,
    tweeted: false,
    ignored: false,
    removed: false,
    explicit: false,
    release: new Date('2026-01-02T00:00:00Z'),
    duration: '0:06:30',
    podcastId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    podcastName: 'Synthetic Parent',
    contentKind,
    ...overrides,
  } as ApiEpisode;
}

const podcastAdminFlags = {
  authRoles: ['Curator', 'Admin'] as readonly string[],
  showIndexPodcast: true,
  showDeleteEpisode: true,
};

describe('CuratorPlayableCardComponent', () => {
  let fixture: ComponentFixture<CuratorPlayableCardComponent>;
  let overlay: OverlayContainer;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CuratorPlayableCardComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(CuratorPlayableCardComponent);
    overlay = TestBed.inject(OverlayContainer);
  });

  afterEach(() => {
    overlay.ngOnDestroy();
  });

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function parentSubtitleLink(): HTMLAnchorElement | null {
    return host().querySelector('mat-card-subtitle:not(.curator-card__meta) a') as HTMLAnchorElement | null;
  }

  async function openOverflowMenu(): Promise<string[]> {
    const trigger = host().querySelector('button.curator-card__overflow') as HTMLButtonElement;
    expect(trigger).toBeTruthy();
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const items = overlay.getContainerElement().querySelectorAll('button[mat-menu-item], .mat-mdc-menu-item');
    // Mat-icon ligature concatenates into menuitem.textContent; assert on the label span only.
    return Array.from(items).map(el => el.querySelector('span')?.textContent?.trim() ?? '');
  }

  function render(episode: ApiEpisode, inputs: Record<string, unknown> = {}): void {
    fixture.componentRef.setInput('episode', episode);
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
  }

  it('renders the film card for Film contentKind', () => {
    render(row('Film'));
    expect(host().querySelector('app-curator-film-card')).not.toBeNull();
    expect(host().querySelector('app-curator-episode-card')).toBeNull();
  });

  it('renders the news card for NewsReport contentKind', () => {
    render(row('NewsReport'));
    expect(host().querySelector('app-curator-news-report-card')).not.toBeNull();
  });

  it('renders the TV card for TvShowEpisode contentKind', () => {
    render(row('TvShowEpisode'));
    expect(host().querySelector('app-curator-tv-show-episode-card')).not.toBeNull();
  });

  it('renders the podcast episode card by default', () => {
    render(row('Episode'));
    expect(host().querySelector('app-curator-episode-card')).not.toBeNull();
    expect(host().querySelector('app-curator-film-card')).toBeNull();
  });

  it('omits a parent subtitle link on a Film row (a film has no parent)', () => {
    render(row('Film', { podcastName: 'Synthetic Film Name' }));
    expect(parentSubtitleLink()).toBeNull();
  });

  it('links a NewsReport parent subtitle to the news hub', () => {
    render(row('NewsReport', { podcastName: 'Synthetic Desk' }));
    const link = parentSubtitleLink();
    expect(link).toBeTruthy();
    expect(link!.getAttribute('href')).toBe('/news/Synthetic%20Desk');
    expect(link!.textContent?.trim()).toBe('Synthetic Desk');
  });

  it('links a TvShowEpisode parent subtitle to the TV hub', () => {
    render(row('TvShowEpisode', { podcastName: 'Synthetic Nightly' }));
    const link = parentSubtitleLink();
    expect(link).toBeTruthy();
    expect(link!.getAttribute('href')).toBe('/tv/Synthetic%20Nightly');
    expect(link!.textContent?.trim()).toBe('Synthetic Nightly');
  });

  it('links an Episode parent subtitle to the podcast hub', () => {
    render(row('Episode', { podcastName: 'Synthetic Show' }));
    const link = parentSubtitleLink();
    expect(link).toBeTruthy();
    expect(link!.getAttribute('href')).toBe('/podcast/Synthetic%20Show');
    expect(link!.textContent?.trim()).toBe('Synthetic Show');
  });

  it('exposes Edit Podcast / Index Podcast / Delete Episode on Episode when curator+admin flags are set', async () => {
    render(row('Episode', { podcastName: 'Synthetic Show' }), podcastAdminFlags);
    const labels = await openOverflowMenu();
    expect(labels).toContain(playableCuratorActionLabel('Episode', 'Edit'));
    expect(labels).toContain(playableCuratorActionLabel('Episode', 'Post'));
    expect(labels).toContain('Edit Podcast');
    expect(labels).toContain('Index Podcast');
    expect(labels).toContain('Delete Episode');
  });

  for (const kind of ['Film', 'NewsReport', 'TvShowEpisode'] as const) {
    it(`keeps ${kind} overflow free of podcast-only Index / Edit Podcast, and offers Delete for Admin`, async () => {
      render(row(kind), podcastAdminFlags);
      const labels = await openOverflowMenu();
      expect(labels).toContain(playableCuratorActionLabel(kind, 'Edit'));
      expect(labels).toContain(playableCuratorActionLabel(kind, 'Post'));
      expect(labels).toContain(playableCuratorActionLabel(kind, 'Delete'));
      expect(labels).not.toContain('Edit Podcast');
      expect(labels).not.toContain('Index Podcast');
      expect(labels).not.toContain('Delete Episode');
    });
  }
});
