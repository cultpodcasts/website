import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { PLATFORM_ID, provideZonelessChangeDetection, Type } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { EpisodeService } from './episode.service';
import { GuidService } from './guid.service';
import { SeoService } from './seo.service';
import { FilmPageComponent } from './film-page/film-page.component';
import { TvShowEpisodeComponent } from './tv-show-episode/tv-show-episode.component';
import { NewsReportComponent } from './news-report/news-report.component';

const id = '00112233-4455-4677-8899-aabbccddeeff';

async function renderMissing(component: Type<unknown>): Promise<string> {
  const params = { slug: 'Synthetic', query: 'synthetic-short-id' };
  await TestBed.configureTestingModule({
    imports: [component],
    providers: [
      provideZonelessChangeDetection(),
      provideRouter([]),
      { provide: PLATFORM_ID, useValue: 'browser' },
      { provide: ActivatedRoute, useValue: { params: of(params), queryParams: of({}), snapshot: { params } } },
      { provide: GuidService, useValue: { parseCatalogueShortId: () => ({ id, contentKind: null }), getEpisodeUuid: () => id } },
      { provide: SeoService, useValue: { AddMetaTags: () => undefined } },
      { provide: EpisodeService, useValue: { GetEpisodeDetailsFromApi: async () => undefined, getPlayableById: async () => undefined } },
      { provide: MatDialog, useValue: { open: vi.fn() } },
      { provide: MatSnackBar, useValue: { open: vi.fn() } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(component);
  fixture.detectChanges();
  await fixture.whenStable();
  await new Promise(resolve => setTimeout(resolve));
  fixture.detectChanges();
  return (fixture.nativeElement as HTMLElement).querySelector('.browse-empty h2')?.textContent?.trim() ?? '';
}

describe('kind-specific not-found text', () => {
  it('a missing film says Film not found', async () => {
    expect(await renderMissing(FilmPageComponent)).toBe('Film not found.');
  });

  it('a missing TV show episode says TV episode not found', async () => {
    expect(await renderMissing(TvShowEpisodeComponent)).toBe('TV episode not found.');
  });

  it('a missing news report says News report not found', async () => {
    expect(await renderMissing(NewsReportComponent)).toBe('News report not found.');
  });
});
