import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { HomepageHeroComponent } from './homepage-hero.component';
import { HomepageEpisode } from '../homepage-episode.interface';
import { PlayerService } from '../player.service';

function ep(id: string): HomepageEpisode {
  return {
    id,
    podcastName: `Show ${id}`,
    episodeTitle: `Episode ${id}`,
    episodeDescription: `Desc ${id}`,
    release: new Date(),
    duration: '01:00:00',
    spotify: undefined,
    apple: undefined,
    youtube: new URL(`https://www.youtube.com/watch?v=${id}`),
    bbc: undefined,
    internetArchive: undefined,
    subjects: [`Subject ${id}`],
    image: new URL(`https://img.example/${id}.jpg`),
  };
}

describe('HomepageHeroComponent', () => {
  let fixture: ComponentFixture<HomepageHeroComponent>;
  let component: HomepageHeroComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomepageHeroComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: PlayerService, useValue: { episode: () => undefined, play: () => undefined } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HomepageHeroComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('slides', [ep('a'), ep('b'), ep('c')]);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
    component['stopHeroCycle']();
  });

  it('starts on the first slide', () => {
    expect(component['heroIndex']()).toBe(0);
    expect(component['featured']()?.id).toBe('a');
  });

  it('jumps to a slide when its hero dash is clicked', () => {
    component['reduceMotion'] = true;
    fixture.detectChanges();
    const dots = fixture.nativeElement.querySelectorAll(
      'button.billboard__dot'
    ) as NodeListOf<HTMLButtonElement>;
    expect(dots.length).toBe(3);

    dots[2].click();
    fixture.detectChanges();

    expect(component['heroIndex']()).toBe(2);
    expect(component['featured']()?.id).toBe('c');
  });

  it('advances when the next chevron is clicked without cancelling the content transition', () => {
    vi.useFakeTimers();
    component['reduceMotion'] = false;
    component['heroIndex'].set(0);
    component['lastFeaturedId'] = 'a';
    fixture.detectChanges();

    const next = fixture.nativeElement.querySelector(
      'button.billboard__nav--next'
    ) as HTMLButtonElement;
    next.click();

    // Bug regression: restartHeroCycle used to clear heroContentTimer and leave index at 0.
    expect(component['heroIndex']()).toBe(0);
    vi.advanceTimersByTime(320);
    expect(component['heroIndex']()).toBe(1);
    expect(component['featured']()?.id).toBe('b');
  });

  it('goes to the previous slide when the prev chevron is clicked', () => {
    vi.useFakeTimers();
    component['reduceMotion'] = false;
    component['heroIndex'].set(1);
    component['lastFeaturedId'] = 'b';
    fixture.detectChanges();

    const prev = fixture.nativeElement.querySelector(
      'button.billboard__nav--prev'
    ) as HTMLButtonElement;
    prev.click();
    vi.advanceTimersByTime(320);

    expect(component['heroIndex']()).toBe(0);
    expect(component['featured']()?.id).toBe('a');
  });

  it('releases chevron focus so the dash timer can run again after navigation', () => {
    vi.useFakeTimers();
    component['reduceMotion'] = false;
    component['heroImageReady'].set(true);
    component['pointerInside'] = false;
    component['focusInside'] = false;
    component['syncHeroPaused']();
    fixture.detectChanges();

    const next = fixture.nativeElement.querySelector(
      'button.billboard__nav--next'
    ) as HTMLButtonElement;
    next.focus();
    component.onHeroFocusIn();
    expect(component['heroPaused']()).toBe(true);

    next.click();
    vi.advanceTimersByTime(320);
    // Cached/missing image gate may still be open in tests; the dwell fill only
    // requires ready + not paused once the slide has settled.
    component['heroImageReady'].set(true);
    fixture.detectChanges();

    expect(document.activeElement === next).toBe(false);
    expect(component['focusInside']).toBe(false);
    expect(component['heroPaused']()).toBe(false);

    const activeFill = fixture.nativeElement.querySelector(
      'button.billboard__dot.is-active .billboard__dot-fill'
    ) as HTMLElement;
    expect(activeFill.classList.contains('is-running')).toBe(true);
  });

  it('keeps the dwell paused while the pointer remains over the billboard after a chevron click', () => {
    component['pointerInside'] = true;
    component['focusInside'] = false;
    component['syncHeroPaused']();
    expect(component['heroPaused']()).toBe(true);

    const next = fixture.nativeElement.querySelector(
      'button.billboard__nav--next'
    ) as HTMLButtonElement;
    next.focus();
    component.onHeroFocusIn();
    next.click();

    expect(component['pointerInside']).toBe(true);
    expect(component['heroPaused']()).toBe(true);
  });

  it('keeps the featured episode when slides refresh with the same id', () => {
    component['heroIndex'].set(2);
    component['lastFeaturedId'] = 'c';
    fixture.detectChanges();
    expect(component['featured']()?.id).toBe('c');

    fixture.componentRef.setInput('slides', [ep('x'), ep('c'), ep('y')]);
    fixture.detectChanges();

    expect(component['featured']()?.id).toBe('c');
  });

  it('does not rebuild image layers when slides refresh with an unchanged sequence', () => {
    component['heroImageReady'].set(true);

    fixture.componentRef.setInput('slides', [ep('a'), ep('b'), ep('c')]);
    fixture.detectChanges();

    expect(component['heroIndex']()).toBe(0);
    expect(component['heroImageReady']()).toBe(true);
  });

  it('emits removeFeatured with the active slide id', () => {
    const removed: string[] = [];
    component.removeFeatured.subscribe((id) => removed.push(id));
    fixture.componentRef.setInput('isCurator', true);
    fixture.componentRef.setInput('curatedEpisodeIds', ['a']);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button.billboard__curate') as HTMLButtonElement | null;
    expect(button).toBeTruthy();
    button?.click();
    expect(removed).toEqual(['a']);
  });

  it('emits manageHero / manageRails from curator controls', () => {
    const managed: string[] = [];
    component.manageHero.subscribe(() => managed.push('hero'));
    component.manageRails.subscribe(() => managed.push('rails'));
    fixture.componentRef.setInput('isCurator', true);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button.billboard__manage') as NodeListOf<HTMLButtonElement>;
    expect(buttons.length).toBe(2);
    buttons[0].click();
    buttons[1].click();
    expect(managed).toEqual(['hero', 'rails']);
  });

  it('image gate stays blocked until the fallback timeout when decode never completes', () => {
    vi.useFakeTimers();
    const originalImage = globalThis.Image;
    class StuckImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      complete = false;
      decode = undefined;
      set src(_value: string) {
        /* never completes */
      }
    }
    globalThis.Image = StuckImage as unknown as typeof Image;

    try {
      component['heroImageReady'].set(false);
      component['beginHeroImageGate']();
      expect(component['heroImageReady']()).toBe(false);
      // A slow-but-working backdrop must still gate the dwell timer.
      vi.advanceTimersByTime(7500);
      expect(component['heroImageReady']()).toBe(false);
      vi.advanceTimersByTime(4500);
      expect(component['heroImageReady']()).toBe(true);
    } finally {
      globalThis.Image = originalImage;
    }
  });

  it('crossfade flips the front layer onto the incoming stage', () => {
    vi.useFakeTimers();
    component['reduceMotion'] = false;
    component['heroFrontLayer'].set('a');
    component['heroIndex'].set(0);
    component['lastFeaturedId'] = 'a';
    component['transitionTo'](1);

    vi.advanceTimersByTime(320);
    expect(component['heroIndex']()).toBe(1);
    expect(component['heroLayerB']()).toContain('b.jpg');
  });

  it('reduce-motion jumps index immediately without starting the cycle timer', () => {
    component['reduceMotion'] = true;
    component['stopHeroCycle']();
    component['heroIndex'].set(0);
    component['transitionTo'](2);
    expect(component['heroIndex']()).toBe(2);
    expect(component['heroTimer']).toBeUndefined();
  });

  it('auto-advances after the dwell interval when not paused and image-ready', () => {
    vi.useFakeTimers();
    component['reduceMotion'] = false;
    component['heroPaused'].set(false);
    component['heroImageReady'].set(true);
    component['heroIndex'].set(0);
    component['lastFeaturedId'] = 'a';
    component['startHeroCycle']();

    vi.advanceTimersByTime(7500 + 250);
    vi.advanceTimersByTime(320);
    expect(component['heroIndex']()).toBe(1);
  });

  it('does not auto-advance while paused', () => {
    vi.useFakeTimers();
    component['reduceMotion'] = false;
    component['heroPaused'].set(true);
    component['heroImageReady'].set(true);
    component['heroIndex'].set(0);
    component['startHeroCycle']();

    vi.advanceTimersByTime(7500 + 500);
    expect(component['heroIndex']()).toBe(0);
  });
});
