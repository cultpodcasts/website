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
import { SearchEngine } from '../search-engine.enum';
import { SearchResult } from '../search-result.interface';
import { SiteService } from '../site.service';
import { HeroDescriptionComponent } from '../hero-description/hero-description.component';
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

  it('#703: leaves the D1 clamp to app-hero-description (no six-line --d1 rule in the shell)', () => {
    expect(shellSass).not.toMatch(/\.episode-hero__desc--d1/);
    expect(shellSass).not.toMatch(/line-clamp:\s*6/);
  });
});

async function renderShell(playable: SearchResult, withDescription = false) {
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
      set: { imports: withDescription ? [SearchDescriptionPipe, HeroDescriptionComponent] : [SearchDescriptionPipe], schemas: [NO_ERRORS_SCHEMA] }
    })
    .compileComponents();

  const fixture = TestBed.createComponent(PlayableDetailShellComponent);
  fixture.componentRef.setInput('playable', playable);
  fixture.componentRef.setInput('includeParentRail', false);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

describe('PlayableDetailShellComponent description clamp (#702 / #703)', () => {
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

  async function renderDesc(result: SearchResult) {
    const fixture = await renderShell(result, true);
    const host = (fixture.nativeElement as HTMLElement).querySelector('app-hero-description.episode-hero__desc');
    expect(host).not.toBeNull();
    return host as HTMLElement;
  }

  it('renders an Azure hit unclamped with no expander', async () => {
    const host = await renderDesc(playable(SearchEngine.Azure));
    expect(host.classList.contains('is-clamped')).toBe(false);
    expect(host.querySelector('.hero-desc__text')?.textContent).toBe('A short description.');
    expect(host.querySelector('button.hero-desc__toggle')).toBeNull();
  });

  it('renders a missing-engine hit unclamped (older API deploys)', async () => {
    const host = await renderDesc(playable());
    expect(host.classList.contains('is-clamped')).toBe(false);
  });

  it('clamps a D1 hit with the homepage hero clamp', async () => {
    const host = await renderDesc(playable(SearchEngine.D1));
    expect(host.classList.contains('is-clamped')).toBe(true);
    expect(host.querySelector('.hero-desc__text')?.classList.contains('is-clamped')).toBe(true);
  });

  it('#703: passes a D1 description through in full (no character cap, like the homepage), not the Azure 180', async () => {
    const long = 'word '.repeat(12_000).trim();
    expect(long.length).toBeGreaterThan(50_000);
    const result = { ...playable(SearchEngine.D1), episodeDescription: long };
    const host = await renderDesc(result);
    expect(host.querySelector('.hero-desc__text')?.textContent).toBe(long);
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
