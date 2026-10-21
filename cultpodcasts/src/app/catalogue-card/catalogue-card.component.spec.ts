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

  it('keeps podcast episode cards on the guid path', async () => {
    const links = await hrefs(item('Episode', 'Show', 'Ep'));
    expect(links).toContain(`/podcast/Show/${id}`);
  });
});
