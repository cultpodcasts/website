import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { DeferBlockState } from '@angular/core/testing';
import { of } from 'rxjs';
import { NewsOrganisationComponent } from './news-organisation.component';
import { ODataService } from '../odata.service';
import { PlayerService } from '../player.service';
import { SeoService } from '../seo.service';
import { IPageDetails } from '../page-details.interface';

describe('NewsOrganisationComponent', () => {
  it('sets hub SEO on the shell, defers the list, then reads the slug and shows the report title', async () => {
    const calls: { filter?: string }[] = [];
    const titles: string[] = [];
    TestBed.configureTestingModule({
      imports: [NewsOrganisationComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { params: of({ slug: 'Desk' }), snapshot: { params: { slug: 'Desk' } } } },
        {
          provide: ODataService,
          useValue: {
            getEntities: (_url: string, request: { filter?: string }) => {
              calls.push(request);
              return of({
                entities: [{
                  id: 'report-1',
                  title: 'Bulletin',
                  seriesName: 'Desk',
                  description: 'Lead',
                  release: new Date('2026-01-02T00:00:00Z'),
                  duration: '00:05:00',
                  contentKind: 'NewsReport',
                }],
              });
            },
          },
        },
        { provide: PlayerService, useValue: { play: () => undefined, episode: () => undefined, mode: () => 'dock', isQueuedId: () => false, queuedKeys: () => new Set<string>() } },
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
    const fixture = TestBed.createComponent(NewsOrganisationComponent);
    fixture.detectChanges();
    expect(titles).toEqual(['Desk']);
    expect(calls).toHaveLength(0);
    expect(fixture.nativeElement.querySelector('[aria-label="Loading news organisation"]')).toBeTruthy();
    const [hub] = await fixture.getDeferBlocks();
    await hub.render(DeferBlockState.Complete);
    fixture.detectChanges();
    expect(calls[0].filter).toContain("(seriesName eq 'Desk')");
    expect(fixture.nativeElement.textContent).toContain('Desk');
    expect(fixture.nativeElement.textContent).toContain('Bulletin');
  });
});
