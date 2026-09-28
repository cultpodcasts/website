import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { DeferBlockState } from '@angular/core/testing';
import { of } from 'rxjs';
import { TvShowComponent } from './tv-show.component';
import { ODataService } from '../odata.service';
import { PlayerService } from '../player.service';
import { SeoService } from '../seo.service';
import { IPageDetails } from '../page-details.interface';

describe('TvShowComponent', () => {
  it('sets hub SEO on the shell, defers the list, then reads the slug and lists that show', async () => {
    const calls: { filter?: string }[] = [];
    const titles: string[] = [];
    TestBed.configureTestingModule({
      imports: [TvShowComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { params: of({ slug: 'Nightly' }), snapshot: { params: { slug: 'Nightly' } } } },
        {
          provide: ODataService,
          useValue: {
            getEntities: (_url: string, request: { filter?: string }) => {
              calls.push(request);
              return of({ entities: [] });
            },
          },
        },
        { provide: PlayerService, useValue: { play: () => undefined, episode: () => undefined, mode: () => 'dock' } },
        {
          provide: SeoService,
          useValue: {
            AddMetaTags: (details: IPageDetails) => {
              if (details.title) {
                titles.push(details.title);
              }
            },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(TvShowComponent);
    fixture.detectChanges();
    expect(titles).toEqual(['Nightly']);
    expect(calls).toHaveLength(0);
    expect(fixture.nativeElement.querySelector('[aria-label="Loading TV show"]')).toBeTruthy();
    const [hub] = await fixture.getDeferBlocks();
    await hub.render(DeferBlockState.Complete);
    fixture.detectChanges();
    expect(calls[0].filter).toContain("(seriesName eq 'Nightly')");
    expect(fixture.nativeElement.textContent).toContain('Nightly');
  });
});
