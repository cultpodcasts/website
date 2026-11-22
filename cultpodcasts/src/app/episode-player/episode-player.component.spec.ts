import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { EpisodePlayerComponent } from './episode-player.component';
import { PlayerService } from '../player.service';
import { SearchResult } from '../search-result.interface';

function ep(overrides: Partial<SearchResult> = {}): SearchResult {
  return {
    id: 'ep-1',
    podcastName: 'Show',
    episodeTitle: 'Part',
    episodeDescription: 'Desc',
    release: new Date('2026-01-02T00:00:00Z'),
    duration: '00:10:00',
    youtubeId: 'abc123',
    ...overrides,
  };
}

describe('EpisodePlayerComponent', () => {
  let fixture: ComponentFixture<EpisodePlayerComponent>;
  let player: PlayerService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EpisodePlayerComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'server' },
      ],
    }).compileComponents();

    player = TestBed.inject(PlayerService);
    fixture = TestBed.createComponent(EpisodePlayerComponent);
  });

  function showLink(): HTMLAnchorElement | null {
    return fixture.nativeElement.querySelector('a.stage__show');
  }

  it('hides the parent line when the shell passes no parent', () => {
    player.play(ep({ podcastName: 'Studio', episodeTitle: 'One Off' }), { mode: 'dock' });
    fixture.componentRef.setInput('parentLink', null);
    fixture.detectChanges();
    expect(showLink()).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Studio');
  });

  it('shows the parent link it was given', () => {
    player.play(ep({ podcastName: 'Show' }), { mode: 'dock' });
    fixture.componentRef.setInput('parentLink', ['/podcast', 'Show']);
    fixture.detectChanges();
    expect(showLink()?.getAttribute('href')).toBe('/podcast/Show');
  });

  function episodePageLink(): HTMLAnchorElement | null {
    return [...fixture.nativeElement.querySelectorAll('a')].find((link: HTMLAnchorElement) =>
      link.textContent?.includes('Episode page')
    ) ?? null;
  }

  it('hides the episode page control when the shell has no page', () => {
    player.play(ep({ youtubeId: undefined }), { mode: 'dock' });
    fixture.componentRef.setInput('pageLink', null);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No playable link for this episode.');
    expect(episodePageLink()).toBeNull();
  });

  it('links the empty state to the page the shell was given', () => {
    player.play(ep({ youtubeId: undefined }), { mode: 'dock' });
    fixture.componentRef.setInput('pageLink', ['/film', 'One Off', 'abc']);
    fixture.detectChanges();
    expect(episodePageLink()?.getAttribute('href')).toBe('/film/One%20Off/abc');
  });
});

describe('EpisodePlayerComponent YouTube alternate fallback (RPP #1411)', () => {
  let fixture: ComponentFixture<EpisodePlayerComponent>;
  let player: PlayerService;
  let lastPlayerOptions: { events?: { onError?: () => void } } | undefined;
  const originalYT = (window as unknown as { YT?: unknown }).YT;

  beforeEach(async () => {
    lastPlayerOptions = undefined;
    (window as unknown as { YT: unknown }).YT = {
      Player: class {
        constructor(_id: string, options: { events?: { onError?: () => void } }) {
          lastPlayerOptions = options;
        }
        destroy(): void {}
      },
    };
    await TestBed.configureTestingModule({
      imports: [EpisodePlayerComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    }).compileComponents();

    player = TestBed.inject(PlayerService);
    fixture = TestBed.createComponent(EpisodePlayerComponent);
  });

  afterEach(() => {
    (window as unknown as { YT?: unknown }).YT = originalYT;
  });

  function iframeSrc(): string {
    const iframe = fixture.nativeElement.querySelector('#flix-player-frame') as HTMLIFrameElement | null;
    return iframe?.getAttribute('src') ?? '';
  }

  async function settlePlayer(): Promise<void> {
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 350));
    fixture.detectChanges();
  }

  it('moves the iframe to each alternate on error, stays on the last, and resets when the episode changes', async () => {
    const episode = ep({
      youtubeId: 'PRIMARYID12',
      youTubeAlternates: ['ALTONEID1234|2024-03-01|One', 'ALTTWOID1234|2024-04-01|Two'],
    });
    player.play(episode, { mode: 'dock' });
    await settlePlayer();
    expect(iframeSrc()).toContain('PRIMARYID12');
    expect(lastPlayerOptions?.events?.onError).toBeDefined();

    lastPlayerOptions!.events!.onError!();
    await settlePlayer();
    expect(iframeSrc()).toContain('ALTONEID1234');
    expect(iframeSrc()).not.toContain('PRIMARYID12');

    lastPlayerOptions!.events!.onError!();
    await settlePlayer();
    expect(iframeSrc()).toContain('ALTTWOID1234');
    expect(iframeSrc()).not.toContain('ALTONEID1234');

    const last = iframeSrc();
    lastPlayerOptions!.events!.onError!();
    fixture.detectChanges();
    expect(iframeSrc()).toBe(last);

    player.play(ep({ id: 'ep-2', youtubeId: 'NEWPRIMARY12', youTubeAlternates: ['ALTONEID1234|2024-03-01|One'] }), {
      mode: 'dock',
    });
    await settlePlayer();
    expect(iframeSrc()).toContain('NEWPRIMARY12');
    expect(iframeSrc()).not.toContain('ALTTWOID1234');
  });
});

