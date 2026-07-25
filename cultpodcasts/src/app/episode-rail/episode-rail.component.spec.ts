import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EpisodeRailComponent } from './episode-rail.component';
import { SearchDisplayEpisode } from '../search-result-links';

function ep(id: string): SearchDisplayEpisode {
  return {
    id,
    podcastName: `Show ${id}`,
    episodeTitle: `Episode ${id}`,
    episodeDescription: `Desc ${id}`,
    release: new Date(),
    duration: '01:00:00',
    subjects: [`Subject ${id}`],
  };
}

describe('EpisodeRailComponent', () => {
  let fixture: ComponentFixture<EpisodeRailComponent>;
  let component: EpisodeRailComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EpisodeRailComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(EpisodeRailComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('title', 'Tuesday 1 January');
    fixture.componentRef.setInput('episodes', [ep('a'), ep('b')]);
    fixture.detectChanges();
  });

  it('renders a plain heading when titleLink is absent', () => {
    const heading = fixture.nativeElement.querySelector('h2.rail__title');
    expect(heading?.textContent?.trim()).toBe('Tuesday 1 January');
    expect(fixture.nativeElement.querySelector('a.rail__title--link')).toBeNull();
  });

  it('renders a linked title and browse-all when titleLink / browseAllLink are set', () => {
    fixture.componentRef.setInput('title', 'Scientology');
    fixture.componentRef.setInput('subject', 'Scientology');
    fixture.componentRef.setInput('titleLink', ['/subject', 'Scientology']);
    fixture.componentRef.setInput('browseAllLink', ['/subject', 'Scientology']);
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector('a.rail__title--link') as HTMLAnchorElement | null;
    expect(link?.textContent).toContain('Scientology');
    expect(fixture.nativeElement.querySelector('a.rail__see-all')?.textContent?.trim()).toBe('Browse all');
  });

  it('emits pinToggle for the subject when the pin control is clicked', () => {
    const pins: string[] = [];
    component.pinToggle.subscribe((subject) => pins.push(subject));

    fixture.componentRef.setInput('title', 'Scientology');
    fixture.componentRef.setInput('subject', 'Scientology');
    fixture.componentRef.setInput('titleLink', ['/subject', 'Scientology']);
    fixture.componentRef.setInput('showPin', true);
    fixture.detectChanges();

    const pin = fixture.nativeElement.querySelector('button.rail__pin') as HTMLButtonElement;
    pin.click();
    expect(pins).toEqual(['Scientology']);
  });

  it('marks posters as promoted from promotedIds', () => {
    fixture.componentRef.setInput('showPromote', true);
    fixture.componentRef.setInput('promotedIds', new Set(['a']));
    fixture.detectChanges();

    const posters = fixture.nativeElement.querySelectorAll('app-episode-poster');
    expect(posters.length).toBe(2);
    expect(posters[0].classList.contains('episode-poster')).toBe(true);
  });
});
