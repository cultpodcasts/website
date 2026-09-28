import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { NewsOrganisationComponent } from './news-organisation.component';
import { ODataService } from '../odata.service';
import { PlayerService } from '../player.service';

describe('NewsOrganisationComponent', () => {
  it('reads the slug, asks for that organisation, and shows the report title', () => {
    const calls: { filter?: string }[] = [];
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
      ],
    });
    const fixture = TestBed.createComponent(NewsOrganisationComponent);
    fixture.detectChanges();
    expect(calls[0].filter).toContain("(seriesName eq 'Desk')");
    expect(fixture.nativeElement.textContent).toContain('Desk');
    expect(fixture.nativeElement.textContent).toContain('Bulletin');
  });
});
