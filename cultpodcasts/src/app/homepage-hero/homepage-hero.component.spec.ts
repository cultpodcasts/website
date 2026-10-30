import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PLATFORM_ID, provideZonelessChangeDetection, signal } from '@angular/core';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileString } from 'sass';
import { HomepageHeroComponent, HomepageHeroSlide } from './homepage-hero.component';
import { SEARCH_DESCRIPTION_SIZE } from '../search-description';
import { HomepageEpisode } from '../homepage-episode.interface';
import { PlayerService } from '../player.service';
import { HERO_DESC_GROW } from './hero-desc-layout';

const heroDir = dirname(fileURLToPath(import.meta.url));
// Specs match indented Sass with \n; normalize CRLF so Windows checkouts still pass.
const heroSass = readFileSync(join(heroDir, 'homepage-hero.component.sass'), 'utf8').replaceAll('\r\n', '\n');

function ep(id: string, overrides: Partial<HomepageEpisode> = {}): HomepageHeroSlide {
  const episode: HomepageEpisode = {
    id,
    podcastName: `Show ${id}`,
    episodeTitle: `Episode ${id}`,
    episodeDescription: `Desc ${id}`,
    release: new Date('2026-07-31T12:00:00Z'),
    duration: '01:00:00',
    services: { youtube: { url: `https://www.youtube.com/watch?v=${id}` } },
    ids: { youtube: id },
    subjects: [`Subject ${id}`],
    image: new URL(`https://img.example/${id}.jpg`),
    ...overrides,
  };
  return {
    ...episode,
    playableLink: ['/podcast', episode.podcastName, episode.id],
    parentLink: episode.podcastName ? ['/podcast', episode.podcastName] : null,
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

  // Minimal in-memory queue with the PlayerService surface the hero and app-queue-button use.
  const queuedIds = signal<string[]>([]);
  const player = {
    episode: () => undefined,
    play: () => undefined,
    isQueuedId: (id: string | undefined) => !!id && queuedIds().includes(id),
    toggleQueue: vi.fn((episode: { id: string }) => queuedIds.update((ids) =>
      ids.includes(episode.id) ? ids.filter((id) => id !== episode.id) : [...ids, episode.id])),
  };

  beforeEach(async () => {
    queuedIds.set([]);
    player.toggleQueue.mockClear();
    originalImage = globalThis.Image;
    globalThis.Image = ImmediateImage as unknown as typeof Image;

    await TestBed.configureTestingModule({
      imports: [HomepageHeroComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: PlayerService, useValue: player },
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

  it('renders a film with no parent line when the homepage passes a null parent path', () => {
    const film = ep('a', { contentKind: 'Film', podcastName: 'Studio', episodeTitle: 'One Off' });
    film.playableLink = ['/film', 'One Off', 'a'];
    film.parentLink = null;
    fixture.componentRef.setInput('slides', [film, ep('b'), ep('c')]);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('a.hero-pill')).toBeNull();
    expect(root.querySelector('button.billboard__play')).toBeTruthy();
    expect(root.querySelector('.billboard__more')).toBeNull();

    // With nothing to play in-app or outbound, Watch links to the episode page.
    film.services = undefined;
    film.ids = undefined;
    fixture.componentRef.setInput('slides', [{ ...film }, ep('b'), ep('c')]);
    fixture.detectChanges();
    expect((root.querySelector('a.billboard__play') as HTMLAnchorElement).getAttribute('href')).toBe('/film/One%20Off/a');
  });

  it('HERO-KND-001: labels a film hero "Film" with the movie icon in the eyebrow, with no parent pill', () => {
    const film = ep('a', { contentKind: 'Film', podcastName: 'Synthetic Film', episodeTitle: 'Synthetic Film' });
    film.playableLink = ['/film', 'Synthetic Film', 'a'];
    film.parentLink = null;
    fixture.componentRef.setInput('slides', [film, ep('b'), ep('c')]);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.hero-pill')).toBeNull();
    expect(root.querySelector('.hero-show')).toBeNull();
    const badge = root.querySelector('.billboard__eyebrow .kind-badge') as HTMLElement;
    expect(badge.querySelector('mat-icon')?.textContent?.trim()).toBe('movie');
    expect(badge.textContent).toContain('Film');
    // HERO-TTL-001 still holds: the title opens the film page.
    expect((root.querySelector('a.billboard__title-link') as HTMLAnchorElement).getAttribute('href'))
      .toBe('/film/Synthetic%20Film/a');
  });

  for (const [kind, icon, root, label] of [
    ['NewsReport', 'newspaper', '/news', 'News'],
    ['TvShowEpisode', 'live_tv', '/tv', 'TV'],
  ] as const) {
    it(`shows the ${icon} icon in a ${kind} hero's parent pill, linking to the parent hub`, () => {
      const slide = ep('a', { contentKind: kind, podcastName: 'Synthetic Parent' });
      slide.playableLink = [root, 'Synthetic Parent', 'a'];
      slide.parentLink = [root, 'Synthetic Parent'];
      fixture.componentRef.setInput('slides', [slide, ep('b'), ep('c')]);
      fixture.detectChanges();

      const el = fixture.nativeElement as HTMLElement;
      const pill = el.querySelector('a.hero-pill') as HTMLAnchorElement;
      expect(pill.getAttribute('href')).toBe(`${root}/Synthetic%20Parent`);
      expect(pill.querySelector('mat-icon')?.textContent?.trim()).toBe(icon);
      expect(pill.textContent).toContain('Synthetic Parent');
      expect((el.querySelector('a.billboard__title-link') as HTMLAnchorElement).getAttribute('href'))
        .toBe(`${root}/Synthetic%20Parent/a`);
    });

    it(`HERO-KND-001: labels a ${kind} hero "${label}" with the ${icon} icon in the eyebrow`, () => {
      const slide = ep('a', { contentKind: kind, podcastName: 'Synthetic Parent' });
      slide.playableLink = [root, 'Synthetic Parent', 'a'];
      slide.parentLink = [root, 'Synthetic Parent'];
      fixture.componentRef.setInput('slides', [slide, ep('b'), ep('c')]);
      fixture.detectChanges();

      const eyebrow = (fixture.nativeElement as HTMLElement).querySelector('.billboard__eyebrow') as HTMLElement;
      const badge = eyebrow.querySelector('.kind-badge') as HTMLElement;
      expect(badge.querySelector('mat-icon')?.textContent?.trim()).toBe(icon);
      expect(badge.textContent?.replace(icon, '').trim()).toBe(label);
      expect(eyebrow.textContent).toContain('Now featuring');
    });
  }

  it('HERO-KND-001: follows the slide, so a podcast after a news report has no kind badge', () => {
    const news = ep('a', { contentKind: 'NewsReport', podcastName: 'Synthetic Desk' });
    news.playableLink = ['/news', 'Synthetic Desk', 'a'];
    news.parentLink = ['/news', 'Synthetic Desk'];
    fixture.componentRef.setInput('slides', [news, ep('b'), ep('c')]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.kind-badge')?.textContent).toContain('News');

    component['heroIndex'].set(1);
    fixture.detectChanges();
    expect(el.querySelector('.kind-badge')).toBeNull();
    expect(el.querySelector('.kind-badge__sep')).toBeNull();
    expect((el.querySelector('a.hero-pill') as HTMLAnchorElement).getAttribute('href')).toBe('/podcast/Show%20b');
  });

  it('keeps a podcast hero pill free of a kind icon, and its eyebrow free of a kind badge', () => {
    const el = fixture.nativeElement as HTMLElement;
    const pill = el.querySelector('a.hero-pill') as HTMLAnchorElement;
    expect(pill.querySelector('mat-icon')).toBeNull();
    expect(el.querySelector('.kind-badge')).toBeNull();
    expect(el.querySelector('.billboard__eyebrow')?.textContent?.trim()).toBe('Now featuring');
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

  it('HERO-SUB-002: keeps the Watch / Add to Queue actions below the subject chips', () => {
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

  it('compiled component CSS stays under the anyComponentStyle error budget (17 kB in angular.json)', () => {
    // The production build fails the Cloudflare Pages deploy above 17,000 bytes, and
    // test:all does not run it. Compressed Sass tracks the build's measure within ~1%.
    const css = compileString(heroSass, { syntax: 'indented', style: 'compressed' }).css;
    expect(css.length).toBeLessThan(17_000);
  });

  it('HERO-SCR-001/002/005 + HERO-CTL-001/003/004 + HERO-SWP-001: Sass keeps scroll-stability and hit-target contracts', () => {
    // Layout bugs often land in CSS; assert the source contracts stay present.
    expect(heroSass).toMatch(/\.billboard[\s\S]*?overflow-anchor:\s*none/);
    expect(heroSass).toMatch(/\.billboard__dots-viewport[\s\S]*?overflow-anchor:\s*none/);
    expect(heroSass).toMatch(/\.billboard__title[\s\S]*?line-clamp:\s*3/);
    // HERO-SCR-002: desc clamp + reserved height follow the per-layout line count.
    expect(heroSass).toMatch(/\.billboard__desc\n[\s\S]*?line-clamp:\s*var\(--hero-desc-lines\)/);
    expect(heroSass).toMatch(/\.billboard__desc\n[\s\S]*?min-height:\s*calc\(1\.45em \* var\(--hero-desc-lines\)\)/);
    expect(heroSass).toMatch(/\.billboard__copy-body[\s\S]*?&\.has-desc[\s\S]*?min-height:\s*calc\(1\.45em \* var\(--hero-desc-lines\)/);
    expect(heroSass).toMatch(/\.billboard__stages,[\s\S]*?pointer-events:\s*none/);
    expect(heroSass).toMatch(/\.billboard[\s\S]*?touch-action:\s*pan-y/);
    // HERO-CTL-003: dedicated art hover layer (not whole-billboard mouseenter).
    expect(heroSass).toMatch(/\.billboard__art-hover[\s\S]*?pointer-events:\s*auto/);
    // HERO-CTL-004 / HERO-SCR-006: stacked medium — pager on art; CTAs in seam (order).
    expect(heroSass).toMatch(
      /@media screen and \(max-width:\s*1280px\) and \(min-width:\s*701px\) and \(min-height:\s*600px\)[\s\S]*?\.billboard__actions[\s\S]*?order:\s*1/
    );
    expect(heroSass).toMatch(
      /@media screen and \(max-width:\s*1280px\) and \(min-width:\s*701px\) and \(min-height:\s*600px\)[\s\S]*?\.billboard__controls[\s\S]*?position:\s*absolute/
    );
    expect(heroSass).toMatch(
      /@media screen and \(max-width:\s*1280px\) and \(min-width:\s*701px\) and \(min-height:\s*600px\)[\s\S]*?\.billboard__controls[\s\S]*?width:\s*auto/
    );
    // HERO-CTL-004 mobile: controls under art via flex order.
    expect(heroSass).toMatch(
      /@media screen and \(max-width:\s*700px\)[\s\S]*?\.billboard__controls[\s\S]*?order:\s*1/
    );
    expect(heroSass).toMatch(
      /@media screen and \(max-width:\s*700px\)[\s\S]*?\.billboard__content[\s\S]*?order:\s*2/
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

  it('passes the full trimmed featured description to the hero (CSS clamp, not the search-card cap)', () => {
    const long = `  ${'Synthetic hero sentence number one. '.repeat(15).trim()}  `;
    expect(long.trim().length).toBeGreaterThan(SEARCH_DESCRIPTION_SIZE);
    fixture.componentRef.setInput('slides', [ep('a', { episodeDescription: long }), ep('b'), ep('c')]);
    fixture.detectChanges();

    expect(component['featuredDesc']()).toBe(long.trim());
    const rendered = (fixture.nativeElement as HTMLElement).querySelector('.billboard__desc');
    expect(rendered?.textContent?.trim()).toBe(long.trim());
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
  describe('HERO-TTL-001: the title links to the episode page', () => {
    const root = () => fixture.nativeElement as HTMLElement;
    const titleLink = () => root().querySelector<HTMLAnchorElement>('h1.billboard__title > a.billboard__title-link');

    it('links the title text to the slide episode page (More info target)', () => {
      expect(titleLink()!.getAttribute('href')).toBe('/podcast/Show%20a/a');
      expect(titleLink()!.textContent?.trim()).toBe('Episode a');
      expect(root().querySelector('h1.billboard__title')!.textContent?.trim()).toBe('Episode a');
    });

    it('uses the film / series path the homepage gives, on every slide', () => {
      const film = ep('f', { contentKind: 'Film', episodeTitle: 'One Off' });
      film.playableLink = ['/film', 'One Off', 'f'];
      film.parentLink = null;
      fixture.componentRef.setInput('slides', [film, ep('b'), ep('c')]);
      fixture.detectChanges();
      expect(titleLink()!.getAttribute('href')).toBe('/film/One%20Off/f');

      component['reduceMotion'] = true;
      (root().querySelectorAll('button.billboard__dot')[1] as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(titleLink()!.getAttribute('href')).toBe('/podcast/Show%20b/b');
    });

    it('is a separate link from the show pill and the description expander', () => {
      fixture.componentRef.setInput('slides', [
        ep('a', { episodeDescription: 'Synthetic long hero description sentence. '.repeat(12).trim() }), ep('b'), ep('c'),
      ]);
      fixture.detectChanges();
      // happy-dom has no layout: fake the clamped description overflowing so the expander renders.
      const desc = root().querySelector('.billboard__desc') as HTMLElement;
      Object.defineProperty(desc, 'clientHeight', { configurable: true, value: 100 });
      Object.defineProperty(desc, 'scrollHeight', { configurable: true, value: 240 });
      component['measureDescOverflow']();
      fixture.detectChanges();

      const pill = root().querySelector('a.hero-pill') as HTMLAnchorElement;
      const toggle = root().querySelector('button.billboard__desc-toggle') as HTMLButtonElement;
      expect(pill.getAttribute('href')).toBe('/podcast/Show%20a');
      expect(toggle).toBeTruthy();
      expect(pill.contains(titleLink())).toBe(false);
      expect(titleLink()!.contains(pill)).toBe(false);
      expect(titleLink()!.contains(toggle)).toBe(false);
      expect(toggle.closest('a')).toBeNull();
      // Expanding still works and does not navigate.
      toggle.click();
      fixture.detectChanges();
      expect(component['descExpanded']()).toBe(true);
    });

    it('keeps the title look in the Sass contract: inherited colour, no underline until hover / focus', () => {
      const css = compileString(heroSass, { syntax: 'indented' }).css;
      const rule = css.match(/\.billboard__title-link\s*\{([^}]*)\}/)?.[1] ?? '';
      expect(rule).toContain('color: inherit');
      expect(rule).toContain('text-decoration: none');
      expect(css).toMatch(/\.billboard__title-link:hover\s*\{[^}]*text-decoration: underline/);
      expect(css).toMatch(/\.billboard__title-link:focus-visible\s*\{[^}]*text-decoration: underline/);
    });
  });

  describe('HERO-QUE-001: Add to Queue replaces More info', () => {
    const root = () => fixture.nativeElement as HTMLElement;
    const queueButton = () => root().querySelector<HTMLButtonElement>('.billboard__actions app-queue-button button');
    function show(slide: HomepageHeroSlide): void {
      fixture.componentRef.setInput('slides', [slide, ep('b'), ep('c')]);
      fixture.detectChanges();
    }

    it('has no More info link', () => {
      expect(root().querySelector('.billboard__more')).toBeNull();
      expect(root().textContent).not.toContain('More info');
    });

    it('uses the rounded hero shape', () => {
      expect(queueButton()!.classList).toContain('queue-button--pill');
    });

    it('sits between Watch and the service links', () => {
      const actions = Array.from(root().querySelector('.billboard__actions')!.children);
      const known = ['billboard__play', 'billboard__queue', 'billboard__services'];
      expect(actions.map((el) => known.find((name) => el.classList.contains(name)))).toEqual([
        'billboard__play', 'billboard__queue', 'billboard__services',
      ]);
    });

    it('toggles the featured episode in the player queue, like the episode page', () => {
      expect(queueButton()!.getAttribute('aria-pressed')).toBe('false');
      expect(queueButton()!.textContent).toContain('Add to Queue');

      queueButton()!.click();
      fixture.detectChanges();
      expect(player.toggleQueue).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
      expect(queueButton()!.getAttribute('aria-pressed')).toBe('true');
      expect(queueButton()!.textContent).toContain('Queued');
      expect(queueButton()!.classList).toContain('is-queued');

      queueButton()!.click();
      fixture.detectChanges();
      expect(queueButton()!.textContent).toContain('Add to Queue');
    });

    it('releases the hover/focus pause after a pointer click, like the pager', () => {
      const actions = root().querySelector('.billboard__actions') as HTMLElement;
      actions.dispatchEvent(new MouseEvent('mouseenter'));
      queueButton()!.focus();
      root().querySelector('section.billboard')!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      expect(component['heroPaused']()).toBe(true);

      // Mouse click: detail 1.
      queueButton()!.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
      actions.dispatchEvent(new MouseEvent('mouseleave'));
      fixture.detectChanges();

      expect(player.toggleQueue).toHaveBeenCalledTimes(1);
      expect(document.activeElement).not.toBe(queueButton());
      expect(component['heroPaused']()).toBe(false);
    });

    it('keeps focus and the pause after keyboard activation', () => {
      queueButton()!.focus();
      root().querySelector('section.billboard')!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
      // Enter / Space on a button fires click with detail 0.
      queueButton()!.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
      fixture.detectChanges();

      expect(player.toggleQueue).toHaveBeenCalledTimes(1);
      expect(document.activeElement).toBe(queueButton());
      expect(component['heroPaused']()).toBe(true);
    });

    it('follows the current slide', () => {
      queuedIds.set(['b']);
      component['reduceMotion'] = true;
      (root().querySelectorAll('button.billboard__dot')[1] as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(queueButton()!.textContent).toContain('Queued');
    });

    it('is hidden when the episode cannot play in-app (outbound or nothing to play)', () => {
      show(ep('a', { ids: undefined, services: { bbcSounds: { url: 'https://www.bbc.co.uk/sounds/play/m000inv1' } } }));
      expect(root().querySelector('.billboard__play')).toBeTruthy();
      expect(queueButton()).toBeNull();

      show(ep('a', { ids: undefined, services: undefined }));
      expect(queueButton()).toBeNull();
    });
  });

  describe('HERO-SVC-001: service links on the hero card', () => {
    const root = () => fixture.nativeElement as HTMLElement;
    const links = () => Array.from(root().querySelectorAll<HTMLAnchorElement>('.billboard__actions app-episode-links a'));
    function show(slide: HomepageHeroSlide): void {
      fixture.componentRef.setInput('slides', [slide, ep('b'), ep('c')]);
      fixture.detectChanges();
    }

    it('reuses the episode page component in the action row, after Watch and Add to Queue, without share', () => {
      const actions = root().querySelector('.billboard__actions')!;
      const host = actions.querySelector('app-episode-links.billboard__services');
      expect(host).toBeTruthy();
      expect(actions.lastElementChild).toBe(host);
      expect(host!.querySelector('button')).toBeNull();
    });

    it('shows every service the episode has, in the episode page order, labels and link behaviour', () => {
      show(ep('a', {
        ids: undefined,
        services: {
          internetArchive: { url: 'https://archive.org/details/invented-a' },
          bbcSounds: { url: 'https://www.bbc.co.uk/sounds/play/m000inv1' },
          apple: { url: 'https://podcasts.apple.com/gb/podcast/invented/id1?i=2' },
          spotify: { url: 'https://open.spotify.com/episode/inventedA' },
          youtube: { url: 'https://www.youtube.com/watch?v=inventedA' },
        },
      }));
      expect(links().map((a) => a.getAttribute('aria-label'))).toEqual([
        'YouTube', 'Spotify', 'Apple Podcasts', 'BBC Sounds', 'Internet Archive',
      ]);
      expect(links().map((a) => a.href)).toEqual([
        'https://www.youtube.com/watch?v=inventedA',
        'https://open.spotify.com/episode/inventedA',
        'https://podcasts.apple.com/gb/podcast/invented/id1?i=2',
        'https://www.bbc.co.uk/sounds/play/m000inv1',
        'https://archive.org/details/invented-a',
      ]);
      for (const a of links()) {
        expect(a.target).toBe('_blank');
        expect(a.rel).toBe('noopener noreferrer');
      }
      // Apple uses the shared Apple mark, the rest the registered service icons.
      expect(links()[2].querySelector('app-apple-podcasts-svg')).toBeTruthy();
      expect(links()[1].querySelector('mat-icon')?.getAttribute('data-mat-icon-name')).toBe('spotify');
    });

    it('shows a TV episode\'s ABC iview link after YouTube in the billboard actions', () => {
      show(ep('a', {
        contentKind: 'TvShowEpisode',
        ids: undefined,
        services: {
          youtube: { url: 'https://www.youtube.com/watch?v=inventedTv' },
          abcIview: { url: 'https://iview.abc.net.au/video/ZZ0000H000S00' },
        },
      }));
      expect(links().map((a) => a.getAttribute('aria-label'))).toEqual(['YouTube', 'ABC iview']);
      expect(links()[1].href).toBe('https://iview.abc.net.au/video/ZZ0000H000S00');
      expect(links()[1].querySelector('mat-icon')?.getAttribute('data-mat-icon-name')).toBe('abc-iview');
    });

    it('shows nothing for services the episode does not have', () => {
      show(ep('a', { ids: undefined, services: { spotify: { url: 'https://open.spotify.com/episode/onlyA' } } }));
      expect(links().map((a) => a.getAttribute('aria-label'))).toEqual(['Spotify']);
      show(ep('a', { ids: undefined, services: undefined }));
      expect(links()).toHaveLength(0);
    });

    it('follows the current slide', () => {
      show(ep('a', { ids: undefined, services: { spotify: { url: 'https://open.spotify.com/episode/a' } } }));
      component['reduceMotion'] = true;
      (root().querySelectorAll('button.billboard__dot')[1] as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(links().map((a) => a.href)).toEqual(['https://www.youtube.com/watch?v=b']);
    });
  });

  describe('description expander', () => {
    const longDesc = 'Synthetic hero sentence for the show more toggle. '.repeat(12).trim();

    function root(): HTMLElement {
      return fixture.nativeElement as HTMLElement;
    }

    function toggle(): HTMLButtonElement | null {
      return root().querySelector('button.billboard__desc-toggle');
    }

    /** happy-dom has no layout: fake the clamped box being shorter than its content. */
    function fakeOverflow(overflowing: boolean): void {
      const desc = root().querySelector('.billboard__desc') as HTMLElement;
      Object.defineProperty(desc, 'clientHeight', { configurable: true, value: 100 });
      Object.defineProperty(desc, 'scrollHeight', { configurable: true, value: overflowing ? 240 : 100 });
      component['measureDescOverflow']();
      fixture.detectChanges();
    }

    beforeEach(() => {
      fixture.componentRef.setInput('slides', [ep('a', { episodeDescription: longDesc }), ep('b'), ep('c')]);
      fixture.detectChanges();
    });

    it('HERO-SCR-002: clamps 5 lines wide, 4 medium, 3 mobile', () => {
      expect(heroSass).toMatch(/^\.billboard\n[\s\S]*?--hero-desc-lines:\s*5/m);
      expect(heroSass).toMatch(/@media screen and \(max-width: 1280px\)\n    \.billboard\n        --hero-desc-lines:\s*4/);
      expect(heroSass).toMatch(/@media screen and \(max-width: 700px\)\n    \.billboard\n        --hero-desc-lines:\s*3/);
    });

    it('hides the toggle when the description fits the clamp', () => {
      fakeOverflow(false);
      expect(toggle()).toBeNull();
      expect(root().querySelector('.billboard__desc-fade')).toBeNull();
      // No expander row at all: the description's reserved lines keep slides one height.
      expect(root().querySelector('.billboard__desc-more')).toBeNull();
    });

    it('HERO-DSC-001: the expander sits inline on the last visible line (no row of its own)', () => {
      fakeOverflow(true);
      const wrap = root().querySelector('.billboard__desc-wrap')!;
      expect(wrap.querySelector('.billboard__desc')).toBeTruthy();
      expect(wrap.querySelector('button.billboard__desc-toggle')).toBeTruthy();
      expect(wrap.querySelector('.billboard__desc-fade')?.getAttribute('aria-hidden')).toBe('true');
      expect(heroSass).toMatch(/\.billboard__desc-wrap\n[\s\S]*?position:\s*relative/);
      expect(heroSass).toMatch(/\.billboard__desc-toggle\n\s+position:\s*absolute\n\s+right:\s*0\n\s+bottom:/);
      // Expanded (HERO-DSC-003): the chevron moves into its own band under the scroller, so the
      // old end-of-text spacer is gone.
      const descBlock = heroSass.slice(heroSass.indexOf('\n.billboard__desc\n') + 1);
      const descLines = descBlock.split('\n');
      const descEnd = descLines.findIndex((line, i) => i > 0 && /^\S/.test(line));
      const descRule = descLines.slice(0, descEnd).join('\n');
      const expandedRule = descRule.slice(descRule.indexOf('&.is-expanded'));
      expect(descRule).toContain('&.is-expanded');
      expect(expandedRule).not.toMatch(/::after/);
      expect(expandedRule).not.toMatch(/--hero-desc-toggle-room/);
      // Stacked reserve no longer adds a 32px expander row.
      expect(heroSass).not.toMatch(/var\(--hero-desc-lines\)\s*\+\s*4[04]px\s*\+\s*32px/);
      expect(heroSass).not.toMatch(/billboard__desc-more/);
    });

    it('shows the discovery-style icon expander only when the description overflows', () => {
      fakeOverflow(true);
      const button = toggle()!;
      const desc = root().querySelector('.billboard__desc') as HTMLElement;
      expect(button.querySelector('mat-icon')?.textContent?.trim()).toBe('expand_more');
      expect(button.getAttribute('aria-label')).toBe('Expand description');
      expect(button.textContent).not.toMatch(/Show (more|less)/);
      expect(button.getAttribute('type')).toBe('button');
      expect(button.getAttribute('aria-expanded')).toBe('false');
      expect(desc.id).toBe('billboard-desc');
      expect(button.getAttribute('aria-controls')).toBe(desc.id);
      expect(desc.hasAttribute('tabindex')).toBe(false);
    });

    describe('HERO-WID-001: wide keeps the card bottom-anchored in the hero band', () => {
      const originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
      afterEach(() => {
        vi.restoreAllMocks();
        if (originalMatchMedia) {
          Object.defineProperty(window, 'matchMedia', originalMatchMedia);
        } else {
          delete (window as { matchMedia?: unknown }).matchMedia;
        }
      });

      /** Fake the wide layout: 720px band, 140/48 padding, -16px overhang, 22px lines, 14 text lines. */
      function fakeWide(wide: boolean, cardHeight: number): void {
        Object.defineProperty(window, 'matchMedia', {
          configurable: true,
          value: (q: string) => ({ matches: wide && q.includes('1281px'), media: q }),
        });
        const real = window.getComputedStyle.bind(window);
        vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element) => {
          const e = el as HTMLElement;
          if (e.classList.contains('billboard')) {
            return { minHeight: '720px', paddingTop: '140px', paddingBottom: '48px',
              getPropertyValue: (n: string) => (n === '--hero-desc-lines' ? '5' : '') } as unknown as CSSStyleDeclaration;
          }
          if (e.classList.contains('billboard__content')) {
            return { marginBottom: '-16px' } as unknown as CSSStyleDeclaration;
          }
          if (e.classList.contains('billboard__desc')) {
            return { lineHeight: '22px' } as unknown as CSSStyleDeclaration;
          }
          return real(el);
        });
        const desc = root().querySelector('.billboard__desc') as HTMLElement;
        const card = root().querySelector('.billboard__content') as HTMLElement;
        const hero = root().querySelector('.billboard') as HTMLElement;
        Object.defineProperty(desc, 'clientHeight', { configurable: true, value: 110 });
        Object.defineProperty(desc, 'scrollHeight', { configurable: true, value: 308 });
        Object.defineProperty(card, 'offsetHeight', { configurable: true, value: cardHeight });
        Object.defineProperty(hero, 'clientHeight', { configurable: true, value: 720 });
        component['measureDescOverflow']();
        fixture.detectChanges();
      }

      const content = () => root().querySelector('.billboard__content') as HTMLElement;
      const desc = () => root().querySelector('.billboard__desc') as HTMLElement;

      it('drops collapsed lines (5 → 2) until a tall card fits the band', () => {
        // rest = 600 - 110 = 490 (inline expander: no row); need(n) = 490 + 22n - 16: 5→584 4→562 3→540 2→518 ≤ 532.
        fakeWide(true, 600);
        expect(content().style.getPropertyValue('--hero-desc-lines')).toBe('2');
      });

      it('keeps the Sass 5 lines when the card fits', () => {
        // need(5) = 400 - 110 + 110 - 16 = 384 ≤ 532.
        fakeWide(true, 400);
        expect(content().style.getPropertyValue('--hero-desc-lines')).toBe('');
      });

      it('keeps the collapsed fit while expanded, so collapsing returns to the band', () => {
        fakeWide(true, 600);
        toggle()!.click();
        fixture.detectChanges();
        component['measureDescOverflow']();
        fixture.detectChanges();
        expect(content().style.getPropertyValue('--hero-desc-lines')).toBe('2');
        toggle()!.click();
        fixture.detectChanges();
        expect(content().style.getPropertyValue('--hero-desc-lines')).toBe('2');
      });

      it('re-fits on a slide change even when the description text is the same', () => {
        fakeWide(true, 600);
        expect(content().style.getPropertyValue('--hero-desc-lines')).toBe('2');
        // Same description, shorter card (e.g. a 1-line title): the fit must be recomputed.
        Object.defineProperty(content(), 'offsetHeight', { configurable: true, value: 400 });
        fixture.componentRef.setInput('slides', [ep('z', { episodeDescription: longDesc, episodeTitle: 'Short' })]);
        fixture.detectChanges();
        TestBed.tick();
        fixture.detectChanges();
        expect(content().style.getPropertyValue('--hero-desc-lines')).toBe('');
      });

      it('sets no override on stacked layouts', () => {
        fakeWide(false, 600);
        expect(content().style.getPropertyValue('--hero-desc-lines')).toBe('');
      });
    });

    describe('HERO-DSC-002 / 005: expanded keeps the hero and the card top (never moves down); the description grows by the gap, within [max(6 lines, 30vh), 60vh]', () => {
      const realInnerHeight = window.innerHeight;
      afterEach(() => {
        vi.restoreAllMocks();
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: realInnerHeight });
      });

      /**
       * Collapsed card at hero y 300–688 in a 720px hero; desc 110px of it (C), 22px lines (L);
       * full text `fullPx` tall. Wide (row) hero unless `column`, with 138px top padding (the
       * search clearance), so the card's top is 162px below the hero's content top.
       */
      function fakeCollapsed(viewportH: number, heroTop = 0, column = false, fullPx = 3000): void {
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: viewportH });
        const hero = root().querySelector('.billboard') as HTMLElement;
        const card = root().querySelector('.billboard__content') as HTMLElement;
        const desc = root().querySelector('.billboard__desc') as HTMLElement;
        const rect = (top: number, height: number) => ({ top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
        vi.spyOn(hero, 'getBoundingClientRect').mockImplementation(() => rect(heroTop, 720));
        vi.spyOn(card, 'getBoundingClientRect').mockImplementation(() => rect(heroTop + 300, 388));
        Object.defineProperty(desc, 'clientHeight', { configurable: true, value: 110 });
        Object.defineProperty(desc, 'scrollHeight', { configurable: true, value: fullPx });
        const real = window.getComputedStyle.bind(window);
        vi.spyOn(window, 'getComputedStyle').mockImplementation((el: Element) => {
          if (el === hero) {
            return { flexDirection: column ? 'column' : 'row', paddingTop: column ? '0px' : '138px', getPropertyValue: () => '' } as unknown as CSSStyleDeclaration;
          }
          if (el === desc) {
            return { lineHeight: '22px', height: '110px', paddingTop: '0px', paddingBottom: '0px' } as unknown as CSSStyleDeclaration;
          }
          return real(el);
        });
      }

      const hero = () => root().querySelector('.billboard') as HTMLElement;
      const card = () => root().querySelector('.billboard__content') as HTMLElement;
      const descEl = () => root().querySelector('.billboard__desc') as HTMLElement;

      function expand(): void {
        toggle()!.click();
        fixture.detectChanges();
      }

      function relayout(viewportH: number, heroTop: number, column = false): void {
        vi.restoreAllMocks();
        fakeCollapsed(viewportH, heroTop, column);
        component['layoutExpandedDesc']();
        fixture.detectChanges();
      }

      it('gap below the minimum: grows by max(6 lines, 30vh), past the foot; wide keeps the top', () => {
        fakeOverflow(true);
        fakeCollapsed(900);
        expand();
        expect(hero().style.height).toBe('720px');
        // G = 888 - 688 - 40 (chevron band) = 160 < minGrow = max(132, 270) = 270 → 110 + 270.
        expect(descEl().style.height).toBe('380px');
        // HERO-DSC-005: no translate; the hero aligns the card to its top and the card is laid
        // from its collapsed top (162px into the content box), so the top cannot drift.
        expect(card().style.transform).toBe('');
        expect(hero().style.alignItems).toBe('flex-start');
        expect(card().style.marginTop).toBe('162px');
        expect(hero().classList.contains('is-desc-expanded')).toBe(true);
      });

      it('stacked: the card keeps its top in flow, so no shift and no top offset', () => {
        fakeOverflow(true);
        fakeCollapsed(900, 0, true);
        expand();
        expect(descEl().style.height).toBe('380px');
        expect(card().style.transform).toBe('');
        expect(card().style.marginTop).toBe('');
        expect(hero().style.alignItems).toBe('');
      });

      it("card bottom at the foot (Jon's mobile case): still grows by the minimum, never moves up", () => {
        fakeOverflow(true);
        fakeCollapsed(700, 0, true);
        expand();
        // G = 688 - 688 - 40 < 0 → minGrow = max(132, 210) = 210.
        expect(descEl().style.height).toBe('320px');
        expect(card().style.transform).toBe('');
      });

      it('gap between the bounds: fills to the viewport foot', () => {
        fakeOverflow(true);
        fakeCollapsed(900, -200);
        expand();
        // Card bottom at 488: G = 888 - 488 - 40 = 360 (270 ≤ G ≤ 540 - 40) → 110 + 360; the
        // 40px chevron band then ends the card at the foot.
        expect(descEl().style.height).toBe('470px');
      });

      it('tall gap: capped at 60vh of growth, so collapsing never needs a long scroll', () => {
        fakeOverflow(true);
        fakeCollapsed(900, -500);
        expand();
        // G = 888 - 188 - 40 = 660 > maxGrow = 540 - 40 (the band counts in the 60vh) → 110 + 500.
        expect(descEl().style.height).toBe('610px');
      });

      it('short text shows in full (no scroller); the chevron band is under it, not a spacer line', () => {
        fakeOverflow(true);
        fakeCollapsed(900, 0, false, 150);
        expand();
        // full = 150 < 110 + 270.
        expect(descEl().style.height).toBe('150px');
        // Same top offset whatever the growth (the growth-sized shift drifted: Jon, 27 Oct 2026).
        expect(card().style.transform).toBe('');
        expect(card().style.marginTop).toBe('162px');
      });

      it('measures once: page scroll neither re-sizes nor collapses (the card moves with the page)', () => {
        fakeOverflow(true);
        fakeCollapsed(900);
        expand();
        vi.restoreAllMocks();
        fakeCollapsed(900, -700);
        window.dispatchEvent(new Event('scroll'));
        fixture.detectChanges();
        expect(descEl().classList.contains('is-expanded')).toBe(true);
        expect(descEl().style.height).toBe('380px');
        expect(card().style.marginTop).toBe('162px');
      });

      it('a height-only resize re-sizes from the expand-time position', () => {
        fakeOverflow(true);
        fakeCollapsed(900);
        expand();
        // Page scrolled since, then the viewport got shorter (mobile URL bar).
        relayout(800, -300);
        // Card bottom 688 at expand: G = 788 - 688 = 100 < minGrow = max(132, 240) → 110 + 240.
        expect(descEl().style.height).toBe('350px');
      });

      it('collapse restores the exact collapsed layout (no lock, top offset, height or scroll offset)', () => {
        fakeOverflow(true);
        fakeCollapsed(600);
        expand();
        descEl().scrollTop = 120;
        toggle()!.click();
        fixture.detectChanges();
        expect(hero().style.height).toBe('');
        expect(hero().style.alignItems).toBe('');
        expect(card().style.transform).toBe('');
        expect(card().style.marginTop).toBe('');
        expect(descEl().style.height).toBe('');
        expect(descEl().scrollTop).toBe(0);
        expect(hero().classList.contains('is-desc-expanded')).toBe(false);
      });

      it('Sass: the expanded description scrolls inside; the card spills over what follows on an opaque surface', () => {
        expect(heroSass).toMatch(/&\.is-expanded\n\s+display:\s*block[\s\S]*?overflow-y:\s*auto\n\s+overscroll-behavior:\s*contain/);
        expect(heroSass).toMatch(/\.billboard\.is-desc-expanded\n\s+overflow-x:\s*clip\n\s+overflow-y:\s*visible\n[\s\S]*?\.billboard__content::before\n\s+height:[^\n]+\n\s+background:\s*#0b0b0b\n/);
        expect(heroSass).not.toMatch(/is-desc-expanded::before/);
        expect(heroSass).toMatch(/scroll-margin-top:\s*var\(--nflx-hero-search-clearance,\s*140px\)/);
        expect(heroSass).not.toMatch(/45vh/);
      });

      it('the chevron stays outside the scrolling description', () => {
        fakeOverflow(true);
        expand();
        const button = toggle()!;
        expect(descEl().contains(button)).toBe(false);
        expect(button.parentElement?.classList.contains('billboard__desc-wrap')).toBe(true);
        // A scroll container must be reachable by keyboard (arrow keys scroll it).
        expect(descEl().getAttribute('tabindex')).toBe('0');
      });

      it('HERO-DSC-003: expanded text keeps clear of the scrollbar, long URLs wrap, and the chevron has its own band', () => {
        fakeOverflow(true);
        expand();
        const wrap = descEl().parentElement!;
        expect(wrap.classList.contains('billboard__desc-wrap')).toBe(true);
        expect(wrap.classList.contains('is-expanded')).toBe(true);
        // The fade belongs to the collapsed inline expander only.
        expect(wrap.querySelector('.billboard__desc-fade')).toBeNull();
        expect(heroSass).toMatch(/^\.billboard__desc\n[\s\S]*?overflow-wrap:\s*anywhere/m);
        expect(heroSass).toMatch(/&\.is-expanded\n\s+display:\s*block[\s\S]*?overflow-x:\s*hidden/);
        // HERO-DSC-006: the scrollbar clearance (gutter + 16px, border-box) is on the base rule, so
        // collapsed and expanded share one text column width and expanding never re-wraps a line.
        expect(heroSass).toMatch(/^\.billboard__desc\n(?:    [^\n]*\n|\n)*?    box-sizing:\s*border-box\n    scrollbar-gutter:\s*stable\n    padding-right:\s*16px\n/m);
        // TS sizing counts the same band (card fills to the foot, at most 60vh of growth).
        const band = heroSass.match(/\.billboard__desc-wrap\n[\s\S]*?&\.is-expanded\n\s+padding-bottom:\s*(\d+)px/);
        expect(Number(band?.[1])).toBe(HERO_DESC_GROW.toggleBandPx);
        toggle()!.click();
        fixture.detectChanges();
        expect(wrap.classList.contains('is-expanded')).toBe(false);
      });

      it('HERO-DSC-006: expanding never changes the text column width (no width, padding, gutter or sizing override expanded)', () => {
        fakeOverflow(true);
        expand();
        expect(descEl().classList.contains('is-expanded')).toBe(true);
        // Only the height is set inline expanded (no inline width or padding).
        expect(descEl().style.width).toBe('');
        expect(descEl().style.paddingRight).toBe('');
        // The Sass contract (geometry itself: e2e): the expanded description block overrides
        // none of the column's width, padding, gutter or sizing.
        const descBlock = heroSass.slice(heroSass.indexOf('\n.billboard__desc\n') + 1);
        const descLines = descBlock.split('\n');
        const descEnd = descLines.findIndex((line, i) => i > 0 && /^\S/.test(line));
        const descRule = descLines.slice(0, descEnd).join('\n');
        const expandedRule = descRule.slice(descRule.indexOf('&.is-expanded'));
        expect(expandedRule).not.toMatch(/padding|scrollbar-gutter|box-sizing|width|max-width/);
        expect(descRule.slice(0, descRule.indexOf('&.is-expanded'))).toMatch(/scrollbar-gutter:\s*stable[\s\S]*?padding-right:\s*16px/);
        // Nor does the expanded billboard.
        const expandedHero = heroSass.slice(heroSass.indexOf('\n.billboard.is-desc-expanded\n'));
        expect(expandedHero).not.toMatch(/\.billboard__desc\b[^\n]*\n(?:\s{8,}[^\n]*\n)*?\s{8,}(?:padding|width|scrollbar-gutter|box-sizing)/);
      });

      it('HERO-DSC-004: only the card is raised over the stats strip, not the billboard (art band stays under it)', () => {
        const lines = heroSass.slice(heroSass.indexOf('.billboard.is-desc-expanded\n')).split('\n');
        const end = lines.findIndex((line, i) => i > 0 && /^\S/.test(line));
        const block = lines.slice(0, end < 0 ? undefined : end).join('\n');
        const own = block.split('\n').slice(1).filter((line) => /^    [^\s/]/.test(line)).join('\n');
        // Direct declarations of .billboard.is-desc-expanded: overflow only, no z-index (a
        // stacking context above the strip painted the art over its top 28px). Sideways it
        // clips, so the stacked card's 100vw panel cannot scroll the page horizontally.
        expect(own).toMatch(/overflow-x:\s*clip\n\s+overflow-y:\s*visible/);
        expect(own).not.toMatch(/z-index/);
        expect(block).toMatch(/\n    \.billboard__content\n\s+z-index:\s*4/);
      });
    });

    it('resets the description scroll offset on collapse and on slide change', () => {
      fakeOverflow(true);
      const desc = root().querySelector('.billboard__desc') as HTMLElement;
      toggle()!.click();
      fixture.detectChanges();
      desc.scrollTop = 180;
      toggle()!.click();
      fixture.detectChanges();
      expect(desc.scrollTop).toBe(0);
      desc.scrollTop = 90;
      expect(desc.scrollTop).toBe(90);
      component['reduceMotion'] = true;
      (root().querySelectorAll('button.billboard__dot')[1] as HTMLButtonElement).click();
      fixture.detectChanges();
      expect(component['featured']()?.id).toBe('b');
      expect(desc.scrollTop).toBe(0);
    });

    it('re-measures overflow once web fonts are ready', async () => {
      let resolveFonts!: () => void;
      const ready = new Promise<void>((resolve) => (resolveFonts = resolve));
      const original = Object.getOwnPropertyDescriptor(document, 'fonts');
      Object.defineProperty(document, 'fonts', { configurable: true, value: { ready } });
      try {
        const late = TestBed.createComponent(HomepageHeroComponent);
        late.componentRef.setInput('slides', [ep('a', { episodeDescription: longDesc }), ep('b'), ep('c')]);
        late.detectChanges();
        const lateRoot = late.nativeElement as HTMLElement;
        const desc = lateRoot.querySelector('.billboard__desc') as HTMLElement;
        expect(lateRoot.querySelector('button.billboard__desc-toggle')).toBeNull();

        Object.defineProperty(desc, 'clientHeight', { configurable: true, value: 100 });
        Object.defineProperty(desc, 'scrollHeight', { configurable: true, value: 240 });
        resolveFonts();
        await ready;
        await Promise.resolve();
        late.detectChanges();

        expect(lateRoot.querySelector('button.billboard__desc-toggle')).toBeTruthy();
        late.componentInstance['stopHeroCycle']();
        late.destroy();
      } finally {
        if (original) {
          Object.defineProperty(document, 'fonts', original);
        } else {
          delete (document as unknown as { fonts?: unknown }).fonts;
        }
      }
    });

    it('expands in place and pauses rotation, then collapses and resumes', () => {
      fakeOverflow(true);
      component['heroPaused'].set(false);

      toggle()!.click();
      fixture.detectChanges();
      const desc = root().querySelector('.billboard__desc') as HTMLElement;
      expect(desc.classList.contains('is-expanded')).toBe(true);
      expect(desc.textContent).toBe(longDesc);
      expect(toggle()!.querySelector('mat-icon')?.textContent?.trim()).toBe('expand_less');
      expect(toggle()!.getAttribute('aria-label')).toBe('Collapse description');
      expect(toggle()!.getAttribute('aria-expanded')).toBe('true');
      expect(component['heroPaused']()).toBe(true);

      toggle()!.click();
      fixture.detectChanges();
      expect(desc.classList.contains('is-expanded')).toBe(false);
      expect(toggle()!.getAttribute('aria-expanded')).toBe('false');
      expect(component['heroPaused']()).toBe(false);
    });

    it('does not auto-advance while the description is expanded', () => {
      fakeOverflow(true);
      vi.useFakeTimers();
      component['reduceMotion'] = false;
      component['heroPaused'].set(false);
      component['heroImageReady'].set(true);
      component['heroIndex'].set(0);
      component['lastFeaturedId'] = 'a';
      toggle()!.click();
      component['startHeroCycle']();

      vi.advanceTimersByTime(7500 * 2 + 1000);
      expect(component['heroIndex']()).toBe(0);
    });

    it('collapses again when the slide changes', () => {
      fakeOverflow(true);
      component['reduceMotion'] = true;
      toggle()!.click();
      fixture.detectChanges();
      expect(component['descExpanded']()).toBe(true);

      (root().querySelectorAll('button.billboard__dot')[1] as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(component['featured']()?.id).toBe('b');
      expect(component['descExpanded']()).toBe(false);
      expect(root().querySelector('.billboard__desc')?.classList.contains('is-expanded')).toBe(false);
    });
  });
});
