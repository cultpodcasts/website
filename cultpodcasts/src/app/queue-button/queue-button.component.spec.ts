import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { QueueButtonComponent } from './queue-button.component';
import { PlayerService } from '../player.service';
import { SearchDisplayEpisode } from '../search-result-links';

describe('QueueButtonComponent', () => {
  let fixture: ComponentFixture<QueueButtonComponent>;
  const queuedIds = signal<string[]>([]);
  const player = {
    isQueuedId: (id: string | undefined) => !!id && queuedIds().includes(id),
    toggleQueue: vi.fn((episode: SearchDisplayEpisode) => queuedIds.update((ids) =>
      ids.includes(episode.id) ? ids.filter((id) => id !== episode.id) : [...ids, episode.id])),
  };
  const embeddable = {
    id: 'ep-1',
    podcastName: 'Invented Show',
    episodeTitle: 'Invented episode',
    services: { youtube: { url: 'https://www.youtube.com/watch?v=invented1' } },
    ids: { youtube: 'invented1' },
  } as unknown as SearchDisplayEpisode;

  beforeEach(async () => {
    queuedIds.set([]);
    player.toggleQueue.mockClear();
    await TestBed.configureTestingModule({
      imports: [QueueButtonComponent],
      providers: [provideZonelessChangeDetection(), { provide: PlayerService, useValue: player }],
    }).compileComponents();
    fixture = TestBed.createComponent(QueueButtonComponent);
  });

  const button = () => (fixture.nativeElement as HTMLElement).querySelector('button');

  function render(episode: SearchDisplayEpisode): void {
    fixture.componentRef.setInput('episode', episode);
    fixture.detectChanges();
  }

  it('adds and removes an embeddable episode, with the episode page labels and icons', () => {
    render(embeddable);
    // Toggle semantics: the visible text is the name, aria-pressed the state (Label in Name).
    expect(button()!.hasAttribute('aria-label')).toBe(false);
    expect(button()!.getAttribute('aria-pressed')).toBe('false');
    expect(button()!.textContent).toContain('playlist_add');
    expect(button()!.textContent).toContain('Add to Queue');

    button()!.click();
    fixture.detectChanges();
    expect(player.toggleQueue).toHaveBeenCalledWith(embeddable);
    expect(button()!.getAttribute('aria-pressed')).toBe('true');
    expect(button()!.textContent).toContain('playlist_add_check');
    expect(button()!.textContent).toContain('Queued');
    expect(button()!.classList).toContain('is-queued');

    button()!.click();
    fixture.detectChanges();
    expect(button()!.textContent).toContain('Add to Queue');
  });

  it('keeps the square episode-page shape by default and rounds only when asked', () => {
    render(embeddable);
    expect(button()!.classList).not.toContain('queue-button--pill');
    fixture.componentRef.setInput('shape', 'pill');
    fixture.detectChanges();
    expect(button()!.classList).toContain('queue-button--pill');
  });

  it('emits each toggle with the new state and whether it came from a pointer', () => {
    render(embeddable);
    const events: { queued: boolean; pointer: boolean; button: HTMLButtonElement | null }[] = [];
    fixture.componentInstance.toggled.subscribe((e) => events.push(e));

    button()!.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    button()!.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));

    expect(events.map(({ queued, pointer }) => ({ queued, pointer }))).toEqual([
      { queued: true, pointer: true },
      { queued: false, pointer: false },
    ]);
    expect(events[0].button).toBe(button());
  });

  it('does not let the click reach a surrounding link or swipe handler', () => {
    render(embeddable);
    const outer = vi.fn();
    (fixture.nativeElement as HTMLElement).addEventListener('click', outer);
    button()!.click();
    expect(outer).not.toHaveBeenCalled();
  });

  it('renders nothing when the episode cannot be embedded', () => {
    render({ ...embeddable, services: { bbcSounds: { url: 'https://www.bbc.co.uk/sounds/play/m000inv2' } }, ids: undefined } as unknown as SearchDisplayEpisode);
    expect(button()).toBeNull();
    render({ ...embeddable, services: undefined, ids: undefined } as unknown as SearchDisplayEpisode);
    expect(button()).toBeNull();
  });
});
