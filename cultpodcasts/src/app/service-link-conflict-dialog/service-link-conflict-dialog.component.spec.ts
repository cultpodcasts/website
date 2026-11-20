import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  ServiceLinkConflictDialogComponent,
  ServiceLinkConflictPrompt
} from './service-link-conflict-dialog.component';

describe('ServiceLinkConflictDialogComponent', () => {
  const close = vi.fn();

  async function render(prompt: ServiceLinkConflictPrompt): Promise<ComponentFixture<ServiceLinkConflictDialogComponent>> {
    TestBed.resetTestingModule();
    close.mockReset();
    await TestBed.configureTestingModule({
      imports: [ServiceLinkConflictDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MatDialogRef, useValue: { close } },
        { provide: MAT_DIALOG_DATA, useValue: prompt }
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(ServiceLinkConflictDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  const prompt: ServiceLinkConflictPrompt = {
    episodeId: '7d5f6a1e-2b3c-4d5e-8f90-1a2b3c4d5e6f',
    episodeTitle: 'Synthetic Episode',
    episodeRelease: '2026-01-02T23:30:00Z',
    links: [
      {
        service: 'spotify',
        storedUrl: 'https://open.spotify.com/episode/storedstoredstoredstor',
        submittedUrl: 'https://open.spotify.com/episode/abcdefghijklmnopqrstuv'
      },
      { service: 'apple', storedUrl: 'https://podcasts.apple.com/podcast/id1?i=2', submittedUrl: null }
    ]
  };

  it('shows the stored episode, its UTC release day and each stored and submitted link', async () => {
    const fixture = await render(prompt);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Synthetic Episode');
    expect(text).toContain('2 Jan 2026');
    expect(text).toContain('Spotify');
    expect(text).toContain('Apple Podcasts');
    expect(text).toContain('https://open.spotify.com/episode/storedstoredstoredstor');
    expect(text).toContain('https://open.spotify.com/episode/abcdefghijklmnopqrstuv');
    expect(text).toContain('Submitted: none');
    expect(text).toContain('Nothing has been changed yet');
  });

  it.each([
    ['Overwrite', 'overwrite'],
    ['Create new episode', 'create-new'],
    ['Cancel', 'cancel']
  ])('closes with %s', async (label, answer) => {
    const fixture = await render(prompt);
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    buttons.find(b => b.textContent?.trim() === label)!.click();
    expect(close).toHaveBeenCalledWith(answer);
  });
});
