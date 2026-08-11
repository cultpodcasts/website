import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HomepageHeroComponent } from './homepage-hero.component';
import { HomepageEpisode } from '../homepage-episode.interface';
import { PlayerService } from '../player.service';

const heroDir = dirname(fileURLToPath(import.meta.url));
const heroSass = readFileSync(join(heroDir, 'homepage-hero.component.sass'), 'utf8');

function ep(id: string, overrides: Partial<HomepageEpisode> = {}): HomepageEpisode {
  return {
    id,
    podcastName: `Show ${id}`,
    episodeTitle: `Episode ${id}`,
    episodeDescription: `Desc ${id}`,
    release: new Date('2026-07-31T12:00:00Z'),
    duration: '01:00:00',
    spotify: undefined,
    apple: undefined,
    youtube: new URL(`https://www.youtube.com/watch?v=${id}`),
    bbc: undefined,
    internetArchive: undefined,
    subjects: [`Subject ${id}`],
    image: new URL(`https://img.example/${id}.jpg`),
    ...overrides,
  };
}

/** Image that is already decoded when `src` is assigned (cache hit). */
class ImmediateImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  complete = false;
  decode = undefined;
  fetchPriority = '';
  decoding = '';
  set src(_value: string) {
    this.complete = true;
  }
}

function pointerEvent(
  type: string,
  init: PointerEventInit & {
    target?: EventTarget | null;
    currentTarget?: EventTarget | null;
  }
): PointerEvent {
  const { target, currentTarget, ...rest } = init;
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    ...rest,
  });
  if (target) {
    Object.defineProperty(event, 'target', { configurable: true, value: target });
  }
  if (currentTarget) {
    Object.defineProperty(event, 'currentTarget', { configurable: true, value: currentTarget });
  }
  return event;
}

