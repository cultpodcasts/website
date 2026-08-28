import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideZonelessChangeDetection } from '@angular/core';
import { EpisodePosterComponent } from './episode-poster.component';
import { SearchDisplayEpisode } from '../search-result-links';
import { PlayerService } from '../player.service';

function ep(overrides: Partial<SearchDisplayEpisode> = {}): SearchDisplayEpisode {
  return {
    id: 'a',
    podcastName: 'Show A',
    episodeTitle: 'Episode A',
    episodeDescription: 'Desc A',
    release: new Date('2019-11-03T12:00:00Z'),
    duration: '01:00:00',
    subjects: ['Subject A'],
    services: { youtube: { url: 'https://www.youtube.com/watch?v=a' } },
    ids: { youtube: 'a' },
    ...overrides,
  } as SearchDisplayEpisode;
}

describe('EpisodePosterComponent', () => {
  let fixture: ComponentFixture<EpisodePosterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EpisodePosterComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        PlayerService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EpisodePosterComponent);
    fixture.componentRef.setInput('episode', ep());
    fixture.detectChanges();
  });

  function query(selector: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(selector);
  }

  it('hides the publication date unless showRelease is set', () => {
    expect(query('.episode-poster__badge--release')).toBeNull();

    fixture.componentRef.setInput('showRelease', true);
    fixture.detectChanges();

    expect(query('.episode-poster__badge--release')?.textContent?.trim()).toBe('3 Nov 2019');
  });

  it('places the date on the action row before duration, not beside the podcast name', () => {
    fixture.componentRef.setInput('showRelease', true);
    fixture.detectChanges();

    const badges = query('.episode-poster__meta-badges');
    const release = badges?.querySelector('.episode-poster__badge--release');
    const duration = badges?.querySelector('.episode-poster__badge--duration');
    expect(release?.textContent?.trim()).toBe('3 Nov 2019');
    expect(duration?.textContent?.trim()).toBe('1:00:00');
    expect(release?.nextElementSibling).toBe(duration);
    expect(query('.episode-poster__byline')?.textContent?.trim()).toBe('Show A');
  });

  it('still shows the date on podcast pages where the show name is hidden', () => {
    fixture.componentRef.setInput('showShow', false);
    fixture.componentRef.setInput('showRelease', true);
    fixture.detectChanges();

    expect(query('.episode-poster__show')).toBeNull();
    expect(query('.episode-poster__byline')).toBeNull();
    expect(query('.episode-poster__badge--release')?.textContent?.trim()).toBe('3 Nov 2019');
  });

  it('links the podcast name to that podcast page', () => {
    const show = query('.episode-poster__show') as HTMLAnchorElement | null;
    expect(show?.textContent?.trim()).toBe('Show A');
    expect(show?.getAttribute('href')).toBe('/podcast/Show%20A');
  });

  it('keeps the podcast link after the title with its own flex order so title hover cannot cover it', () => {
    const show = query('.episode-poster__show') as HTMLAnchorElement;
    const title = query('.episode-poster__titles') as HTMLAnchorElement;
    const byline = query('.episode-poster__byline') as HTMLElement;

    expect(title.getAttribute('href')).toBe('/podcast/Show%20A/a');
    expect(title.querySelector('a')).toBeNull();
    expect(title.contains(show)).toBe(false);
    expect(getComputedStyle(title).order).toBe('1');
    expect(getComputedStyle(byline).order).toBe('2');
  });

  it('omits the byline entirely when the show name is hidden', () => {
    fixture.componentRef.setInput('showShow', false);
    fixture.componentRef.setInput('showRelease', true);
    fixture.detectChanges();

    expect(query('.episode-poster__byline')).toBeNull();
  });
});
