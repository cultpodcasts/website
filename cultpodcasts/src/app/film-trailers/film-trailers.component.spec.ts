import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { FilmTrailersComponent } from './film-trailers.component';
import { PlayerService } from '../player.service';

const filmId = '00112233-4455-4677-8899-aabbccddeeff';

describe('FilmTrailersComponent', () => {
  let fixture: ComponentFixture<FilmTrailersComponent>;
  let player: PlayerService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FilmTrailersComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'server' },
        PlayerService,
      ],
    }).compileComponents();
    player = TestBed.inject(PlayerService);
    fixture = TestBed.createComponent(FilmTrailersComponent);
    fixture.componentRef.setInput('filmId', filmId);
    fixture.componentRef.setInput('filmTitle', 'One Off');
  });

  async function render(trailers: readonly string[] | null | undefined): Promise<HTMLElement> {
    fixture.componentRef.setInput('trailers', trailers);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows each trailer as a rail card, in order, under a Trailers heading', async () => {
    const el = await render([
      '00:02:11|https://www.youtube.com/watch?v=synthetic01|Synthetic Teaser',
      '00:00:45|https://archive.org/details/synthetic-clip|Synthetic Clip',
    ]);

    expect(el.querySelector('app-episode-rail .rail__title')?.textContent?.trim()).toBe('Trailers');
    const cards = Array.from(el.querySelectorAll('app-film-trailer-card'));
    expect(cards.length).toBe(2);
    const titles = cards.map(card => card.querySelector('.episode-poster__episode')?.textContent?.trim());
    expect(titles).toEqual(['Synthetic Teaser', 'Synthetic Clip']);
  });

  it('gives a YouTube trailer its thumbnail, duration and Watch button', async () => {
    const el = await render(['00:02:11|https://www.youtube.com/watch?v=synthetic01|Synthetic Teaser']);
    const card = el.querySelector('app-film-trailer-card') as HTMLElement;

    expect(card.querySelector('img')?.getAttribute('src')).toBe('https://i.ytimg.com/vi/synthetic01/hqdefault.jpg');
    expect(card.querySelector('.episode-poster__badge--duration')?.textContent?.trim()).toBe('0:02:11');
    expect(card.querySelector('button.episode-poster__cta')?.textContent?.trim()).toBe('Watch');
    const byline = card.querySelector('.episode-poster__byline');
    expect(byline?.textContent?.trim()).toContain('Trailer');
    expect(byline?.textContent).not.toContain('One Off');
    expect(byline?.querySelector('a')).toBeNull();
  });

  it('plays a YouTube trailer in the site player', async () => {
    const play = vi.spyOn(player, 'play').mockImplementation(() => undefined);
    const el = await render(['00:02:11|https://www.youtube.com/watch?v=synthetic01|Synthetic Teaser']);

    (el.querySelector('button.episode-poster__cta') as HTMLButtonElement).click();

    expect(play).toHaveBeenCalledTimes(1);
    expect(play.mock.calls[0][0].episodeTitle).toBe('Synthetic Teaser');
    expect(play.mock.calls[0][0].id).toBe(`${filmId}:trailer:0`);
    expect(play.mock.calls[0][0].podcastName).toBe('One Off');
    expect(play.mock.calls[0][0].services?.['youtube']?.url?.toString()).toBe('https://www.youtube.com/watch?v=synthetic01');
  });

  it('links a trailer the site cannot play to its page, with a placeholder image', async () => {
    const el = await render(['00:01:00|https://synthetic-video.example/watch/1|Synthetic Elsewhere']);
    const card = el.querySelector('app-film-trailer-card') as HTMLElement;

    expect(card.querySelector('button.episode-poster__cta')).toBeNull();
    expect(card.querySelector('.episode-poster__placeholder')).toBeTruthy();
    const art = card.querySelector('a.episode-poster__art') as HTMLAnchorElement;
    expect(art.getAttribute('aria-hidden')).toBe('true');
    expect(art.getAttribute('tabindex')).toBe('-1');
    expect(art.target).toBe('_blank');
    expect(art.rel).toContain('noopener');
    expect(art.rel).toContain('noreferrer');
    const title = card.querySelector('a.episode-poster__titles') as HTMLAnchorElement;
    expect(title.href).toBe('https://synthetic-video.example/watch/1');
    expect(title.target).toBe('_blank');
    expect(title.rel).toContain('noopener');
    expect(title.rel).toContain('noreferrer');
    expect(title.textContent?.replace(/\s+/g, ' ').trim()).toBe('Synthetic Elsewhere (opens in a new tab)');
  });

  it('renders nothing when the film has no trailers', async () => {
    const el = await render(undefined);
    expect(el.querySelector('app-episode-rail')).toBeNull();

    const none = await render(['malformed']);
    expect(none.querySelector('app-episode-rail')).toBeNull();
  });
});
