import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EpisodeLinksComponent } from './episode-links.component';
import { SearchResult } from '../search-result.interface';

function hit(partial: Partial<SearchResult> = {}): SearchResult {
  return {
    id: 'id',
    podcastName: 'Show',
    episodeTitle: 'Title',
    episodeDescription: '',
    release: new Date('2024-01-01T00:00:00Z'),
    duration: '1:30:00',
    ...partial
  };
}

function labels(component: EpisodeLinksComponent): string[] {
  return component.serviceLinks.map((link) => link.displayName);
}

describe('EpisodeLinksComponent identity buttons', () => {
  let fixture: ComponentFixture<EpisodeLinksComponent>;
  let component: EpisodeLinksComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EpisodeLinksComponent]
    }).compileComponents();
    fixture = TestBed.createComponent(EpisodeLinksComponent);
    component = fixture.componentInstance;
  });

  it('appends IMDb and TMDB after streaming services on a film, using official icon names', () => {
    component.episode = hit({
      contentKind: 'Film',
      services: { youtube: { url: 'https://www.youtube.com/watch?v=abc1234' } },
      imdbId: 'tt11280740',
      tmdbId: 123
    });
    const links = component.serviceLinks;
    expect(labels(component)).toEqual(['YouTube', 'IMDb', 'TMDB']);
    expect(links.map((l) => l.icon)).toEqual(['youtube', 'imdb', 'tmdb']);
    expect(links[1].url.href).toBe('https://www.imdb.com/title/tt11280740/');
    expect(links[2].url.href).toBe('https://www.themoviedb.org/movie/123');
  });

  it('on a TV-show hub, shows only series identity buttons when streaming is omitted', () => {
    component.identityKind = 'tv-show';
    component.includeStreaming = false;
    component.showShare = false;
    component.episode = hit({
      contentKind: 'TvShowEpisode',
      services: { youtube: { url: 'https://www.youtube.com/watch?v=abc1234' } },
      seriesImdbId: 'tt1234567',
      seriesTmdbId: 99,
      seriesTvdbId: 1001
    });
    expect(labels(component)).toEqual(['IMDb', 'TMDB', 'TVDB']);
    expect(component.serviceLinks.map((l) => l.icon)).toEqual(['imdb', 'tmdb', 'tvdb']);
    expect(component.serviceLinks[2].url.href).toBe('https://www.thetvdb.com/dereferrer/series/1001');
  });

  it('does not add identity buttons for a podcast episode', () => {
    component.episode = hit({
      services: { youtube: { url: 'https://www.youtube.com/watch?v=abc1234' } },
      imdbId: 'tt11280740'
    });
    expect(labels(component)).toEqual(['YouTube']);
  });
});
