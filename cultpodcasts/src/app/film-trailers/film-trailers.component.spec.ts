import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { FilmTrailersComponent } from './film-trailers.component';

describe('FilmTrailersComponent', () => {
  let fixture: ComponentFixture<FilmTrailersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FilmTrailersComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
    fixture = TestBed.createComponent(FilmTrailersComponent);
  });

  it('lists each trailer as an outbound link with its duration, in order', async () => {
    fixture.componentRef.setInput('trailers', [
      '00:02:11|https://www.youtube.com/watch?v=synthetic01|Synthetic Teaser',
      '00:00:45|https://archive.org/details/synthetic-clip|Synthetic Clip',
    ]);
    fixture.detectChanges();
    await fixture.whenStable();

    const anchors = Array.from(fixture.nativeElement.querySelectorAll('a')) as HTMLAnchorElement[];
    expect(anchors.map(a => a.textContent?.trim())).toEqual(['Synthetic Teaser', 'Synthetic Clip']);
    expect(anchors[0].href).toBe('https://www.youtube.com/watch?v=synthetic01');
    expect(anchors[0].target).toBe('_blank');
    expect(anchors[0].rel).toContain('noopener');
    expect(fixture.nativeElement.querySelector('.duration')?.textContent?.trim()).toBe('2:11');
  });

  it('renders nothing when the film has no trailers', async () => {
    fixture.componentRef.setInput('trailers', undefined);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('section')).toBeNull();
  });
});
