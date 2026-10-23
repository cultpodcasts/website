import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltip } from '@angular/material/tooltip';
import { DiscoveryResult } from '../discovery-result.interface';
import { DiscoveryItemComponent } from './discovery-item.component';

describe('DiscoveryItemComponent subject reasons', () => {
  let fixture: ComponentFixture<DiscoveryItemComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DiscoveryItemComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DiscoveryItemComponent);
  });

  function result(overrides: Partial<DiscoveryResult>): DiscoveryResult {
    return {
      id: 'b6f1c2d4-0000-4000-8000-000000000001',
      urls: { spotify: undefined, apple: undefined, youtube: undefined },
      episodeName: 'Episode',
      showName: 'Show',
      episodeDescription: 'Description',
      showDescription: undefined,
      released: new Date('2026-10-01T10:00:00Z'),
      duration: undefined,
      subjects: ['Scientology'],
      youTubeViews: undefined,
      youTubeChannelMembers: undefined,
      containsSyntheticMedia: undefined,
      guests: undefined,
      imageUrl: undefined,
      enrichedTimeFromApple: false,
      enrichedUrlFromSpotify: false,
      matchingPodcasts: null,
      acceptProbability: null,
      autoHidden: false,
      isFocused: undefined,
      ...overrides,
    } as DiscoveryResult;
  }

  async function render(item: DiscoveryResult): Promise<MatTooltip> {
    fixture.componentRef.setInput('result', item);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.debugElement.query(By.directive(MatTooltip)).injector.get(MatTooltip);
  }

  it('passes subjectMatches through so the subject chip explains why it matched', async () => {
    const tooltip = await render(result({
      subjectMatches: [{ subject: 'Scientology', term: 'Hubbard', source: 'Title' }],
    }));

    expect(tooltip.message).toBe('matched "Hubbard" in title');
    expect(tooltip.disabled).toBe(false);
  });

  it('keeps plain chips for older results where subjectMatches is null', async () => {
    const tooltip = await render(result({ subjectMatches: null }));

    expect(tooltip.disabled).toBe(true);
  });

  it('asks for confirmation and emits the card when the curator removes the podcast', async () => {
    const dialog = TestBed.inject(MatDialog);
    vi.mocked(dialog.open).mockReturnValue({ afterClosed: () => of({ result: true }) } as never);
    const item = result({ showName: 'Northwind Briefing' });
    const emitted: DiscoveryResult[] = [];
    fixture.componentInstance.removePodcast.subscribe(card => emitted.push(card));
    fixture.componentRef.setInput('result', item);
    fixture.detectChanges();
    await fixture.whenStable();

    const button = fixture.debugElement.query(By.css('button.ban-channel'));
    button.triggerEventHandler('click', new MouseEvent('click'));

    expect(dialog.open).toHaveBeenCalled();
    expect(emitted).toEqual([item]);
  });
});
