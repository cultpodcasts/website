import { signal, WritableSignal } from "@angular/core";
import { CatalogueParentEditModel, includeTitleRegexBlocksIndexAllEpisodes } from "./catalogue-parent-edit";
import { NamedRegexPreset } from "./regex-presets.interface";
import { RegexPresetsService } from "./regex-presets.service";
import { filterSubjectsByTerm, noCompareFunction, PODCAST_REGEXS_TAB_INDEX } from "./podcast-form.util";
import { applySubjectFilterKey, filterKeepingSelectedInOrder, isDesktopSubjectTypingEnabled } from "./subject-filter.util";

/**
 * Subject filters, regex presets, and the include-title highlight shared by the TV-show and
 * news-organisation edit dialogs. The dialog keeps its own model type and passes that object in.
 */
export class CatalogueParentEditor {
  readonly enableDesktopSubjectTypingFilter = isDesktopSubjectTypingEnabled();
  readonly noCompareFunction = noCompareFunction;
  readonly defaultSubjects = signal<string[]>([]);
  readonly ignoredSubjects = signal<string[]>([]);
  readonly defaultSubjectFilterTerm = signal("");
  readonly ignoredSubjectsFilterTerm = signal("");
  readonly languages = signal<Record<string, string>>({});
  readonly highlightIncludeTitleRegex = signal(false);
  readonly titleRegexPresets = signal<NamedRegexPreset[]>([]);
  readonly descriptionRegexPresets = signal<NamedRegexPreset[]>([]);
  readonly includeTitleRegexPresets = signal<NamedRegexPreset[]>([]);
  private highlightIncludeTitleTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly regexPresets: RegexPresetsService,
    private readonly parentName: () => string,
    private readonly selectedTabIndex: WritableSignal<number>,
    private readonly commit: (model: CatalogueParentEditModel) => void
  ) {
    const presets = regexPresets.loadRegexPresets();
    this.titleRegexPresets.set(presets.title);
    this.descriptionRegexPresets.set(presets.description);
    this.includeTitleRegexPresets.set(presets.includeTitle);
  }

  onDefaultSubjectDropdownOpenChange(opened: boolean): void {
    if (!opened) {
      this.defaultSubjectFilterTerm.set("");
    }
  }

  onIgnoredSubjectsDropdownOpenChange(opened: boolean): void {
    if (!opened) {
      this.ignoredSubjectsFilterTerm.set("");
    }
  }

  onDefaultSubjectDropdownKeydown(event: KeyboardEvent): void {
    applySubjectFilterKey(event, this.defaultSubjectFilterTerm, this.enableDesktopSubjectTypingFilter);
  }

  onIgnoredSubjectsDropdownKeydown(event: KeyboardEvent): void {
    applySubjectFilterKey(event, this.ignoredSubjectsFilterTerm, this.enableDesktopSubjectTypingFilter);
  }

  filteredDefaultSubjects(): string[] {
    return filterSubjectsByTerm(this.defaultSubjects(), this.defaultSubjectFilterTerm());
  }

  filteredIgnoredSubjects(model: CatalogueParentEditModel | null): string[] {
    const selected = new Set(model?.ignoredSubjects ?? []);
    return filterKeepingSelectedInOrder(this.ignoredSubjects(), this.ignoredSubjectsFilterTerm(), selected);
  }

  onIncludeTitleRegexChange(model: CatalogueParentEditModel | null, value: string): void {
    if (!model) {
      return;
    }
    if (includeTitleRegexBlocksIndexAllEpisodes(value) && model.indexAllEpisodes) {
      model.indexAllEpisodes = false;
      this.commit(model);
    }
  }

  applyTitleRegexPreset(model: CatalogueParentEditModel | null, pattern: string): void {
    if (!model) {
      return;
    }
    model.titleRegex = this.regexPresets.resolveRegexPlaceholders(pattern, this.parentName());
    this.commit(model);
  }

  applyDescriptionRegexPreset(model: CatalogueParentEditModel | null, pattern: string): void {
    if (!model) {
      return;
    }
    model.descriptionRegex = this.regexPresets.resolveRegexPlaceholders(pattern, this.parentName());
    this.commit(model);
  }

  applyIncludeTitleRegexPreset(model: CatalogueParentEditModel | null, pattern: string): void {
    if (!model) {
      return;
    }
    const value = this.regexPresets.resolveRegexPlaceholders(pattern, this.parentName());
    model.episodeIncludeTitleRegex = value;
    if (includeTitleRegexBlocksIndexAllEpisodes(value)) {
      model.indexAllEpisodes = false;
    }
    this.commit(model);
  }

  goToIncludeTitleRegex(): void {
    this.selectedTabIndex.set(PODCAST_REGEXS_TAB_INDEX);
    this.highlightIncludeTitleRegex.set(true);
    if (this.highlightIncludeTitleTimer) {
      clearTimeout(this.highlightIncludeTitleTimer);
    }
    this.highlightIncludeTitleTimer = setTimeout(() => {
      this.highlightIncludeTitleRegex.set(false);
      this.highlightIncludeTitleTimer = undefined;
    }, 2500);
    queueMicrotask(() => {
      document.getElementById("episode-include-title-regex-field")?.querySelector("input")?.focus();
    });
  }
}
