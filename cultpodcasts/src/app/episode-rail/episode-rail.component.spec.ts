import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { EpisodeRailComponent } from './episode-rail.component';
import { SearchDisplayEpisode } from '../search-result-links';
import { PlayerService } from '../player.service';

function ep(id: string, playable = false): SearchDisplayEpisode {
  return {
    id,
    podcastName: `Show ${id}`,
    episodeTitle: `Episode ${id}`,
    episodeDescription: `Desc ${id}`,
    release: new Date(),
    duration: '01:00:00',
    subjects: [`Subject ${id}`],
    youtube: playable ? new URL(`https://www.youtube.com/watch?v=${id}`) : undefined,
  };
}

describe('EpisodeRailComponent', () => {
  let fixture: ComponentFixture<EpisodeRailComponent>;
  let component: EpisodeRailComponent;
  let player: PlayerService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EpisodeRailComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'server' },
        PlayerService,
      ],
    }).compileComponents();

    player = TestBed.inject(PlayerService);
    fixture = TestBed.createComponent(EpisodeRailComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('title', 'Tuesday 1 January');
    fixture.componentRef.setInput('episodes', [ep('a', true), ep('b', true)]);
    fixture.detectChanges();
  });

  it('renders a plain heading when titleLink is absent', () => {
    const heading = fixture.nativeElement.querySelector('h2.rail__title');
    expect(heading?.textContent?.trim()).toBe('Tuesday 1 January');
    expect(fixture.nativeElement.querySelector('a.rail__title--link')).toBeNull();
  });

  it('renders a linked title and browse-all when titleLink / browseAllLink are set', () => {
    fixture.componentRef.setInput('title', 'Scientology');
    fixture.componentRef.setInput('subject', 'Scientology');
    fixture.componentRef.setInput('titleLink', ['/subject', 'Scientology']);
    fixture.componentRef.setInput('browseAllLink', ['/subject', 'Scientology']);
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('a.rail__title--link') as HTMLAnchorElement | null;
    expect(link?.textContent).toContain('Scientology');
    expect(fixture.nativeElement.querySelector('a.rail__see-all')?.textContent?.trim()).toBe('Browse all');
  });

  it('emits pinToggle for the subject when the pin control is clicked', () => {
    const pins: string[] = [];
    component.pinToggle.subscribe((subject) => pins.push(subject));

    fixture.componentRef.setInput('title', 'Scientology');
    fixture.componentRef.setInput('subject', 'Scientology');
    fixture.componentRef.setInput('titleLink', ['/subject', 'Scientology']);
    fixture.componentRef.setInput('showPin', true);
    fixture.detectChanges();

    const pin = fixture.nativeElement.querySelector('button.rail__pin') as HTMLButtonElement;
    pin.click();
    expect(pins).toEqual(['Scientology']);
  });

  it('marks posters as promoted from promotedIds', () => {
    fixture.componentRef.setInput('showPromote', true);
    fixture.componentRef.setInput('promotedIds', new Set(['a']));
    fixture.detectChanges();

    const posters = fixture.nativeElement.querySelectorAll('app-episode-poster');
    expect(posters.length).toBe(2);
    expect(posters[0].classList.contains('episode-poster')).toBe(true);
  });

  it('emits promoteToggle when a poster star is clicked', () => {
    const promoted: string[] = [];
    component.promoteToggle.subscribe((episode) => promoted.push(episode.id));
    fixture.componentRef.setInput('showPromote', true);
    fixture.detectChanges();

    const star = fixture.nativeElement.querySelector(
      'button.episode-poster__promote'
    ) as HTMLButtonElement | null;
    expect(star).toBeTruthy();
    star?.click();
    expect(promoted).toEqual(['a']);
  });

  it('emits play when a poster play control is clicked', () => {
    const played: string[] = [];
    component.play.subscribe((episode) => played.push(episode.id));
    fixture.detectChanges();

    const play = fixture.nativeElement.querySelector(
      'button.episode-poster__cta'
    ) as HTMLButtonElement | null;
    expect(play).toBeTruthy();
    play?.click();
    expect(played).toEqual(['a']);
  });

  it('applies display-title styling when displayTitle is set', () => {
    fixture.componentRef.setInput('displayTitle', true);
    fixture.detectChanges();
    const section = fixture.nativeElement.querySelector('section.rail') as HTMLElement;
    expect(section.classList.contains('rail--display-title')).toBe(true);
  });

  it('marks the playing poster from playingEpisodeId', () => {
    fixture.componentRef.setInput('playingEpisodeId', 'b');
    fixture.detectChanges();
    const posters = fixture.nativeElement.querySelectorAll('app-episode-poster');
    expect(posters[1].classList.contains('episode-poster--playing')).toBe(true);
    expect(posters[0].classList.contains('episode-poster--playing')).toBe(false);
  });

  it('passes queue membership from PlayerService.queuedKeys', () => {
    player.addToQueue(ep('b', true));
    fixture.detectChanges();
    expect(component['isQueued']('b')).toBe(true);
    expect(component['isQueued']('a')).toBe(false);
  });
});
