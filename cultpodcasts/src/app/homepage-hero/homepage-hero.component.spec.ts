import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HomepageHeroComponent } from './homepage-hero.component';
import { HomepageEpisode } from '../homepage-episode.interface';
import { PlayerService } from '../player.service';

function ep(id: string): HomepageEpisode {
  return {
    id,
    podcastName: `Show ${id}`,
    episodeTitle: `Episode ${id}`,
    episodeDescription: `Desc ${id}`,
    release: new Date(),
    duration: '01:00:00',
    spotify: undefined,
    apple: undefined,
    youtube: undefined,
    bbc: undefined,
    internetArchive: undefined,
    subjects: [`Subject ${id}`],
    image: undefined,
  };
}

describe('HomepageHeroComponent', () => {
  let fixture: ComponentFixture<HomepageHeroComponent>;
  let component: HomepageHeroComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomepageHeroComponent],
      providers: [
        provideRouter([]),
        { provide: PlayerService, useValue: { episode: () => undefined, play: () => undefined } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HomepageHeroComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('slides', [ep('a'), ep('b'), ep('c')]);
    fixture.componentRef.setInput('timeBucket', 1);
    fixture.detectChanges();
  });

  it('starts on timeBucket modulo slide count', () => {
    expect(component['heroIndex']()).toBe(1);
    expect(component['featured']()?.id).toBe('b');
  });

  it('keeps the featured episode when slides refresh with the same id', () => {
    component['heroIndex'].set(2);
    component['lastFeaturedId'] = 'c';
    fixture.detectChanges();
    expect(component['featured']()?.id).toBe('c');

    fixture.componentRef.setInput('slides', [ep('x'), ep('c'), ep('y')]);
    fixture.detectChanges();

    expect(component['featured']()?.id).toBe('c');
  });

  it('emits removeFeatured with the active slide id', () => {
    const removed: string[] = [];
    component.removeFeatured.subscribe((id) => removed.push(id));
    fixture.componentRef.setInput('isCurator', true);
    fixture.componentRef.setInput('curatedEpisodeIds', ['b']);
    fixture.componentRef.setInput('timeBucket', 1);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button.billboard__curate') as HTMLButtonElement | null;
    expect(button).toBeTruthy();
    button?.click();
    expect(removed).toEqual(['b']);
  });

  it('emits manageHero / manageRails from curator controls', () => {
    const managed: string[] = [];
    component.manageHero.subscribe(() => managed.push('hero'));
    component.manageRails.subscribe(() => managed.push('rails'));
    fixture.componentRef.setInput('isCurator', true);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll('button.billboard__manage') as NodeListOf<HTMLButtonElement>;
    expect(buttons.length).toBe(2);
    buttons[0].click();
    buttons[1].click();
    expect(managed).toEqual(['hero', 'rails']);
  });
});
