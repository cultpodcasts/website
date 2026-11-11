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
import { ambiguousCandidateFromCatalogueParent } from "../ambiguous-name-candidate";
import { hubParentLabel } from "../catalogue-hub";
import { applyIdentityIds, runCatalogueIdentityLookup } from "../catalogue-identity-lookup";
import { CatalogueParentDto, PlaylistIdHistoryEntry } from "../catalogue-parent.interface";
import { EditCatalogueParentDialogData, EditCatalogueParentDialogResponse } from "../catalogue-parent-edit-dialog-data";
import { YouTubeIndexingHints } from "../youtube-indexing-hints.interface";
import { effectiveYouTubeIndexingHints, formatIndexingHintInstant } from "../youtube-indexing-hints.util";
import {
  CatalogueParentEditModel,
  catalogueParentChanges,
  catalogueParentEditModel,
  historyDateText,
  includeTitleRegexBlocksIndexAllEpisodes,
  isValidAppleIdText,
  isValidDurationText,
  isValidImdbIdText,
  isValidNumericIdText,
  releaseAuthorityOptions,
  removesCatalogueParent,
  subjectOptions
} from "../catalogue-parent-edit";
import { catalogueParentSaveError } from "../catalogue-parent-save-error";
import { ConfirmComponent } from "../confirm/confirm.component";
import { CurationSubmitService } from "../curation-submit.service";
import { openExternalUrl } from "../episode-form.util";
import { imdbTitleUrl, tmdbTvShowUrl, tvdbSeriesUrl } from "../playable-edit-form.util";
import { buildPodcastLanguageOptions } from "../language-options.util";
import { NamedRegexPreset } from "../regex-presets.interface";
import { RegexPresetsService } from "../regex-presets.service";
import { parseAmbiguousPodcastIds } from "../parse-ambiguous-podcast-ids";
import {
  CATALOGUE_PARENT_IDENTITY_TAB_INDEX,
  filterSubjectsByTerm,
  noCompareFunction,
  PODCAST_DETAILS_TAB_INDEX,
  PODCAST_META_TAB_INDEX,
  PODCAST_REGEXS_TAB_INDEX,
  youTubeChannelIgnoredHint,
  youTubePlaylistReplacesChannel
} from "../podcast-form.util";
import { resolveAmbiguousEditRows } from "../resolve-ambiguous-edit-rows";
import { applySubjectFilterKey, filterKeepingSelectedInOrder, isDesktopSubjectTypingEnabled } from "../subject-filter.util";
import { youtubePlaylistEditError } from "../youtube-playlist-edit-error";

export { EditCatalogueParentDialogData, EditCatalogueParentDialogResponse } from "../catalogue-parent-edit-dialog-data";

