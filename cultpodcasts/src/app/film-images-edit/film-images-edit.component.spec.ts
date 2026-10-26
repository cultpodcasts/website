import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { FormArray } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { newFilmLinkGroup, PlayableServiceLinkGroup } from '../playable-edit-form.util';
import { FilmImagesEditComponent } from './film-images-edit.component';

describe('FilmImagesEditComponent', () => {
  let fixture: ComponentFixture<FilmImagesEditComponent>;
  let links: FormArray<PlayableServiceLinkGroup>;
  const open = vi.fn();

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FilmImagesEditComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: MatDialog, useValue: { open } }
      ],
    }).compileComponents();
    links = new FormArray([
      newFilmLinkGroup('https://www.youtube.com/watch?v=synthetic01', 'https://cdn.example.test/yt.jpg')
    ]);
    fixture = TestBed.createComponent(FilmImagesEditComponent);
    fixture.componentRef.setInput('links', links);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('shows one image row labelled by the Urls service', () => {
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('https://cdn.example.test/yt.jpg');
    expect(fixture.nativeElement.querySelector('mat-label')?.textContent?.trim()).toBe('YouTube');
  });

  it('clears the image and opens the preview dialog', () => {
    fixture.componentInstance.clearImage(links.at(0).controls.image);
    expect(links.at(0).controls.image.value).toBe('');
    links.at(0).controls.image.setValue('https://cdn.example.test/yt.jpg');
    fixture.componentInstance.previewImage('youtube');
    expect(open).toHaveBeenCalled();
    expect(open.mock.calls[0][1].data.images[0].url).toBe('https://cdn.example.test/yt.jpg');
  });
});
