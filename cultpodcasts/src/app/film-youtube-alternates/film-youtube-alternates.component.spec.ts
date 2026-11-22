import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { FilmYouTubeAlternatesComponent } from './film-youtube-alternates.component';
import { PlayerService } from '../player.service';

const filmId = '925e2a11-668f-4dfa-a78d-57dd4de0051f';

describe('FilmYouTubeAlternatesComponent', () => {
  let fixture: ComponentFixture<FilmYouTubeAlternatesComponent>;
  let player: PlayerService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FilmYouTubeAlternatesComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'server' },
        PlayerService,
      ],
    }).compileComponents();
    player = TestBed.inject(PlayerService);
    fixture = TestBed.createComponent(FilmYouTubeAlternatesComponent);
    fixture.componentRef.setInput('itemId', filmId);
    fixture.componentRef.setInput('itemTitle', 'Manic');
  });

  async function render(tokens: readonly string[] | null | undefined): Promise<HTMLElement> {
    fixture.componentRef.setInput('tokens', tokens);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders nothing when there are no tokens', async () => {
    const el = await render([]);
    expect(el.querySelector('app-episode-rail')).toBeNull();
  });

  it('shows each additional YouTube upload as a rail card under Also on YouTube', async () => {
    const el = await render(['GSIPAfDO_ec|2024-03-01|True Crime Fix']);
    expect(el.querySelector('app-episode-rail .rail__title')?.textContent?.trim()).toBe('Also on YouTube');
    const title = el.querySelector('.episode-poster__episode')?.textContent?.trim();
    expect(title).toBe('True Crime Fix');
  });

  it('plays an additional YouTube upload in the site player', async () => {
    const play = vi.spyOn(player, 'play').mockImplementation(() => undefined);
    const el = await render(['GSIPAfDO_ec|2024-03-01|True Crime Fix']);
    const button = el.querySelector('button.episode-poster__cta') as HTMLButtonElement | null;
    expect(button?.textContent?.trim()).toBe('Watch');
    button?.click();
    expect(play).toHaveBeenCalledTimes(1);
    expect(play.mock.calls[0][0].episodeTitle).toBe('True Crime Fix');
    expect(play.mock.calls[0][0].id).toBe(`${filmId}:youtube-alternate:0`);
    expect(play.mock.calls[0][0].podcastName).toBe('Manic');
    expect(play.mock.calls[0][0].services?.['youtube']?.url?.toString()).toBe('https://www.youtube.com/watch?v=GSIPAfDO_ec');
  });
});
