import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { HttpErrorResponse } from "@angular/common/http";
import { FormsModule } from "@angular/forms";
import { MatButtonModule } from "@angular/material/button";
import { MatCheckboxModule } from "@angular/material/checkbox";
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { MatProgressSpinnerModule } from "@angular/material/progress-spinner";
import { MatIconModule } from "@angular/material/icon";
import { MatMenuModule } from "@angular/material/menu";
import { MatSelectModule } from "@angular/material/select";
import { MatSnackBar } from "@angular/material/snack-bar";
import { MatTabsModule } from "@angular/material/tabs";
import { TextFieldModule } from "@angular/cdk/text-field";
import { KeyValuePipe } from "@angular/common";
import { firstValueFrom, forkJoin } from "rxjs";
import { CatalogueHub, hubParentLabel } from "../catalogue-hub";
import { applyIdentityIds, runCatalogueIdentityLookup } from "../catalogue-identity-lookup";
import { CatalogueParentDto } from "../catalogue-parent.interface";
import {
  CatalogueParentEditModel,
  catalogueParentChanges,
  catalogueParentEditModel,
  includeTitleRegexBlocksIndexAllEpisodes,
  isValidAppleIdText,
  isValidImdbIdText,
  isValidNumericIdText,
  removesCatalogueParent,
  subjectOptions
} from "../catalogue-parent-edit";
import { ConfirmComponent } from "../confirm/confirm.component";
import { CurationSubmitService } from "../curation-submit.service";
import { openExternalUrl } from "../episode-form.util";
import { imdbTitleUrl, tmdbTvShowUrl, tvdbSeriesUrl } from "../playable-edit-form.util";
import { buildPodcastLanguageOptions } from "../language-options.util";
import { NamedRegexPreset } from "../regex-presets.interface";
import { RegexPresetsService } from "../regex-presets.service";
import { filterSubjectsByTerm, noCompareFunction, PODCAST_REGEXS_TAB_INDEX } from "../podcast-form.util";
import { applySubjectFilterKey, filterKeepingSelectedInOrder, isDesktopSubjectTypingEnabled } from "../subject-filter.util";

export interface EditCatalogueParentDialogData {
  hub: CatalogueHub;
  name: string;
  highlightDefaultLanguage?: boolean;
}

export interface EditCatalogueParentDialogResponse {
  updated?: boolean;
  noChange?: boolean;
  closed?: boolean;
}

/**
 * Curator edit of a news outlet / TV show (PATCH, RPP #1053). Same tabbed layout as the podcast edit dialog:
 * Details (service ids), Flags (incl. Index All Episodes), Subjects, Social, Meta, Regexs, and Identity for TV.
 * Rename is a separate admin dialog. Default/ignored subjects and language use the podcast dialog's selects.
 */
