import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { FilmTrailerCardComponent } from './film-trailer-card.component';
import { PlayerService } from '../player.service';
import { filmTrailerEpisode, parseFilmTrailerTokens } from '../film-trailer';

describe('FilmTrailerCardComponent', () => {
  let fixture: ComponentFixture<FilmTrailerCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FilmTrailerCardComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'server' },
        PlayerService,
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(FilmTrailerCardComponent);
  });

  function show(token: string): HTMLElement {
    const [link] = parseFilmTrailerTokens([token]);
    fixture.componentRef.setInput('episode', filmTrailerEpisode(link, 'synthetic-film', 0));
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('opens the trailer video from the title in a new tab, not a site route', () => {
    const el = show('00:02:11|https://www.youtube.com/watch?v=synthetic01|Synthetic Teaser');
    const title = el.querySelector('a.episode-poster__titles') as HTMLAnchorElement;

    expect(title.href).toBe('https://www.youtube.com/watch?v=synthetic01');
    expect(title.target).toBe('_blank');
    expect(title.rel).toContain('noopener');
  });

  it('shows a plain Trailer byline with the film icon and no parent link', () => {
    const el = show('00:02:11|https://www.youtube.com/watch?v=synthetic01|Synthetic Teaser');
    const byline = el.querySelector('.episode-poster__byline') as HTMLElement;

    expect(byline.textContent?.replace(/\s+/g, ' ').trim()).toBe('movie Trailer');
    expect(byline.querySelector('a')).toBeNull();
  });

  it('gives an iPlayer trailer an outbound Watch button', () => {
    const el = show('00:01:00|https://www.bbc.co.uk/iplayer/episode/synthetic01|Synthetic iPlayer Clip');

    expect(el.querySelector('button.episode-poster__cta')?.textContent?.trim()).toBe('Watch');
    expect(el.querySelector('button.episode-poster__queue-btn')).toBeNull();
  });
});
