import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  AmbiguousIdentityCandidate,
  AmbiguousIdentityDialogComponent,
  AmbiguousIdentityPrompt
} from './ambiguous-identity-dialog.component';

describe('AmbiguousIdentityDialogComponent wording', () => {
  async function render(prompt: AmbiguousIdentityPrompt): Promise<ComponentFixture<AmbiguousIdentityDialogComponent>> {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [AmbiguousIdentityDialogComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: MAT_DIALOG_DATA, useValue: prompt }
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(AmbiguousIdentityDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  function candidate(overrides: Partial<AmbiguousIdentityCandidate> = {}): AmbiguousIdentityCandidate {
    return {
      key: 'tmdb:1',
      title: "Father's House",
      kind: 'Film',
      source: 'tmdb',
      ...overrides
    };
  }

  it('says a possible Film match was found when there is one candidate, such as Faderhuset to Father\'s House', async () => {
    const fixture = await render({
      target: 'Film',
      query: 'Faderhuset',
      candidates: [candidate()]
    });
    const text = fixture.nativeElement.textContent as string;
    expect(fixture.componentInstance.matchesFoundLead()).toBe(
      'A possible Film match was found for'
    );
    expect(text).toContain("A possible Film match was found for");
    expect(text).toContain('Faderhuset');
    expect(text).not.toContain('Several Film matches were found');
  });

  it('keeps Several when there is more than one Film candidate', async () => {
    const fixture = await render({
      target: 'Film',
      query: 'Faderhuset',
      candidates: [
        candidate(),
        candidate({ key: 'imdb:tt123', title: 'House of Holy Father', source: 'imdb' })
      ]
    });
    const text = fixture.nativeElement.textContent as string;
    expect(fixture.componentInstance.matchesFoundLead()).toBe(
      'Several Film matches were found for'
    );
    expect(text).toContain('Several Film matches were found for');
    expect(text).not.toContain('A possible Film match was found');
  });

  it('uses the same count wording for TV and news pickers', async () => {
    const tv = await render({
      target: 'TvShow',
      query: 'Cult Massacre',
      candidates: [candidate({ title: 'Cult Massacre', kind: 'TvShow' })]
    });
    expect(tv.componentInstance.matchesFoundLead()).toBe(
      'A possible TvShow match was found for'
    );
    expect(tv.nativeElement.textContent).toContain('A possible TvShow match was found for');

    const news = await render({
      target: 'News',
      query: 'Associated Press',
      candidates: [
        candidate({ key: 'n:1', title: 'Associated Press', kind: 'News' }),
        candidate({ key: 'n:2', title: 'AP', kind: 'News' })
      ]
    });
    expect(news.componentInstance.matchesFoundLead()).toBe(
      'Several News matches were found for'
    );
    expect(news.nativeElement.textContent).toContain('Several News matches were found for');
  });
});
