import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { FormArray, FormControl } from '@angular/forms';
import { newYouTubeAlternateGroup, YouTubeAlternateEditGroup } from '../playable-edit-form.util';
import { FilmYouTubeAlternatesEditComponent } from './film-youtube-alternates-edit.component';

describe('FilmYouTubeAlternatesEditComponent', () => {
  let fixture: ComponentFixture<FilmYouTubeAlternatesEditComponent>;
  let alternates: FormArray<YouTubeAlternateEditGroup>;
  let promoteYouTubeId: FormControl<string>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FilmYouTubeAlternatesEditComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
    alternates = new FormArray([
      newYouTubeAlternateGroup('GSIPAfDO_ec', 'https://www.youtube.com/watch?v=GSIPAfDO_ec', 'Manic', 'True Crime Fix'),
    ]);
    promoteYouTubeId = new FormControl('', { nonNullable: true });
    fixture = TestBed.createComponent(FilmYouTubeAlternatesEditComponent);
    fixture.componentRef.setInput('alternates', alternates);
    fixture.componentRef.setInput('promoteYouTubeId', promoteYouTubeId);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('shows the channel and title of an existing upload', () => {
    const inputs = Array.from(fixture.nativeElement.querySelectorAll('input')) as HTMLInputElement[];
    expect(inputs.map(i => i.value)).toEqual(['True Crime Fix', 'Manic']);
  });

  it('adds a YouTube URL row, moves and removes, and marks the list dirty', async () => {
    const component = fixture.componentInstance;
    component.add();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(alternates.length).toBe(2);
    expect(alternates.at(1).controls.youTubeId.value).toBe('');
    component.move(0, 1);
    expect(alternates.getRawValue().map(row => row.youTubeId)).toEqual(['', 'GSIPAfDO_ec']);
    component.remove(0);
    expect(alternates.getRawValue().map(row => row.youTubeId)).toEqual(['GSIPAfDO_ec']);
    expect(alternates.dirty).toBe(true);
  });

  it('toggles promote on an existing upload and clears it when that row is removed', () => {
    const component = fixture.componentInstance;
    component.promote(0);
    expect(promoteYouTubeId.value).toBe('GSIPAfDO_ec');
    component.promote(0);
    expect(promoteYouTubeId.value).toBe('');
    component.promote(0);
    component.remove(0);
    expect(promoteYouTubeId.value).toBe('');
    expect(alternates.length).toBe(0);
  });

  it('explains how to add an upload when there are none', async () => {
    (fixture.nativeElement.querySelector('button[aria-label="Remove YouTube upload"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(alternates.length).toBe(0);
    expect(fixture.nativeElement.querySelector('.empty')?.textContent).toContain('Add a URL');
  });
});
