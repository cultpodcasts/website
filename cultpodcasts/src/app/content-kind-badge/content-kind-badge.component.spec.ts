import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ContentKindBadgeComponent } from './content-kind-badge.component';

describe('ContentKindBadgeComponent (HERO-KND-001)', () => {
  let fixture: ComponentFixture<ContentKindBadgeComponent>;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ContentKindBadgeComponent] }).compileComponents();
    fixture = TestBed.createComponent(ContentKindBadgeComponent);
  });

  for (const [kind, icon, label] of [
    ['NewsReport', 'newspaper', 'News'],
    ['TvShowEpisode', 'live_tv', 'TV'],
    ['Film', 'movie', 'Film'],
  ] as const) {
    it(`renders the ${icon} icon and "${label}" for ${kind}`, () => {
      fixture.componentRef.setInput('kind', kind);
      fixture.detectChanges();
      const badge = el().querySelector('.kind-badge') as HTMLElement;
      expect(badge.querySelector('mat-icon')?.textContent?.trim()).toBe(icon);
      expect(badge.querySelector('mat-icon')?.getAttribute('aria-hidden')).toBe('true');
      expect(badge.textContent?.replace(icon, '').trim()).toBe(label);
      expect(el().querySelector('.kind-badge__sep')).toBeNull();
    });
  }

  for (const kind of [undefined, null, '', 'Episode', 'Unknown']) {
    it(`renders nothing for ${JSON.stringify(kind)}`, () => {
      fixture.componentRef.setInput('kind', kind);
      fixture.componentRef.setInput('separator', true);
      fixture.detectChanges();
      expect(el().querySelector('.kind-badge')).toBeNull();
      expect(el().querySelector('.kind-badge__sep')).toBeNull();
    });
  }

  it('puts an aria-hidden middle dot in front when separator is set', () => {
    fixture.componentRef.setInput('kind', 'NewsReport');
    fixture.componentRef.setInput('separator', true);
    fixture.detectChanges();
    const sep = el().querySelector('.kind-badge__sep') as HTMLElement;
    expect(sep.textContent).toBe('\u00b7');
    expect(sep.getAttribute('aria-hidden')).toBe('true');
    expect(sep.nextElementSibling?.classList.contains('kind-badge')).toBe(true);
  });
});
