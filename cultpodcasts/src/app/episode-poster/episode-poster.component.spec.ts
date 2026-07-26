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
    youtube: new URL('https://www.youtube.com/watch?v=a'),
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
    expect(query('.episode-poster__release')).toBeNull();

    fixture.componentRef.setInput('showRelease', true);
    fixture.detectChanges();

    expect(query('.episode-poster__release')?.textContent?.trim()).toBe('3 Nov 2019');
  });

  it('still shows the date on podcast pages where the show name is hidden', () => {
    fixture.componentRef.setInput('showShow', false);
    fixture.componentRef.setInput('showRelease', true);
    fixture.detectChanges();

    expect(query('.episode-poster__show')).toBeNull();
    expect(query('.episode-poster__release')?.textContent?.trim()).toBe('3 Nov 2019');
    expect(query('.episode-poster__byline-dot')).toBeNull();
  });

  it('links the podcast name to that podcast page', () => {
    const show = query('.episode-poster__show') as HTMLAnchorElement | null;
    expect(show?.textContent?.trim()).toBe('Show A');
    expect(show?.getAttribute('href')).toBe('/podcast/Show%20A');
  });

  it('keeps the podcast link outside the episode link so neither anchor nests', () => {
    const title = query('.episode-poster__titles') as HTMLAnchorElement;
    expect(title.getAttribute('href')).toBe('/podcast/Show%20A/a');
    expect(title.querySelector('a')).toBeNull();
  });

  it('omits the byline entirely when there is no show name and no usable date', () => {
    fixture.componentRef.setInput('episode', ep({ release: undefined as unknown as Date }));
    fixture.componentRef.setInput('showShow', false);
    fixture.componentRef.setInput('showRelease', true);
    fixture.detectChanges();

    expect(query('.episode-poster__byline')).toBeNull();
  });
});
