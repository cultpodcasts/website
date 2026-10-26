import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { FormArray } from '@angular/forms';
import { newFilmLinkGroup, PlayableServiceLinkGroup } from '../playable-edit-form.util';
import { FilmLinksEditComponent } from './film-links-edit.component';

describe('FilmLinksEditComponent', () => {
  let fixture: ComponentFixture<FilmLinksEditComponent>;
  let links: FormArray<PlayableServiceLinkGroup>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FilmLinksEditComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
    links = new FormArray([newFilmLinkGroup('https://www.youtube.com/watch?v=synthetic01')]);
    fixture = TestBed.createComponent(FilmLinksEditComponent);
    fixture.componentRef.setInput('links', links);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('shows one URL row per link, labelled by its service', () => {
    const inputs = fixture.nativeElement.querySelectorAll('input') as NodeListOf<HTMLInputElement>;
    expect(inputs.length).toBe(1);
    expect(inputs[0].value).toBe('https://www.youtube.com/watch?v=synthetic01');
    expect(fixture.nativeElement.querySelector('mat-label')?.textContent?.trim()).toBe('YouTube');
  });

  it('adds an empty row and removes a row, marking the list dirty', () => {
    fixture.componentInstance.add();
    expect(links.length).toBe(2);
    fixture.componentInstance.remove(0);
    expect(links.getRawValue()).toEqual([{ url: '', image: '' }]);
    expect(links.dirty).toBe(true);
  });
});
