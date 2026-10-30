import { provideZonelessChangeDetection, type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { registerSvgIcons } from './register-svg-icons';
import { svgIconLiterals } from './svg-icon-literals';
import { serviceDescriptor } from './service-catalog';
import { EpisodeLinksComponent } from './episode-links/episode-links.component';
import { EpisodeImageComponent } from './episode-image/episode-image.component';
import { EpisodePodcastLinksComponent } from './episode-podcast-links/episode-podcast-links.component';
import { HomepageEpisode } from './homepage-episode.interface';
import { ApiEpisode } from './api-episode.interface';

/**
 * ABC iview service icon: the live app-icon mark (white ABC lissajous over the iview
 * wordmark on the iview teal tile), not the old black tile with tiny "iview" <text>.
 * Synthetic episodes only.
 */
const IVIEW_TEAL = '#2FB7B6';
const SYNTHETIC_IVIEW = 'https://iview.abc.net.au/video/ZZ0000H000S00';
const SYNTHETIC_YOUTUBE = 'https://www.youtube.com/watch?v=inventedTv';

function literal(name: string): string {
  const svg = new Map(svgIconLiterals).get(name);
  expect(svg, name).toBeTruthy();
  return svg!;
}

/** The new mark, as rendered by mat-icon from the registry. */
function expectIviewMark(icon: Element | null | undefined): void {
  expect(icon, 'abc-iview mat-icon').toBeTruthy();
  expect(icon!.getAttribute('data-mat-icon-name')).toBe('abc-iview');
  const svg = icon!.querySelector('svg');
  expect(svg, 'abc-iview svg').toBeTruthy();
  expect(svg!.getAttribute('viewBox')).toBe('0 0 24 24');
  const tile = svg!.querySelector('rect');
  expect(tile?.getAttribute('fill')).toBe(IVIEW_TEAL);
  expect(tile?.getAttribute('rx')).toBe('5.4');
  // Lissajous + wordmark as vector paths, no font-dependent <text>.
  expect(svg!.querySelectorAll('text')).toHaveLength(0);
  const paths = Array.from(svg!.querySelectorAll('path'));
  expect(paths).toHaveLength(2);
  for (const p of paths) {
    expect(p.getAttribute('fill')).toBe('#fff');
  }
}

describe('ABC iview service icon', () => {
  it('is the teal app-icon tile with the lissajous and wordmark paths, the same 24x24 / rx 5.4 tile as the other services', () => {
    const svg = literal('abc-iview');
    expect(svg).toContain('viewBox="0 0 24 24"');
    expect(svg).toContain(`<rect width="24" height="24" rx="5.4" fill="${IVIEW_TEAL}"/>`);
    expect(svg).not.toContain('<text');
    expect(svg).not.toContain('fill="#000"');
    expect(svg.match(/<path /g)).toHaveLength(2);
    // Every streaming tile shares the 24x24 rx 5.4 frame.
    for (const name of ['netflix', 'channel4', 'tubi']) {
      expect(literal(name)).toContain('rx="5.4"');
    }
    expect(serviceDescriptor('abcIview')).toEqual(
      expect.objectContaining({ displayName: 'ABC iview', icon: 'abc-iview' }));
    expect(serviceDescriptor('iviewabcnetau').icon).toBe('abc-iview');
  });

  describe('rendered through the registry', () => {
    beforeEach(async () => {
      await TestBed.configureTestingModule({
        imports: [EpisodeLinksComponent, EpisodeImageComponent, EpisodePodcastLinksComponent],
        providers: [provideZonelessChangeDetection()],
      }).compileComponents();
      registerSvgIcons(TestBed.inject(MatIconRegistry), TestBed.inject(DomSanitizer));
    });

    function tvEpisode(overrides: Partial<HomepageEpisode> = {}): HomepageEpisode {
      return {
        id: '00000000-0000-4000-8000-0000000000a1',
        podcastName: 'Invented TV Show',
        episodeTitle: 'Invented TV episode',
        episodeDescription: 'Synthetic.',
        release: new Date('2026-10-01T00:00:00Z'),
        duration: '00:30:00',
        contentKind: 'TvShowEpisode',
        services: {
          youtube: { url: SYNTHETIC_YOUTUBE },
          abcIview: { url: SYNTHETIC_IVIEW },
        },
        ...overrides,
      } as HomepageEpisode;
    }

    async function render<T>(type: Type<T>, inputs: Record<string, unknown>): Promise<HTMLElement> {
      const fixture = TestBed.createComponent(type);
      for (const [k, v] of Object.entries(inputs)) {
        fixture.componentRef.setInput(k, v);
      }
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    it('hero and episode page (app-episode-links): ABC iview link after YouTube, labelled and showing the new mark', async () => {
      const root = await render(EpisodeLinksComponent, { episode: tvEpisode() });
      const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('#episodelinks a'));
      expect(links.map((a) => a.getAttribute('aria-label'))).toEqual(['YouTube', 'ABC iview']);
      expect(links[1].href).toBe(SYNTHETIC_IVIEW);
      expect(links[0].querySelector('mat-icon')?.getAttribute('data-mat-icon-name')).toBe('youtube');
      expectIviewMark(links[1].querySelector('mat-icon'));
    });

    it('legacy iviewabcnetau compact svc still shows the new mark', async () => {
      const root = await render(EpisodeLinksComponent, {
        episode: tvEpisode({ services: undefined, svc: `iviewabcnetau:u${SYNTHETIC_IVIEW}` } as Partial<HomepageEpisode>),
      });
      const link = root.querySelector<HTMLAnchorElement>('#episodelinks a[aria-label="ABC iview"]');
      expect(link?.href).toBe(SYNTHETIC_IVIEW);
      expectIviewMark(link?.querySelector('mat-icon'));
    });

    it('episode tile overlay (app-episode-image) labels and renders the new mark', async () => {
      const root = await render(EpisodeImageComponent, {
        searchResult: tvEpisode({ image: new URL('https://img.example.test/tv.png') }),
        linksOverlay: true,
      });
      const link = root.querySelector<HTMLAnchorElement>('.links a[aria-label="ABC iview"]');
      expect(link?.href).toBe(SYNTHETIC_IVIEW);
      expectIviewMark(link?.querySelector('mat-icon'));
    });

    it('curator episode list links (app-episode-podcast-links) render the new mark', async () => {
      const episode = {
        id: '00000000-0000-4000-8000-0000000000a2',
        title: 'Invented TV episode',
        services: { abcIview: { url: SYNTHETIC_IVIEW } },
      } as unknown as ApiEpisode;
      const root = await render(EpisodePodcastLinksComponent, { episode });
      const link = root.querySelector<HTMLAnchorElement>('a[aria-label="ABC iview"]');
      expect(link?.href).toBe(SYNTHETIC_IVIEW);
      expectIviewMark(link?.querySelector('mat-icon'));
    });
  });
});
