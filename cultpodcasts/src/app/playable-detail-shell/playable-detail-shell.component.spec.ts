import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NO_ERRORS_SCHEMA, PLATFORM_ID, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { ODataService } from '../odata.service';
import { PlayerService } from '../player.service';
import { SearchDescriptionPipe } from '../search-description.pipe';
import { SearchResult } from '../search-result.interface';
import { SiteService } from '../site.service';
import { PlayableDetailShellComponent } from './playable-detail-shell.component';

const shellDir = dirname(fileURLToPath(import.meta.url));
const shellSass = readFileSync(join(shellDir, 'playable-detail-shell.component.sass'), 'utf8').replaceAll(
  '\r\n',
  '\n',
);

describe('PlayableDetailShellComponent Sass contracts', () => {
  it('keeps the Firefox soft-wash on episode backdrop edges (no scaleX streak path)', () => {
    // Same fragile CSS as homepage hero-stage — item pages must lock it independently.
    expect(shellSass).toMatch(/@supports \(-moz-appearance: none\)[\s\S]*?transform: none/);
    expect(shellSass).toMatch(/@supports \(-moz-appearance: none\)[\s\S]*?blur\(36px\)/);
  });

  function sassBlock(selector: string): string {
    const start = shellSass.indexOf(selector + '\n');
    expect(start).toBeGreaterThanOrEqual(0);
    const next = shellSass.indexOf('\n.episode-hero__', start + 1);
    return shellSass.slice(start, next === -1 ? undefined : next);
  }

  it('does not clamp the base episode hero description (Azure / missing-engine)', () => {
    const slice = sassBlock('.episode-hero__desc');
    expect(slice).not.toMatch(/line-clamp/);
    expect(slice).not.toMatch(/-webkit-box/);
    expect(slice).not.toMatch(/overflow:\s*hidden/);
  });

  it('clamps D1 episode hero descriptions to six lines on the --d1 modifier', () => {
    const slice = sassBlock('.episode-hero__desc--d1');
    expect(slice).toMatch(/display:\s*-webkit-box/);
    expect(slice).toMatch(/-webkit-box-orient:\s*vertical/);
    expect(slice).toMatch(/-webkit-line-clamp:\s*6/);
    expect(slice).toMatch(/line-clamp:\s*6/);
    expect(slice).toMatch(/overflow:\s*hidden/);
  });
});

async function renderShell(playable: SearchResult) {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [PlayableDetailShellComponent],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: PLATFORM_ID, useValue: 'server' },
      { provide: ActivatedRoute, useValue: { params: of({}), queryParams: of({}) } },
      { provide: AuthServiceWrapper, useValue: { roles: of([] as string[]) } },
      { provide: MatSnackBar, useValue: { open: () => undefined } },
      { provide: MatDialog, useValue: { open: () => undefined } },
      { provide: SiteService, useValue: { setQuery() {}, setPodcast() {}, setSubject() {} } },
      { provide: ODataService, useValue: { getEntities: () => of({ entities: [] }) } },
      { provide: PlayerService, useValue: { episode: () => undefined, mode: () => 'dock', play: () => undefined } }
    ]
  })
    .overrideComponent(PlayableDetailShellComponent, {
      set: { imports: [SearchDescriptionPipe], schemas: [NO_ERRORS_SCHEMA] }
    })
    .compileComponents();

  const fixture = TestBed.createComponent(PlayableDetailShellComponent);
  fixture.componentRef.setInput('playable', playable);
  fixture.componentRef.setInput('includeParentRail', false);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

describe('PlayableDetailShellComponent D1 description clamp class', () => {
  function playable(searchEngine?: SearchResult['searchEngine']): SearchResult {
    const result: SearchResult = {
      id: 'ep-1',
      episodeTitle: 'Faderhuset',
      episodeDescription: 'A short description.',
      podcastName: 'Cults',
      duration: '01:30:00',
      release: new Date('2026-11-19T00:00:00Z'),
      subjects: [],
    };
    if (searchEngine !== undefined) {
      result.searchEngine = searchEngine;
    }
    return result;
  }

  async function descClassList(result: SearchResult) {
    const fixture = await renderShell(result);
    const desc = (fixture.nativeElement as HTMLElement).querySelector('.episode-hero__desc');
    expect(desc).not.toBeNull();
    return desc!.classList;
  }

  it('does not add the D1 clamp class for an Azure hit', async () => {
    expect((await descClassList(playable('azure'))).contains('episode-hero__desc--d1')).toBe(false);
  });

  it('does not add the D1 clamp class when searchEngine is missing', async () => {
    expect((await descClassList(playable())).contains('episode-hero__desc--d1')).toBe(false);
  });

  it('adds the D1 clamp class for a D1 hit', async () => {
    expect((await descClassList(playable('d1'))).contains('episode-hero__desc--d1')).toBe(true);
  });
});

describe('PlayableDetailShellComponent Also known as expander', () => {
  const titles = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven'];

  function film(id: string): SearchResult {
    return {
      id,
      episodeTitle: 'Faderhuset',
      episodeDescription: '',
      podcastName: '',
      duration: '01:30:00',
      release: new Date('2026-11-19T00:00:00Z'),
      subjects: [],
      contentKind: 'Film',
      alternativeTitles: titles
    } as SearchResult;
  }

  it('shows the first 5 titles, expands the rest with +N more, and starts collapsed again on another film', async () => {
    const fixture = await renderShell(film('film-a'));
    const root = fixture.nativeElement as HTMLElement;
    const aka = () => root.querySelector('#film-aka') as HTMLElement;
    const button = () => aka().querySelector('.episode-hero__aka-more') as HTMLButtonElement;

    expect(aka().textContent).toContain('One · Two · Three · Four · Five');
    expect(aka().textContent).not.toContain('Six');
    expect(button().textContent?.replace(/\s+/g, ' ').trim()).toBe('+2 more');
    expect(button().getAttribute('aria-expanded')).toBe('false');

    button().click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(aka().textContent).toContain('Six · Seven');
    expect(button().textContent?.replace(/\s+/g, ' ').trim()).toBe('Show less');
    expect(button().getAttribute('aria-expanded')).toBe('true');

    fixture.componentRef.setInput('playable', film('film-b'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(aka().textContent).not.toContain('Six');
    expect(button().textContent?.replace(/\s+/g, ' ').trim()).toBe('+2 more');
    expect(button().getAttribute('aria-expanded')).toBe('false');
  });
});
