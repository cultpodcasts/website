import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { TvShowComponent } from './tv-show.component';
import { ODataService } from '../odata.service';
import { PlayerService } from '../player.service';

describe('TvShowComponent', () => {
  it('reads the slug and lists that show', () => {
    const calls: { filter?: string }[] = [];
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
      ],
    });
    const fixture = TestBed.createComponent(TvShowComponent);
    fixture.detectChanges();
    expect(calls[0].filter).toContain("(seriesName eq 'Nightly')");
    expect(fixture.nativeElement.textContent).toContain('Nightly');
  });
});