describe('HomepageHeroComponent', () => {
  let fixture: ComponentFixture<HomepageHeroComponent>;
  let component: HomepageHeroComponent;
  let originalImage: typeof Image;

  beforeEach(async () => {
    originalImage = globalThis.Image;
    globalThis.Image = ImmediateImage as unknown as typeof Image;

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
    globalThis.Image = originalImage;
    component['stopHeroCycle']();
  });

  it('starts on the first slide', () => {
    expect(component['heroIndex']()).toBe(0);
    expect(component['featured']()?.id).toBe('a');
  });

  it('keeps Now featuring above a podcast pill, then date and duration in the meta line', () => {
    const root = fixture.nativeElement as HTMLElement;
    const eyebrow = root.querySelector('.billboard__eyebrow');
    const pill = root.querySelector('a.hero-pill') as HTMLAnchorElement | null;
    const title = root.querySelector('h1.billboard__title');
    const meta = root.querySelector('.hero-meta');
    expect(eyebrow).toBeTruthy();
    expect(pill).toBeTruthy();
    expect(title).toBeTruthy();
    expect(meta).toBeTruthy();

    const metaText = meta!.textContent?.replace(/\s+/g, ' ').trim();

    expect(eyebrow!.textContent?.replace(/\s+/g, ' ').trim()).toBe('Now featuring');
    expect(pill!.textContent?.trim()).toBe('Show a');
    expect(pill!.getAttribute('href')).toBe('/podcast/Show%20a');
    expect(title!.textContent?.trim()).toBe('Episode a');
    expect(metaText).toContain('31 Jul 2026');
    expect(metaText).toContain('1:00:00');
    expect(meta!.querySelector('a')).toBeNull();
    expect(eyebrow!.compareDocumentPosition(pill!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(pill!.compareDocumentPosition(title!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(title!.compareDocumentPosition(meta!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('omits the release date from the meta line when the slide has no usable release', () => {
    fixture.componentRef.setInput('slides', [
      ep('a', { release: new Date('not-a-date') }),
      ep('b'),
      ep('c'),
    ]);
    fixture.detectChanges();

    const meta = fixture.nativeElement.querySelector('.hero-meta') as HTMLElement;
    expect(meta.querySelector('.hero-meta__dot')).toBeNull();
    expect(meta.textContent?.replace(/\s+/g, ' ').trim()).toBe('1:00:00');
  });

  it('HERO-SUB-001: shows every public subject chip without capping count', () => {
    const many = Array.from({ length: 12 }, (_, i) => `Topic ${i + 1}`);
    fixture.componentRef.setInput('slides', [
      ep('a', { subjects: ['_internal', ...many] }),
      ep('b'),
      ep('c'),
    ]);
    fixture.detectChanges();

    expect(component['featuredSubjects']()).toEqual(many);
    const chips = fixture.nativeElement.querySelectorAll(
      '.billboard__subjects app-subject-chip'
    );
    expect(chips.length).toBe(12);
  });

  it('HERO-SUB-002: keeps Watch/More info actions below the subject chips', () => {
    const many = Array.from({ length: 8 }, (_, i) => `Topic ${i + 1}`);
    fixture.componentRef.setInput('slides', [
      ep('a', { subjects: many }),
      ep('b'),
      ep('c'),
    ]);
    fixture.detectChanges();

    const subjects = fixture.nativeElement.querySelector('.billboard__subjects') as HTMLElement;
    const actions = fixture.nativeElement.querySelector('.billboard__actions') as HTMLElement;
    expect(subjects).toBeTruthy();
    expect(actions).toBeTruthy();
    expect(subjects.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('HERO-SCR-004: omits description and reserved copy-body height when there is no description', () => {
    fixture.componentRef.setInput('slides', [
      ep('a', { episodeDescription: '', subjects: [] }),
      ep('b'),
      ep('c'),
    ]);
    fixture.detectChanges();

    expect(component['hasFeaturedDesc']()).toBe(false);
    expect(component['hasCopyBody']()).toBe(false);
    expect(fixture.nativeElement.querySelector('.billboard__desc')).toBeNull();
    expect(fixture.nativeElement.querySelector('.billboard__copy-body')).toBeNull();
    expect(fixture.nativeElement.querySelector('.billboard__actions')).toBeTruthy();
  });

  it('HERO-SCR-004: marks copy-body has-desc only when description text is present', () => {
    fixture.componentRef.setInput('slides', [
      ep('a', { episodeDescription: 'Hello world', subjects: [] }),
      ep('b', { episodeDescription: '', subjects: ['Topic'] }),
      ep('c'),
    ]);
    fixture.detectChanges();

    const withDesc = fixture.nativeElement.querySelector(
      '.billboard__copy-body.has-desc .billboard__desc'
    ) as HTMLElement | null;
    expect(withDesc?.textContent?.trim()).toBe('Hello world');

    component['reduceMotion'] = true;
    component['transitionTo'](1);
    fixture.detectChanges();

    const body = fixture.nativeElement.querySelector('.billboard__copy-body') as HTMLElement;
    expect(body).toBeTruthy();
    expect(body.classList.contains('has-desc')).toBe(false);
    expect(fixture.nativeElement.querySelector('.billboard__desc')).toBeNull();
    expect(fixture.nativeElement.querySelector('.billboard__subjects')).toBeTruthy();
  });

  it('HERO-SCR-001/002/005 + HERO-CTL-001/003/004 + HERO-SWP-001: Sass keeps scroll-stability and hit-target contracts', () => {
    // Layout bugs often land in CSS; assert the source contracts stay present.
    expect(heroSass).toMatch(/\.billboard[\s\S]*?overflow-anchor:\s*none/);
    expect(heroSass).toMatch(/\.billboard__dots-viewport[\s\S]*?overflow-anchor:\s*none/);
    expect(heroSass).toMatch(/\.billboard__title[\s\S]*?line-clamp:\s*3/);
    expect(heroSass).toMatch(/\.billboard__desc[\s\S]*?line-clamp:\s*3/);
    expect(heroSass).toMatch(/\.billboard__desc[\s\S]*?min-height:\s*calc\(1\.45em \* 3\)/);
    expect(heroSass).toMatch(/\.billboard__copy-body[\s\S]*?&\.has-desc[\s\S]*?min-height:\s*calc\(1\.45em \* 3/);
    expect(heroSass).toMatch(/\.billboard__stages,[\s\S]*?pointer-events:\s*none/);
    expect(heroSass).toMatch(/\.billboard[\s\S]*?touch-action:\s*pan-y/);
    // HERO-CTL-003: dedicated art hover layer (not whole-billboard mouseenter).
    expect(heroSass).toMatch(/\.billboard__art-hover[\s\S]*?pointer-events:\s*auto/);
    // HERO-CTL-004 / HERO-SCR-006: stacked medium docks controls + copy over the art.
    expect(heroSass).toMatch(
      /@media screen and \(max-width:\s*1280px\) and \(min-width:\s*701px\) and \(min-height:\s*600px\)[\s\S]*?\.billboard__controls[\s\S]*?position:\s*absolute/
    );
    expect(heroSass).toMatch(
      /@media screen and \(max-width:\s*1280px\) and \(min-width:\s*701px\) and \(min-height:\s*600px\)[\s\S]*?\.billboard__content[\s\S]*?position:\s*absolute/
    );

    // HERO-SCR-005: short titles must not reserve empty lines on stacked layouts.
    expect(heroSass).not.toMatch(/\.billboard__title\s*\n[ \t]+min-height:\s*calc\(1\.12em \* 3\)/);
    expect(heroSass).not.toMatch(/\.billboard__title[^\n]*\{[^}]*min-height:\s*calc\(1\.12em \* 3\)/);

    const subjectsStart = heroSass.indexOf('.billboard__subjects');
    expect(subjectsStart).toBeGreaterThanOrEqual(0);
    const subjectsSlice = heroSass.slice(subjectsStart, subjectsStart + 400);
    expect(subjectsSlice).toMatch(/flex-wrap:\s*wrap/);
    expect(subjectsSlice).not.toMatch(/overflow:\s*hidden/);
    expect(subjectsSlice).not.toMatch(/max-height:/);
    expect(subjectsSlice).not.toMatch(/line-clamp:/);
  });

  it('truncates featured description for the hero copy panel', () => {
    const long = 'x'.repeat(300);
    fixture.componentRef.setInput('slides', [ep('a', { episodeDescription: long }), ep('b'), ep('c')]);
    fixture.detectChanges();

    const desc = component['featuredDesc']();
    expect(desc.length).toBeLessThan(long.length);
    expect(desc.endsWith('…')).toBe(true);
    expect(desc.startsWith('x'.repeat(220).trim())).toBe(true);
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

  it('HERO-LIF-002: advances when the next chevron is clicked without cancelling the content transition', () => {
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
    vi.advanceTimersByTime(450 + 550);
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
    vi.advanceTimersByTime(450 + 550);

    expect(component['heroIndex']()).toBe(0);
    expect(component['featured']()?.id).toBe('a');
  });

  it('HERO-SWP-001: touch swipe left advances and swipe right goes previous', () => {
    component['reduceMotion'] = true;
    component['heroIndex'].set(1);
    component['lastFeaturedId'] = 'b';
    fixture.detectChanges();

    const billboard = fixture.nativeElement.querySelector('.billboard') as HTMLElement;

    component.onHeroSwipeDown(
      pointerEvent('pointerdown', {
        pointerId: 1,
        pointerType: 'touch',
        clientX: 200,
        clientY: 100,
        target: billboard,
        currentTarget: billboard,
      })
    );
    component.onHeroSwipeMove(
      pointerEvent('pointermove', {
        pointerId: 1,
        pointerType: 'touch',
        clientX: 140,
        clientY: 100,
        currentTarget: billboard,
      })
    );
    component.onHeroSwipeUp(
      pointerEvent('pointerup', {
        pointerId: 1,
        pointerType: 'touch',
        clientX: 140,
        clientY: 100,
        currentTarget: billboard,
      })
    );
    expect(component['heroIndex']()).toBe(2);

    component.onHeroSwipeDown(
      pointerEvent('pointerdown', {
        pointerId: 2,
        pointerType: 'touch',
        clientX: 100,
        clientY: 100,
        target: billboard,
        currentTarget: billboard,
      })
    );
    component.onHeroSwipeMove(
      pointerEvent('pointermove', {
        pointerId: 2,
        pointerType: 'touch',
        clientX: 160,
        clientY: 100,
        currentTarget: billboard,
      })
    );
    component.onHeroSwipeUp(
      pointerEvent('pointerup', {
        pointerId: 2,
        pointerType: 'touch',
        clientX: 160,
        clientY: 100,
        currentTarget: billboard,
      })
    );
    expect(component['heroIndex']()).toBe(1);
  });

  it('HERO-CTL-002: touch swipe that starts on a control does not change the slide', () => {
    component['reduceMotion'] = true;
    component['heroIndex'].set(0);
    fixture.detectChanges();

    const next = fixture.nativeElement.querySelector(
      'button.billboard__nav--next'
    ) as HTMLButtonElement;
    const billboard = fixture.nativeElement.querySelector('.billboard') as HTMLElement;

    component.onHeroSwipeDown(
      pointerEvent('pointerdown', {
        pointerId: 3,
        pointerType: 'touch',
        clientX: 200,
        clientY: 100,
        target: next,
        currentTarget: billboard,
      })
    );
    component.onHeroSwipeMove(
      pointerEvent('pointermove', {
        pointerId: 3,
        pointerType: 'touch',
        clientX: 100,
        clientY: 100,
        currentTarget: billboard,
      })
    );
    component.onHeroSwipeUp(
      pointerEvent('pointerup', {
        pointerId: 3,
        pointerType: 'touch',
        clientX: 100,
        clientY: 100,
        currentTarget: billboard,
      })
    );

    expect(component['heroIndex']()).toBe(0);
    expect(component['swipePointerId']).toBeNull();
  });

  it('HERO-SWP-001: mouse pointer swipes do not change the slide', () => {
    component['reduceMotion'] = true;
    component['heroIndex'].set(0);
    fixture.detectChanges();

    const billboard = fixture.nativeElement.querySelector('.billboard') as HTMLElement;
    component.onHeroSwipeDown(
      pointerEvent('pointerdown', {
        pointerId: 4,
        pointerType: 'mouse',
        button: 0,
        clientX: 200,
        clientY: 100,
        target: billboard,
        currentTarget: billboard,
      })
    );
    expect(component['swipePointerId']).toBeNull();
    expect(component['heroIndex']()).toBe(0);
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

  it('keeps the dwell paused while the pointer remains over the art after a chevron click', () => {
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

  it('HERO-CTL-003: pauses while the pointer is over the art hit-target', () => {
    const art = fixture.nativeElement.querySelector('.billboard__art-hover') as HTMLElement;
    expect(art).toBeTruthy();
    art.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    component.onHeroPointerEnter();
    expect(component['pointerInside']).toBe(true);
    expect(component['heroPaused']()).toBe(true);
  });

  it('HERO-CTL-003: does not keep hover-pause when leaving art for the copy panel', () => {
    component['pointerInside'] = true;
    component['syncHeroPaused']();
    const copy = fixture.nativeElement.querySelector('.billboard__content') as HTMLElement;
    const leave = new MouseEvent('mouseleave', { bubbles: true, relatedTarget: copy });
    Object.defineProperty(leave, 'relatedTarget', { value: copy });
    component.onHeroPointerLeave(leave);
    expect(component['pointerInside']).toBe(false);
    expect(component['heroPaused']()).toBe(false);
  });

  it('HERO-CTL-003: keeps hover-pause when moving from art to pager controls', () => {
    component['pointerInside'] = true;
    component['syncHeroPaused']();
    const controls = fixture.nativeElement.querySelector('.billboard__controls') as HTMLElement;
    const leave = new MouseEvent('mouseleave', { bubbles: true });
    Object.defineProperty(leave, 'relatedTarget', { value: controls });
    component.onHeroPointerLeave(leave);
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

  it('HERO-LIF-006: does not rebuild image layers when slides refresh with an unchanged sequence', () => {
    component['heroImageReady'].set(true);

    fixture.componentRef.setInput('slides', [ep('a'), ep('b'), ep('c')]);
    fixture.detectChanges();

    expect(component['heroIndex']()).toBe(0);
    expect(component['heroImageReady']()).toBe(true);
  });

  it('HERO-CUR-001: emits removeFeatured with the active slide id', () => {
    const removed: string[] = [];
    component.removeFeatured.subscribe((id) => removed.push(id));
    fixture.componentRef.setInput('isCurator', true);
    fixture.componentRef.setInput('curatedEpisodeIds', ['a']);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      'button.billboard__manage--curate'
    ) as HTMLButtonElement | null;
    expect(button).toBeTruthy();
    button?.click();
    expect(removed).toEqual(['a']);
  });

  it('HERO-CUR-001: emits manageHero / manageRails from curator controls', () => {
    const managed: string[] = [];
    component.manageHero.subscribe(() => managed.push('hero'));
    component.manageRails.subscribe(() => managed.push('rails'));
    fixture.componentRef.setInput('isCurator', true);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll(
      '.billboard__admin > button.billboard__manage:not(.billboard__manage--curate)'
    ) as NodeListOf<HTMLButtonElement>;
    expect(buttons.length).toBe(2);
    buttons[0].click();
    buttons[1].click();
    expect(managed).toEqual(['hero', 'rails']);
  });

  it('keeps remove-from-hero inside the curator admin toolbar', () => {
    fixture.componentRef.setInput('isCurator', true);
    fixture.componentRef.setInput('curatedEpisodeIds', ['a']);
    fixture.detectChanges();

    const admin = fixture.nativeElement.querySelector('.billboard__admin') as HTMLElement | null;
    const remove = fixture.nativeElement.querySelector(
      'button.billboard__manage--curate'
    ) as HTMLButtonElement | null;
    const actionsRemove = fixture.nativeElement.querySelector(
      '.billboard__actions button.billboard__manage--curate'
    );

    expect(admin).toBeTruthy();
    expect(remove).toBeTruthy();
    expect(admin?.contains(remove!)).toBe(true);
    expect(actionsRemove).toBeNull();
  });

  it('HERO-LIF-001: image gate stays blocked until the fallback timeout when decode never completes', () => {
    vi.useFakeTimers();
    class StuckImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      complete = false;
      decode = undefined;
      fetchPriority = '';
      decoding = '';
      set src(_value: string) {
        /* never completes */
      }
    }
    globalThis.Image = StuckImage as unknown as typeof Image;

    component['heroImageReady'].set(false);
    component['beginHeroImageGate']();
    expect(component['heroImageReady']()).toBe(false);
    // A slow-but-working backdrop must still gate the dwell timer.
    vi.advanceTimersByTime(7500);
    expect(component['heroImageReady']()).toBe(false);
    vi.advanceTimersByTime(4500);
    expect(component['heroImageReady']()).toBe(true);
  });

  it('crossfade flips the front layer onto the incoming stage', () => {
    vi.useFakeTimers();
    component['reduceMotion'] = false;
    component['heroFrontLayer'].set('a');
    component['heroIndex'].set(0);
    component['lastFeaturedId'] = 'a';
    component['transitionTo'](1);

    // Hold finishes with a cached image: backdrop and copy leave together.
    vi.advanceTimersByTime(450);
    expect(component['heroLayerB']()).toContain('/b/');
    expect(component['heroIndex']()).toBe(0);
    expect(component['heroContentVisible']()).toBe(false);

    vi.advanceTimersByTime(550);
    expect(component['heroIndex']()).toBe(1);
  });

  it('HERO-LIF-003: holds copy until the next backdrop is ready, then fades with the image', () => {
    vi.useFakeTimers();
    const deferred: { fire: (() => void) | null } = { fire: null };
    class DeferredImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      complete = false;
      decode = undefined;
      fetchPriority = '';
      decoding = '';
      set src(_value: string) {
        deferred.fire = () => {
          this.complete = true;
          this.onload?.();
        };
      }
    }
    globalThis.Image = DeferredImage as unknown as typeof Image;

    component['reduceMotion'] = false;
    component['heroIndex'].set(0);
    component['lastFeaturedId'] = 'a';
    component['heroContentVisible'].set(true);
    component['transitionTo'](1);

    // Hold elapsed but backdrop not ready yet — keep current title on screen.
    vi.advanceTimersByTime(450);
    expect(component['heroContentVisible']()).toBe(true);
    expect(component['heroIndex']()).toBe(0);
    expect(component['featured']()?.id).toBe('a');

    expect(deferred.fire).toBeTruthy();
    deferred.fire!();
    // Image + text leave together; copy content swaps only after the out fade.
    expect(component['heroContentVisible']()).toBe(false);
    expect(component['heroIndex']()).toBe(0);
    expect(component['heroLayerB']() ?? component['heroLayerA']()).toContain('/b/');

    vi.advanceTimersByTime(550);
    expect(component['heroIndex']()).toBe(1);
    expect(component['featured']()?.id).toBe('b');
    expect(component['heroImageReady']()).toBe(true);
  });

  it('HERO-LIF-004: reduce-motion jumps index immediately without starting the cycle timer', () => {
    component['reduceMotion'] = true;
    component['stopHeroCycle']();
    component['heroIndex'].set(0);
    component['transitionTo'](2);
    expect(component['heroIndex']()).toBe(2);
    expect(component['heroTimer']).toBeUndefined();
  });

  it('HERO-LIF-005: still auto-advances on saveGpu mobile mode (Ken Burns off, timer on)', () => {
    // Arrange — mobile GPU saver must not reuse reduceMotion's "no cycle" path.
    vi.useFakeTimers();
    component['reduceMotion'] = false;
    component['saveGpu'] = true;
    component['heroPaused'].set(false);
    component['heroImageReady'].set(true);
    component['heroIndex'].set(0);
    component['lastFeaturedId'] = 'a';

    // Act
    component['startHeroCycle']();
    vi.advanceTimersByTime(7500 + 250);
    vi.advanceTimersByTime(450 + 550);

    // Assert
    expect(component['heroTimer']).toBeTruthy();
    expect(component['heroIndex']()).toBe(1);
    expect(component['kenBurnsAllowed']()).toBe(false);
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
    vi.advanceTimersByTime(450 + 550);
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
