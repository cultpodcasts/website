import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ApiEpisode } from '../api-episode.interface';
import { CuratorPlayableCardComponent } from './curator-playable-card.component';

function row(contentKind?: string): ApiEpisode {
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
  } as ApiEpisode;
}

describe('CuratorPlayableCardComponent', () => {
  let fixture: ComponentFixture<CuratorPlayableCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CuratorPlayableCardComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(CuratorPlayableCardComponent);
  });

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the film card for Film contentKind', () => {
    fixture.componentRef.setInput('episode', row('Film'));
    fixture.detectChanges();
    expect(host().querySelector('app-curator-film-card')).not.toBeNull();
    expect(host().querySelector('app-curator-episode-card')).toBeNull();
  });

  it('renders the news card for NewsReport contentKind', () => {
    fixture.componentRef.setInput('episode', row('NewsReport'));
    fixture.detectChanges();
    expect(host().querySelector('app-curator-news-report-card')).not.toBeNull();
  });

  it('renders the TV card for TvShowEpisode contentKind', () => {
    fixture.componentRef.setInput('episode', row('TvShowEpisode'));
    fixture.detectChanges();
    expect(host().querySelector('app-curator-tv-show-episode-card')).not.toBeNull();
  });

  it('renders the podcast episode card by default', () => {
    fixture.componentRef.setInput('episode', row('Episode'));
    fixture.detectChanges();
    expect(host().querySelector('app-curator-episode-card')).not.toBeNull();
    expect(host().querySelector('app-curator-film-card')).toBeNull();
  });
});
