import { provideZonelessChangeDetection, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CatalogueParentDto } from '../catalogue-parent.interface';
import { catalogueParentEditModel } from '../catalogue-parent-edit';
import { CatalogueParentEditor } from '../catalogue-parent-editor';
import { PODCAST_REGEXS_TAB_INDEX } from '../podcast-form.util';
import { RegexPresetsService } from '../regex-presets.service';
import { CatalogueParentFieldsComponent } from './catalogue-parent-fields.component';

describe('CatalogueParentFieldsComponent', () => {
  it('the include-title override moves to the regex tab', () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const selected = signal(0);
    const editor = new CatalogueParentEditor(
      TestBed.inject(RegexPresetsService),
      () => 'Nightly',
      selected,
      () => undefined
    );
    const model = catalogueParentEditModel({
      id: 'show',
      name: 'Nightly',
      episodeIncludeTitleRegex: 'Intro',
      indexAllEpisodes: true
    } as CatalogueParentDto);
    const fixture: ComponentFixture<CatalogueParentFieldsComponent> = TestBed.createComponent(CatalogueParentFieldsComponent);
    fixture.componentRef.setInput('part', 'flags');
    fixture.componentRef.setInput('model', model);
    fixture.componentRef.setInput('editor', editor);
    fixture.detectChanges();

    const button = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>)
      .find((item) => item.textContent?.includes('Overridden by Episode Include Title Regex'));
    expect(button).toBeTruthy();
    button!.click();

    expect(selected()).toBe(PODCAST_REGEXS_TAB_INDEX);
    expect(editor.highlightIncludeTitleRegex()).toBe(true);
  });
});
