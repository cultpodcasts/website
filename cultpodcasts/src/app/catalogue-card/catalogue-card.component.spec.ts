import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { CatalogueCardComponent } from './catalogue-card.component';
import { GuidService } from '../guid.service';
import { PlayerService } from '../player.service';
import { SearchDisplayEpisode } from '../search-result-links';

const id = '00112233-4455-4677-8899-aabbccddeeff';

describe('catalogue card hrefs', () => {
  const guids = new GuidService();

  async function hrefs(episode: SearchDisplayEpisode): Promise<string[]> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [CatalogueCardComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: PlayerService, useValue: { episode: () => undefined, play: () => undefined } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(CatalogueCardComponent);
    fixture.componentRef.setInput('episode', episode);
    fixture.detectChanges();
    await fixture.whenStable();
    return Array.from(fixture.nativeElement.querySelectorAll('a[href]') as NodeListOf<HTMLAnchorElement>)
      .map(a => a.getAttribute('href') ?? '');
  }

  function item(contentKind: string, podcastName = 'Desk', episodeTitle = 'Bulletin'): SearchDisplayEpisode {
    return {
      id, contentKind, podcastName, episodeTitle,
      episodeDescription: '', release: new Date('2026-01-02T00:00:00Z'), duration: '00:10:00', subjects: [],
    } as SearchDisplayEpisode;
  }

  it('links a news report card with its prefixed short id', async () => {
    const links = await hrefs(item('NewsReport'));
    expect(links).toContain(`/news/Desk/${guids.toCatalogueShortId(id, 'NewsReport')}`);
    expect(links.some(h => h.includes(id))).toBe(false);
  });

  it('links a TV episode card with its prefixed short id', async () => {
    const links = await hrefs(item('TvShowEpisode', 'Nightly'));
    expect(links).toContain(`/tv/Nightly/${guids.toCatalogueShortId(id, 'TvShowEpisode')}`);
    expect(links.some(h => h.includes(id))).toBe(false);
  });

  it('links a film card with its prefixed short id', async () => {
    const links = await hrefs(item('Film', '', 'One Off'));
    expect(links).toContain(`/film/One%20Off/${guids.toCatalogueShortId(id, 'Film')}`);
    expect(links.some(h => h.includes(id))).toBe(false);
  });

  it('links a podcast episode card with its unprefixed short id, never the raw guid', async () => {
    const links = await hrefs(item('Episode', 'Show', 'Ep'));
    expect(links).toContain(`/podcast/Show/${guids.toBase64(id)}`);
    expect(links).toContain('/podcast/Show');
    expect(links.some(h => h.includes(id))).toBe(false);
  });
});

describe('catalogue card kind byline and hero star', () => {
  async function render(episode: SearchDisplayEpisode, inputs: Record<string, unknown> = {}) {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [CatalogueCardComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: PlayerService, useValue: { episode: () => undefined, play: () => undefined } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(CatalogueCardComponent);
    fixture.componentRef.setInput('episode', episode);
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
    await fixture.whenStable();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  function item(contentKind: string, podcastName = 'Synthetic Desk', episodeTitle = 'Bulletin'): SearchDisplayEpisode {
    return {
      id, contentKind, podcastName, episodeTitle,
      episodeDescription: '', release: new Date('2026-01-02T00:00:00Z'), duration: '00:10:00', subjects: [],
      services: { youtube: { url: 'https://www.youtube.com/watch?v=synthetic01' } },
    } as unknown as SearchDisplayEpisode;
  }

  it('shows the newspaper icon before a news report\'s outlet name, linking to the outlet', async () => {
    const { root } = await render(item('NewsReport'));
    const show = root.querySelector('a.episode-poster__show') as HTMLAnchorElement;
    expect(show.getAttribute('href')).toBe('/news/Synthetic%20Desk');
    expect(show.querySelector('mat-icon')?.textContent?.trim()).toBe('newspaper');
    expect(show.textContent).toContain('Synthetic Desk');
  });

  it('shows the live_tv icon before a TV episode\'s show name', async () => {
    const { root } = await render(item('TvShowEpisode', 'Synthetic Show'));
    const show = root.querySelector('a.episode-poster__show') as HTMLAnchorElement;
    expect(show.getAttribute('href')).toBe('/tv/Synthetic%20Show');
    expect(show.querySelector('mat-icon')?.textContent?.trim()).toBe('live_tv');
  });

  it('labels a film "Film" with the movie icon and no parent link (a film has no parent)', async () => {
    const { root } = await render(item('Film', 'Synthetic Film', 'Synthetic Film'));
    expect(root.querySelector('a.episode-poster__show')).toBeNull();
    const label = root.querySelector('.episode-poster__show--kind') as HTMLElement;
    expect(label.querySelector('mat-icon')?.textContent?.trim()).toBe('movie');
    expect(label.textContent).toContain('Film');
  });

  it('keeps podcast cards free of a kind icon', async () => {
    const { root } = await render(item('Episode', 'Synthetic Podcast'));
    expect(root.querySelector('.episode-poster__kind-icon')).toBeNull();
    expect(root.querySelector('a.episode-poster__show')?.textContent).toContain('Synthetic Podcast');
  });

  it('does not show the curator hero star on a film trailer, even when showPromote is set', async () => {
    const { root } = await render(item('FilmTrailer', '', 'Synthetic Teaser'), { showPromote: true, promoted: true });
    expect(root.querySelector('button.episode-poster__promote')).toBeNull();
  });

  for (const kind of ['NewsReport', 'TvShowEpisode', 'Film']) {
    it(`passes the curator hero star through to a ${kind} card and emits promoteToggle`, async () => {
      const { fixture, root } = await render(item(kind), { showPromote: true, promoted: true });
      const emitted: SearchDisplayEpisode[] = [];
      fixture.componentInstance.promoteToggle.subscribe(e => emitted.push(e));
      const star = root.querySelector('button.episode-poster__promote') as HTMLButtonElement;
      expect(star).toBeTruthy();
      expect(star.getAttribute('aria-pressed')).toBe('true');
      star.click();
      expect(emitted.map(e => e.id)).toEqual([id]);
    });
  }
});
