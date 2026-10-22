import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { FormControl } from '@angular/forms';
import { externalIdValidator, ExternalIdKind } from '../external-id.util';
import { ExternalIdFieldComponent } from './external-id-field.component';

// Synthetic ids only.
describe('ExternalIdFieldComponent', () => {
  let fixture: ComponentFixture<ExternalIdFieldComponent>;
  let control: FormControl<string>;

  async function create(kind: ExternalIdKind, value = '', label?: string) {
    await TestBed.configureTestingModule({
      imports: [ExternalIdFieldComponent],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
    control = new FormControl(value, { nonNullable: true, validators: [externalIdValidator(kind)] });
    fixture = TestBed.createComponent(ExternalIdFieldComponent);
    fixture.componentRef.setInput('control', control);
    fixture.componentRef.setInput('kind', kind);
    if (label) {
      fixture.componentRef.setInput('label', label);
    }
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function settle() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function input(): HTMLInputElement {
    return fixture.nativeElement.querySelector('input');
  }

  function link(): HTMLAnchorElement | null {
    return fixture.nativeElement.querySelector('a');
  }

  function paste(text: string): ClipboardEvent {
    const data = new DataTransfer();
    data.setData('text', text);
    const event = new ClipboardEvent('paste', { clipboardData: data, cancelable: true, bubbles: true });
    input().dispatchEvent(event);
    return event;
  }

  function type(text: string) {
    input().value = text;
    input().dispatchEvent(new Event('input'));
  }

  it('labels the field by site and shows no link while empty', async () => {
    await create('imdb');
    expect(fixture.nativeElement.querySelector('mat-label')?.textContent?.trim()).toBe('IMDb id');
    expect(link()).toBeNull();
  });

  it('uses a given label', async () => {
    await create('tmdb-tv', '', 'TMDB TV id');
    expect(fixture.nativeElement.querySelector('mat-label')?.textContent?.trim()).toBe('TMDB TV id');
  });

  it('links a populated IMDb id to its title page in a new tab with noopener', async () => {
    await create('imdb', 'tt0000001');
    const a = link()!;
    expect(a.href).toBe('https://www.imdb.com/title/tt0000001/');
    expect(a.target).toBe('_blank');
    expect(a.rel).toContain('noopener');
    expect(a.getAttribute('aria-label')).toBe('Open on IMDb');
  });

  it('links TMDB movie and tv ids to the matching page', async () => {
    await create('tmdb-movie', '42');
    expect(link()!.href).toBe('https://www.themoviedb.org/movie/42');
    TestBed.resetTestingModule();
    await create('tmdb-tv', '42');
    expect(link()!.href).toBe('https://www.themoviedb.org/tv/42');
  });

  it('condenses a pasted IMDb URL to the id at once, marking the control dirty', async () => {
    await create('imdb');
    const event = paste('https://m.imdb.com/title/tt0000009/?ref_=synthetic');
    await settle();
    expect(event.defaultPrevented).toBe(true);
    expect(control.value).toBe('tt0000009');
    expect(control.dirty).toBe(true);
    expect(input().value).toBe('tt0000009');
    expect(link()!.href).toBe('https://www.imdb.com/title/tt0000009/');
  });

  it('condenses a pasted TMDB movie URL with slug, locale and query', async () => {
    await create('tmdb-movie');
    paste('https://www.themoviedb.org/en-GB/movie/1234567-a-synthetic-film?language=en-GB');
    await settle();
    expect(control.value).toBe('1234567');
  });

  it('lets a paste that is not a condensable URL through, for the error to show', async () => {
    await create('tmdb-movie');
    const event = paste('https://www.themoviedb.org/tv/1234567-a-synthetic-show');
    expect(event.defaultPrevented).toBe(false);
  });

  it('condenses a typed URL on blur', async () => {
    await create('imdb');
    type('https://www.imdb.com/title/tt0000003/');
    input().dispatchEvent(new Event('blur'));
    await settle();
    expect(control.value).toBe('tt0000003');
    expect(input().value).toBe('tt0000003');
  });

  it('keeps invalid text on blur, with an error and no link', async () => {
    await create('imdb');
    type('nm0000001');
    input().dispatchEvent(new Event('blur'));
    await settle();
    expect(control.value).toBe('nm0000001');
    expect(control.valid).toBe(false);
    expect(link()).toBeNull();
    expect(fixture.nativeElement.querySelector('mat-error')?.textContent).toContain('IMDb title id');
  });

  it('follows values set from outside the component', async () => {
    await create('imdb');
    control.setValue('tt0000004');
    await settle();
    expect(link()!.href).toBe('https://www.imdb.com/title/tt0000004/');
    control.setValue('');
    await settle();
    expect(link()).toBeNull();
  });
});
