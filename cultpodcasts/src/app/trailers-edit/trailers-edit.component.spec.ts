import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { FormArray } from '@angular/forms';
import { TrailerEditGroup, newTrailerGroup } from '../playable-edit-form.util';
import { TrailersEditComponent } from './trailers-edit.component';

describe('TrailersEditComponent', () => {
  let fixture: ComponentFixture<TrailersEditComponent>;
  let trailers: FormArray<TrailerEditGroup>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrailersEditComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
    trailers = new FormArray([
      newTrailerGroup('t1', 'Synthetic Teaser'),
      newTrailerGroup('t2', 'Synthetic Clip'),
    ]);
    fixture = TestBed.createComponent(TrailersEditComponent);
    fixture.componentRef.setInput('trailers', trailers);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('shows an editable title per trailer, in order', () => {
    const inputs = Array.from(fixture.nativeElement.querySelectorAll('input')) as HTMLInputElement[];
    expect(inputs.map(i => i.value)).toEqual(['Synthetic Teaser', 'Synthetic Clip']);
  });

  it('marks a blank trailer title required and shows the error', async () => {
    trailers.at(0).controls.title.setValue('');
    trailers.at(0).controls.title.markAsTouched();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(trailers.at(0).controls.title.hasError('required')).toBe(true);
    expect(fixture.nativeElement.querySelector('mat-error')?.textContent).toContain('A title is required');
  });

  it('marks a whitespace-only trailer title required and shows the error', async () => {
    trailers.at(0).controls.title.setValue('   ');
    trailers.at(0).controls.title.markAsTouched();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(trailers.at(0).controls.title.hasError('required')).toBe(true);
    expect(trailers.valid).toBe(false);
    expect(fixture.nativeElement.querySelector('mat-error')?.textContent).toContain('A title is required');
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

  it('explains how to add a trailer to a TV show when it has none', async () => {
    fixture.componentRef.setInput('parent', 'tv');
    trailers.clear();
    fixture.detectChanges();
    await fixture.whenStable();
    const empty = fixture.nativeElement.querySelector('.empty')?.textContent as string;
    expect(empty).toContain('Catalogue tab');
    expect(empty).toContain('"Attach as TV trailer/clip"');
    expect(empty).toContain('Pick this TV show there');
    expect(empty).not.toContain('film');
  });

  it('explains how to add a trailer when there are none', async () => {
    for (let i = 0; i < 2; i++) {
      (fixture.nativeElement.querySelector('button[aria-label="Remove trailer"]') as HTMLButtonElement).click();
      fixture.detectChanges();
      await fixture.whenStable();
    }
    expect(trailers.length).toBe(0);
    const empty = fixture.nativeElement.querySelector('.empty')?.textContent as string;
    expect(empty).toContain('Catalogue tab');
    expect(empty).toContain('"Attach as trailer"');
    expect(empty).toContain('Pick this film there');
  });
});