@Component({
  selector: "app-edit-catalogue-parent-dialog",
  imports: [
    FormsModule,
    KeyValuePipe,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTabsModule,
    TextFieldModule
  ],
  templateUrl: "./edit-catalogue-parent-dialog.component.html",
  styleUrl: "./edit-catalogue-parent-dialog.component.sass",
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditCatalogueParentDialogComponent {
  protected readonly data = inject<EditCatalogueParentDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<EditCatalogueParentDialogComponent, EditCatalogueParentDialogResponse>>(MatDialogRef);
  private readonly curation = inject(CurationSubmitService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly regexPresetsService = inject(RegexPresetsService);

  protected readonly label = hubParentLabel(this.data.hub);
  protected readonly isTv = this.data.hub === "tv";
  protected readonly isLoading = signal(true);
  protected readonly isSending = signal(false);
  protected readonly notFound = signal(false);
  protected readonly conflict = signal(false);
  protected readonly isInError = signal(false);
  protected readonly saveError = signal(false);
  protected readonly model = signal<CatalogueParentEditModel | null>(null);
  protected readonly appleIdInvalid = signal(false);
  protected readonly identityInvalid = signal(false);
  protected readonly lookingUpIdentity = signal(false);
  protected readonly identityLookupMessage = signal("");
  protected readonly openExternalUrl = openExternalUrl;
  protected readonly imdbUrl = imdbTitleUrl;
  protected readonly tvdbUrl = tvdbSeriesUrl;
  protected readonly tmdbUrl = tmdbTvShowUrl;

  protected clearIdentityField(field: "imdbId" | "tvdbId" | "tmdbId"): void {
    const model = this.model();
    if (!model) {
      return;
    }
    this.model.set({ ...model, [field]: "" });
    this.identityInvalid.set(false);
  }
  protected readonly playlistHistory = signal<{ id: string; replacedAt: string }[]>([]);
  protected readonly itemNoun = this.data.hub === "news" ? "reports" : "episodes";
  protected readonly enableDesktopSubjectTypingFilter = isDesktopSubjectTypingEnabled();
  protected readonly noCompareFunction = noCompareFunction;
  protected readonly defaultSubjects = signal<string[]>([]);
  protected readonly ignoredSubjects = signal<string[]>([]);
  protected readonly defaultSubjectFilterTerm = signal("");
  protected readonly ignoredSubjectsFilterTerm = signal("");
  protected readonly languages = signal<Record<string, string>>({});
  protected readonly selectedTabIndex = signal(0);
  protected readonly highlightIncludeTitleRegex = signal(false);
  protected readonly includeTitleRegexBlocksIndexAllEpisodes = includeTitleRegexBlocksIndexAllEpisodes;
  protected readonly titleRegexPresets = signal<NamedRegexPreset[]>([]);
  protected readonly descriptionRegexPresets = signal<NamedRegexPreset[]>([]);
  protected readonly includeTitleRegexPresets = signal<NamedRegexPreset[]>([]);
  private highlightIncludeTitleTimer: ReturnType<typeof setTimeout> | undefined;
  private original: CatalogueParentDto | null = null;

  constructor() {
    const presets = this.regexPresetsService.loadRegexPresets();
    this.titleRegexPresets.set(presets.title);
    this.descriptionRegexPresets.set(presets.description);
    this.includeTitleRegexPresets.set(presets.includeTitle);
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const resp = await firstValueFrom(
        forkJoin({
          dto: this.curation.getCatalogueParent(this.data.hub, this.data.name),
          subjects: this.curation.getSubjects(),
          languages: this.curation.getLanguages()
        })
      );
      const dto = resp.dto;
      const subjectNames = resp.subjects.map((subject) => subject.name);
      this.original = dto;
      this.model.set(catalogueParentEditModel(dto));
      this.defaultSubjects.set(subjectOptions([dto.defaultSubject ?? ""], subjectNames));
      this.ignoredSubjects.set(subjectOptions(dto.ignoredSubjects ?? [], subjectNames));
      this.languages.set(buildPodcastLanguageOptions(resp.languages));
      this.playlistHistory.set(dto.youTubePlaylistIdHistory ?? []);
    } catch (error) {
      const status = error instanceof HttpErrorResponse ? error.status : 0;
      this.notFound.set(status === 404);
      this.conflict.set(status === 409);
      this.isInError.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }

  protected async lookUpIdentity(): Promise<void> {
    if (!this.isTv || this.lookingUpIdentity()) {
      return;
    }
    const model = this.model();
    const title = (this.original?.name ?? this.data.name).trim();
    if (!model || !title) {
      this.identityLookupMessage.set("Show name is required before looking up identity.");
      return;
    }
    this.lookingUpIdentity.set(true);
    this.identityLookupMessage.set("");
    try {
      const outcome = await runCatalogueIdentityLookup(
        this.dialog,
        (body) => this.curation.lookupCatalogueIdentity(body),
        { kind: "TvShow", title }
      );
      if (outcome.kind === "cancelled") {
        return;
      }
      if (outcome.kind === "noMatch" || outcome.kind === "error") {
        this.identityLookupMessage.set(outcome.message);
        this.snackBar.open(outcome.message, "Ok", { duration: 8000 });
        return;
      }
      const filled = applyIdentityIds(
        { imdbId: model.imdbId, tmdbId: model.tmdbId, tvdbId: model.tvdbId },
        outcome.ids
      );
      if (!filled.changed) {
        const msg = "Lookup matched, but no blank identity fields to fill.";
        this.identityLookupMessage.set(msg);
        this.snackBar.open(msg, "Ok", { duration: 8000 });
        return;
      }
      this.model.set({
        ...model,
        imdbId: filled.imdbId ?? model.imdbId,
        tmdbId: filled.tmdbId ?? model.tmdbId,
        tvdbId: filled.tvdbId ?? model.tvdbId
      });
      this.identityInvalid.set(false);
      const msg = "Filled blank show identity. Save to keep.";
      this.identityLookupMessage.set(msg);
      this.snackBar.open(msg, "Ok", { duration: 8000 });
    } finally {
      this.lookingUpIdentity.set(false);
    }
  }

  protected async save(): Promise<void> {
    const model = this.model();
    if (!model || !this.original) {
      return;
    }
    this.appleIdInvalid.set(!isValidAppleIdText(model.appleId));
    if (this.appleIdInvalid()) {
      return;
    }
    this.identityInvalid.set(
      this.isTv && !(isValidImdbIdText(model.imdbId) && isValidNumericIdText(model.tvdbId) && isValidNumericIdText(model.tmdbId))
    );
    if (this.identityInvalid()) {
      return;
    }
    const changes = catalogueParentChanges(this.original, model, this.isTv);
    if (Object.keys(changes).length === 0) {
      this.dialogRef.close({ noChange: true });
      return;
    }
    if (removesCatalogueParent(changes) && !(await this.confirmRemove())) {
      return;
    }
    this.isSending.set(true);
    this.saveError.set(false);
    try {
      const resp = await firstValueFrom(this.curation.patchCatalogueParent(this.data.hub, this.original.id, changes));
      if (resp.status === 202 || resp.status === 200) {
        this.dialogRef.close({ updated: true });
        return;
      }
      this.saveError.set(true);
    } catch {
      this.saveError.set(true);
    } finally {
      this.isSending.set(false);
    }
  }

  /** Removing cascades to every report / episode, so it takes an explicit Yes. Restoring stays one step. */
  private async confirmRemove(): Promise<boolean> {
    const closed = await firstValueFrom(
      this.dialog
        .open(ConfirmComponent, {
          data: {
            title: `Remove ${this.label.toLowerCase()}?`,
            question: `"${this.data.name}" and all of its ${this.itemNoun} will be hidden from the site. Remove it?`
          }
        })
        .afterClosed()
    );
    return (closed as { result?: boolean } | undefined)?.result === true;
  }

  protected onDefaultSubjectDropdownOpenChange(opened: boolean): void {
    if (!opened) {
      this.defaultSubjectFilterTerm.set("");
    }
  }

  protected onIgnoredSubjectsDropdownOpenChange(opened: boolean): void {
    if (!opened) {
      this.ignoredSubjectsFilterTerm.set("");
    }
  }

  protected onDefaultSubjectDropdownKeydown(event: KeyboardEvent): void {
    applySubjectFilterKey(event, this.defaultSubjectFilterTerm, this.enableDesktopSubjectTypingFilter);
  }

  protected onIgnoredSubjectsDropdownKeydown(event: KeyboardEvent): void {
    applySubjectFilterKey(event, this.ignoredSubjectsFilterTerm, this.enableDesktopSubjectTypingFilter);
  }

  protected filteredDefaultSubjects(): string[] {
    return filterSubjectsByTerm(this.defaultSubjects(), this.defaultSubjectFilterTerm());
  }

  protected filteredIgnoredSubjects(): string[] {
    const selected = new Set(this.model()?.ignoredSubjects ?? []);
    return filterKeepingSelectedInOrder(this.ignoredSubjects(), this.ignoredSubjectsFilterTerm(), selected);
  }

  protected onIncludeTitleRegexChange(value: string): void {
    const model = this.model();
    if (!model) {
      return;
    }
    if (includeTitleRegexBlocksIndexAllEpisodes(value) && model.indexAllEpisodes) {
      model.indexAllEpisodes = false;
      this.model.set({ ...model });
    }
  }

  protected applyTitleRegexPreset(pattern: string): void {
    const model = this.model();
    if (!model) {
      return;
    }
    model.titleRegex = this.regexPresetsService.resolveRegexPlaceholders(pattern, this.data.name);
    this.model.set({ ...model });
  }

  protected applyDescriptionRegexPreset(pattern: string): void {
    const model = this.model();
    if (!model) {
      return;
    }
    model.descriptionRegex = this.regexPresetsService.resolveRegexPlaceholders(pattern, this.data.name);
    this.model.set({ ...model });
  }

  protected applyIncludeTitleRegexPreset(pattern: string): void {
    const model = this.model();
    if (!model) {
      return;
    }
    const value = this.regexPresetsService.resolveRegexPlaceholders(pattern, this.data.name);
    model.episodeIncludeTitleRegex = value;
    this.model.set({ ...model });
    this.onIncludeTitleRegexChange(value);
  }

  protected goToIncludeTitleRegex(): void {
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

  protected close(): void {
    this.dialogRef.close({ closed: true });
  }
}
