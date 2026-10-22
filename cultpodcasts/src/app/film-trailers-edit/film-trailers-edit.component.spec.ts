import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { FormArray } from '@angular/forms';
import { FilmTrailerEditGroup, newFilmTrailerGroup } from '../playable-edit-form.util';
import { FilmTrailersEditComponent } from './film-trailers-edit.component';

describe('FilmTrailersEditComponent', () => {
  let fixture: ComponentFixture<FilmTrailersEditComponent>;
  let trailers: FormArray<FilmTrailerEditGroup>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FilmTrailersEditComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
    trailers = new FormArray([
      newFilmTrailerGroup('t1', 'Synthetic Teaser'),
      newFilmTrailerGroup('t2', 'Synthetic Clip'),
    ]);
    fixture = TestBed.createComponent(FilmTrailersEditComponent);
    fixture.componentRef.setInput('trailers', trailers);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('shows an editable title per trailer, in order', () => {
    const inputs = Array.from(fixture.nativeElement.querySelectorAll('input')) as HTMLInputElement[];
    expect(inputs.map(i => i.value)).toEqual(['Synthetic Teaser', 'Synthetic Clip']);
  });

  it('moves a trailer within bounds and removes one, marking the list dirty', () => {
    const component = fixture.componentInstance;
    component.move(0, -1);
    expect(trailers.getRawValue().map(t => t.id)).toEqual(['t1', 't2']);
    component.move(0, 1);
    expect(trailers.getRawValue().map(t => t.id)).toEqual(['t2', 't1']);
    component.remove(1);
    expect(trailers.getRawValue().map(t => t.id)).toEqual(['t2']);
    expect(trailers.dirty).toBe(true);
  });

  it('explains how to add a trailer when there are none', async () => {
    for (let i = 0; i < 2; i++) {
      (fixture.nativeElement.querySelector('button[aria-label="Remove trailer"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      await fixture.whenStable();
    }
    expect(trailers.length).toBe(0);
    expect(fixture.nativeElement.querySelector('.empty')?.textContent).toContain('Attach as trailer');
  });
});
