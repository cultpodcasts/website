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
    });
  }

  for (const kind of [undefined, null, '', 'Episode', 'Unknown']) {
    it(`renders nothing for ${JSON.stringify(kind)}`, () => {
      fixture.componentRef.setInput('kind', kind);
      fixture.detectChanges();
      expect(el().querySelector('.kind-badge')).toBeNull();
    });
  }

  it('HERO-SER-007: host is a real inline-flex item (not display:contents)', () => {
    fixture.componentRef.setInput('kind', 'NewsReport');
    fixture.detectChanges();
    expect(getComputedStyle(el()).display).toBe('inline-flex');
  });
});