/**
 * Curator edit of a TV show (PATCH, RPP #1053). Same tabbed layout as the podcast edit dialog:
 * Details (service ids, YouTube publication delay), Flags (Index All Episodes, Bypass Short Episode Checking, Always
 * promote as hero, Ignore All Episodes; Skip Enriching From YouTube is podcast-only), Subjects, Social, Meta (incl.
 * release authority and minimum duration), Regexs, and Identity.
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

  protected readonly label = hubParentLabel("tv");
  protected readonly releaseAuthorityOptions = releaseAuthorityOptions;
  protected readonly isLoading = signal(true);
  protected readonly isSending = signal(false);
  protected readonly notFound = signal(false);
  protected readonly conflict = signal(false);
  protected readonly isInError = signal(false);
  protected readonly saveError = signal(false);
  /** Curator-facing save failure copy; playlist ownership codes replace the generic line. */
  protected readonly saveErrorMessage = signal("Saving failed. Nothing was changed.");
  protected readonly model = signal<CatalogueParentEditModel | null>(null);
  protected readonly appleIdInvalid = signal(false);
  protected readonly identityInvalid = signal(false);
  /** Minimum Duration (Meta tab) and YouTube Publication Delay (Details tab) are validated separately so each tab shows only its own error. */
  protected readonly minimumDurationInvalid = signal(false);
  protected readonly publicationDelayInvalid = signal(false);
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

  protected readonly playlistHistory = signal<PlaylistIdHistoryEntry[]>([]);
  protected readonly indexingHints = signal<YouTubeIndexingHints | null>(null);
  protected readonly clearingIndexingHints = signal(false);
  protected readonly formatHintInstant = formatIndexingHintInstant;
  protected readonly historyDateText = historyDateText;
  protected readonly youTubePlaylistReplacesChannel = youTubePlaylistReplacesChannel;
  protected readonly youTubeChannelIgnoredHint = youTubeChannelIgnoredHint;
  protected readonly itemNoun = "episodes";
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
      const dto = await this.resolveParentDto();
      if (!dto) {
        return;
      }
      const resp = await firstValueFrom(
        forkJoin({
          subjects: this.curation.getSubjects(),
          languages: this.curation.getLanguages()
        })
      );
      const subjectNames = resp.subjects.map((subject) => subject.name);
      this.original = dto;
      this.model.set(catalogueParentEditModel(dto));
      this.defaultSubjects.set(subjectOptions([dto.defaultSubject ?? ""], subjectNames));
      this.ignoredSubjects.set(subjectOptions(dto.ignoredSubjects ?? [], subjectNames));
      this.languages.set(buildPodcastLanguageOptions(resp.languages));
      this.playlistHistory.set(dto.youTubePlaylistIdHistory ?? []);
      this.indexingHints.set(dto.youTubeIndexingHints ?? null);
    } catch (error) {
      const status = error instanceof HttpErrorResponse ? error.status : 0;
      this.notFound.set(status === 404);
      this.conflict.set(status === 409);
      this.isInError.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * GET by hub name; on 409 load each id and let the curator pick (same picker as submit).
   * Cancel closes the edit dialog. Returns null when closed or unrecoverable.
   */
  private async resolveParentDto(): Promise<CatalogueParentDto | null> {
    try {
      return await firstValueFrom(this.curation.getCatalogueParent("tv", this.data.name));
    } catch (error) {
      if (!(error instanceof HttpErrorResponse) || error.status !== 409) {
        throw error;
      }
      const ids = parseAmbiguousPodcastIds(error.error);
      if (!ids) {
        this.conflict.set(true);
        this.isInError.set(true);
        return null;
      }
      const outcome = await resolveAmbiguousEditRows(
        ids,
        async (id) => {
          try {
            return await firstValueFrom(this.curation.getCatalogueParent("tv", id));
          } catch {
            return null;
          }
        },
        this.dialog,
        this.data.name,
        {
          toCandidate: ambiguousCandidateFromCatalogueParent,
          title: `Choose ${this.label.toLowerCase()}`,
          itemNounPlural: "TV shows"
        }
      );
      if (outcome.kind === "unrecoverable") {
        this.conflict.set(true);
        this.isInError.set(true);
        return null;
      }
      if (outcome.kind === "cancelled") {
        this.dialogRef.close({ closed: true });
        return null;
      }
      return outcome.row;
    }
  }

  protected async lookUpIdentity(): Promise<void> {
    if (this.lookingUpIdentity()) {
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
      // Apple Id is on Details; switch so the error is visible when Save is blocked from another tab.
      this.selectedTabIndex.set(PODCAST_DETAILS_TAB_INDEX);
      return;
    }
    this.minimumDurationInvalid.set(!isValidDurationText(model.minimumDuration));
    this.publicationDelayInvalid.set(!isValidDurationText(model.youTubePublicationDelay));
    if (this.minimumDurationInvalid() || this.publicationDelayInvalid()) {
      // Publication delay (Details) before minimum duration (Meta) when both are invalid.
      this.selectedTabIndex.set(
        this.publicationDelayInvalid() ? PODCAST_DETAILS_TAB_INDEX : PODCAST_META_TAB_INDEX
      );
      return;
    }
    this.identityInvalid.set(
      !(isValidImdbIdText(model.imdbId) && isValidNumericIdText(model.tvdbId) && isValidNumericIdText(model.tmdbId))
    );
    if (this.identityInvalid()) {
      this.selectedTabIndex.set(CATALOGUE_PARENT_IDENTITY_TAB_INDEX);
      return;
    }
    const changes = catalogueParentChanges(this.original, model, true);
    if (Object.keys(changes).length === 0) {
      this.dialogRef.close({ noChange: true });
      return;
    }
    if (removesCatalogueParent(changes) && !(await this.confirmRemove())) {
      return;
    }
    this.isSending.set(true);
    this.saveError.set(false);
    this.saveErrorMessage.set("Saving failed. Nothing was changed.");
    try {
      const resp = await firstValueFrom(this.curation.patchCatalogueParent("tv", this.original.id, changes));
      if (resp.status === 202 || resp.status === 200) {
        this.dialogRef.close({ updated: true });
        return;
      }
      this.saveError.set(true);
    } catch (error) {
      const playlist = youtubePlaylistEditError(error);
      const refused = playlist ? undefined : catalogueParentSaveError(error);
      if (playlist) {
        // Retryable 503: form stays mounted and Save remains enabled (Save-as-retry; podcast send uses an explicit Try again).
        this.saveErrorMessage.set(playlist.message);
      } else if (refused) {
        // Channel / service-id refusals (400 codes, 409 owner): show the API's reason so the curator can fix the id.
        this.saveErrorMessage.set(refused);
      }
      this.saveError.set(true);
    } finally {
      this.isSending.set(false);
    }
  }

  protected displayIndexingHints(): YouTubeIndexingHints | null {
    return effectiveYouTubeIndexingHints(this.indexingHints(), this.model()?.youTubePlaylistId);
  }

  /** Clears indexer hints immediately so the next hourly pass walks the playlist in full. */
  protected async forceFullYouTubeWalk(): Promise<void> {
    if (!this.original || this.clearingIndexingHints() || !this.displayIndexingHints()) {
      return;
    }
    const closed = await firstValueFrom(
      this.dialog
        .open(ConfirmComponent, {
          data: {
            title: "Force full YouTube walk?",
            question:
              "Clear indexing hints for this playlist? The next indexing pass will walk the whole playlist and write fresh hints."
          }
        })
        .afterClosed()
    );
    if ((closed as { result?: boolean } | undefined)?.result !== true) {
      return;
    }
    this.clearingIndexingHints.set(true);
    try {
      const id = this.original.id;
      await firstValueFrom(
        this.curation.patchCatalogueParent("tv", id, {
          clearYouTubeIndexingHints: true
        })
      );
      // CQRS: acknowledgement is not the read model — re-GET and bind hints.
      const refreshed = await firstValueFrom(this.curation.getCatalogueParent("tv", id));
      const hints = refreshed.youTubeIndexingHints ?? null;
      this.indexingHints.set(hints);
      this.original = { ...this.original, youTubeIndexingHints: hints };
      if (hints != null) {
        this.snackBar.open("Could not clear indexing hints.", "Ok", { duration: 8000 });
        return;
      }
      this.snackBar.open("Indexing hints cleared. Next pass will do a full walk.", "Ok", { duration: 8000 });
    } catch {
      this.snackBar.open("Could not clear indexing hints.", "Ok", { duration: 8000 });
    } finally {
      this.clearingIndexingHints.set(false);
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
