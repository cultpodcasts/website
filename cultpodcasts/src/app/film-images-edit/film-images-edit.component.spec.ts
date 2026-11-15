import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { FormArray, FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { newPlayableLinkGroup, PlayableServiceLinkGroup } from '../playable-edit-form.util';
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
      newPlayableLinkGroup('https://www.youtube.com/watch?v=synthetic01', 'https://cdn.example.test/yt.jpg')
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

  it('shows the identity image when there are no service URLs (RedditPodcastPoster#1435)', async () => {
    const identity = new FormControl('https://image.tmdb.org/t/p/w1280/backdrop.jpg', { nonNullable: true });
    const emptyLinks = new FormArray<PlayableServiceLinkGroup>([]);
    fixture.componentRef.setInput('links', emptyLinks);
    fixture.componentRef.setInput('identityImage', identity);
    fixture.detectChanges();
    await fixture.whenStable();
    const labels = Array.from(fixture.nativeElement.querySelectorAll('mat-label') as NodeListOf<HTMLElement>)
      .map(el => el.textContent?.trim());
    expect(labels).toEqual(['Identity image']);
    expect(fixture.nativeElement.querySelector('.empty')).toBeNull();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('https://image.tmdb.org/t/p/w1280/backdrop.jpg');
    fixture.componentInstance.clearImage(identity);
    expect(identity.value).toBe('');
    open.mockClear();
    fixture.componentInstance.previewImage('other');
    expect(open).not.toHaveBeenCalled();
    identity.setValue('https://image.tmdb.org/t/p/w1280/backdrop.jpg');
    fixture.componentInstance.previewImage('other');
    const preview = open.mock.calls.at(-1);
    expect(preview?.[1].data.images[0]).toEqual({
      service: 'other',
      label: 'Identity image',
      url: 'https://image.tmdb.org/t/p/w1280/backdrop.jpg'
    });
  });
});
