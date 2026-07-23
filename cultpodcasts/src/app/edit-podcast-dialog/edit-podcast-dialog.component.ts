import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, Inject, ChangeDetectionStrategy, signal, WritableSignal } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { EditPodcastForm } from "../edit-podcast-form.interface";
import { Podcast } from '../podcast.interface';
import { firstValueFrom, forkJoin } from 'rxjs';
import { environment } from './../../environments/environment';
import { Subject } from '../subject.interface';
import { EditPodcastPost } from "../edit-podcast-post.interface";
import { EditPodcastSendComponent } from '../edit-podcast-send/edit-podcast-send.component';
import { PodcastServiceType } from "../podcast-service-type.enum";
import { MatInputModule } from '@angular/material/input';
import { TextFieldModule } from '@angular/cdk/text-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { KeyValuePipe } from '@angular/common';
import { MatMenuModule } from '@angular/material/menu';
import { MatIconModule } from '@angular/material/icon';
import { NamedRegexPreset } from '../regex-presets.interface';
import { RegexPresetsService } from '../regex-presets.service';
import { filterKeepingSelectedInOrder } from '../subject-filter.util';
import { buildPodcastLanguageOptions } from '../language-options.util';
import {
  buildPodcastFormControls,
  filterSubjectsByTerm,
  getPodcastChanges,
  noCompareFunction,
  asEmptyString,
  asStringArray
} from '../podcast-form.util';

@Component({
  selector: 'app-edit-podcast-dialog-component',
  imports: [
    MatDialogModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    ReactiveFormsModule,
    MatTabsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    TextFieldModule,
    MatCheckboxModule,
    KeyValuePipe,
    MatMenuModule,
    MatIconModule
  ],
  templateUrl: './edit-podcast-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './edit-podcast-dialog.component.sass'
})
export class EditPodcastDialogComponent {
  readonly enableDesktopSubjectTypingFilter: boolean = typeof window !== 'undefined'
    && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  protected readonly noCompareFunction = noCompareFunction;

  podcastName: string;
  readonly isLoading = signal<boolean>(true);
  readonly isInError = signal<boolean>(false);
  readonly notFound = signal<boolean>(false);
  readonly conflict = signal<boolean>(false);
  podcastServices = Object
    .values(PodcastServiceType)
    .filter(value => typeof value !== 'number')
    .map(x => x as keyof typeof PodcastServiceType)

  readonly form = signal<FormGroup<EditPodcastForm> | undefined>(undefined);
  originalPodcast: Podcast | undefined;
  readonly defaultSubjects = signal<string[]>([]);
  readonly ignoredSubjects = signal<string[]>([]);
  readonly defaultSubjectFilterTerm = signal<string>('');
  readonly ignoredSubjectsFilterTerm = signal<string>('');
  readonly languages = signal<{ [key: string]: string }>({});
  readonly titleRegexPresets = signal<NamedRegexPreset[]>([]);
  readonly descriptionRegexPresets = signal<NamedRegexPreset[]>([]);
  podcastId: string | undefined;
  episodeId: string | undefined;

  constructor(
    private auth: AuthServiceWrapper,
    private http: HttpClient,
    private regexPresetsService: RegexPresetsService,
    private dialogRef: MatDialogRef<EditPodcastDialogComponent, any>,
    @Inject(MAT_DIALOG_DATA) public data: { podcastName: string, episodeId: string | undefined },
    private dialog: MatDialog,
  ) {
    this.podcastName = data.podcastName;
    this.episodeId = data.episodeId;
  }

  async ngOnInit(): Promise<any> {
    await this.loadRegexPresets();
    var token = await firstValueFrom(this.auth.authService.getAccessTokenSilently({
      authorizationParams: {
        audience: `https://api.cultpodcasts.com/`,
        scope: 'curate'
      }
    }));
    try {
      let headers: HttpHeaders = new HttpHeaders();
      headers = headers.set("Authorization", "Bearer " + token);
      let episodeEndpoint: string;
      if (this.episodeId) {
        episodeEndpoint = new URL(`/podcast/${encodeURIComponent(this.podcastName)}/${this.episodeId}`, environment.api).toString();
      } else {
        episodeEndpoint = new URL(`/podcast/${encodeURIComponent(this.podcastName)}`, environment.api).toString();
      }
      const subjectsEndpoint = new URL("/subjects", environment.api).toString();
      const languagesEndpoint = new URL("/languages", environment.api).toString();

      var resp = await firstValueFrom(forkJoin(
        {
          podcast: this.http.get<Podcast>(episodeEndpoint, { headers: headers, observe: "response" }),
          subjects: this.http.get<Subject[]>(subjectsEndpoint, { headers: headers }),
          languages: this.http.get<{ [key: string]: string }>(languagesEndpoint, { headers: headers })
        }
      ));

      if (resp.podcast.status == 200 && resp.podcast.body) {
        this.podcastId = resp.podcast.body.id;
        this.originalPodcast = resp.podcast.body;
        this.form.set(new FormGroup<EditPodcastForm>(buildPodcastFormControls(resp.podcast.body)));
        let initial: string[] = [];
        if (resp.podcast.body && resp.podcast.body.defaultSubject != null) {
          initial.push(resp.podcast.body.defaultSubject);
        }
        this.defaultSubjects.set([...initial].concat(resp.subjects.filter(x => resp.podcast.body!.defaultSubject == null || resp.podcast.body!.defaultSubject != x.name).map(x => x.name)));
        const ignoredSubjects = resp.podcast.body.ignoredSubjects ?? [];
        this.ignoredSubjects.set(ignoredSubjects.concat(resp.subjects.filter(x => !ignoredSubjects.includes(x.name)).map(x => x.name)));
        this.languages.set(buildPodcastLanguageOptions(resp.languages));

        this.isLoading.set(false);
      } else {
        this.isLoading.set(false);
        this.isInError.set(true);
        if (resp.podcast.status == 404) {
          this.notFound.set(true);
        } else if (resp.podcast.status == 409) {
          this.conflict.set(true);
        }
      }
    } catch (e) {
      console.error(e);
      this.isLoading.set(false);
      this.isInError.set(true);
    }
  }

  close() {
    this.dialogRef.close({ closed: true });
  }

  async loadRegexPresets(): Promise<void> {
    const presets = this.regexPresetsService.loadRegexPresets();
    this.titleRegexPresets.set(presets.title);
    this.descriptionRegexPresets.set(presets.description);
  }

  resolveRegexPlaceholders(regexValue: string): string {
    return this.regexPresetsService.resolveRegexPlaceholders(regexValue, this.podcastName);
  }

  applyTitleRegexPreset(pattern: string): void {
    const form = this.form();
    if (!form) {
      return;
    }

    this.regexPresetsService.applyTitleRegexPreset(pattern, form.controls.titleRegex, this.podcastName);
  }

  applyDescriptionRegexPreset(pattern: string): void {
    const form = this.form();
    if (!form) {
      return;
    }

    this.regexPresetsService.applyDescriptionRegexPreset(pattern, form.controls.descriptionRegex, this.podcastName);
  }

  onSubmit() {
    const form = this.form();
    if (form?.valid) {
      const update: Podcast = {
        removed: form.controls.removed.value,
        indexAllEpisodes: form.controls.indexAllEpisodes.value,
        bypassShortEpisodeChecking: form.controls.bypassShortEpisodeChecking.value,
        releaseAuthority: form.controls.releaseAuthority.value == PodcastServiceType[PodcastServiceType.Unset] ? undefined : form.controls.releaseAuthority.value,
        primaryPostService: form.controls.primaryPostService.value == PodcastServiceType[PodcastServiceType.Unset] ? undefined : form.controls.primaryPostService.value,
        spotifyId: form.controls.spotifyId.value,
        appleId: form.controls.appleId.value,
        youTubePublicationDelay: form.controls.youTubePublicationDelay.value,
        skipEnrichingFromYouTube: form.controls.skipEnrichingFromYouTube.value,
        twitterHandle: form.controls.twitterHandle.value,
        blueskyHandle: form.controls.blueskyHandle.value,
        titleRegex: form.controls.titleRegex.value,
        descriptionRegex: form.controls.descriptionRegex.value,
        episodeMatchRegex: form.controls.episodeMatchRegex.value,
        episodeIncludeTitleRegex: form.controls.episodeIncludeTitleRegex.value,
        defaultSubject: form.controls.defaultSubject.value,
        ignoreAllEpisodes: form.controls.ignoreAllEpisodes.value,
        youTubeChannelId: form.controls.youTubeChannelId.value,
        youTubePlaylistId: form.controls.youTubePlaylistId.value,
        ignoredAssociatedSubjects: asStringArray(form.controls.ignoredAssociatedSubjects.value),
        ignoredSubjects: asStringArray(form.controls.ignoredSubjects.value),
        lang: form.controls.lang.value,
        knownTerms: asStringArray(form.controls.knownTerms.value),
        minimumDuration: asEmptyString(form.controls.minimumDuration.value),
        enrichmentHashTags: asStringArray(form.controls.enrichmentHashTags.value),
        hashTag: asEmptyString(form.controls.hashTag.value),
      };

      var changes = this.getChanges(this.originalPodcast!, update);
      if (Object.keys(changes).length == 0) {
        this.dialogRef.close({ noChange: true });
      } else {
        this.send(this.podcastId!, changes);
      }
    }
  }

  getChanges(prev: Podcast, now: Podcast): EditPodcastPost {
    return getPodcastChanges(prev, now);
  }

  send(id: string, changes: EditPodcastPost) {
    const dialogRef = this.dialog.open(EditPodcastSendComponent, { disableClose: true, autoFocus: true });
    dialogRef.componentInstance.submit(id, changes);
    dialogRef.afterClosed().subscribe(async result => {
      if (result.updated) {
        this.dialogRef.close({ updated: true, response: result.response });
      }
    });
  }

  onDefaultSubjectDropdownOpenChange(opened: boolean) {
    if (!opened) {
      this.defaultSubjectFilterTerm.set('');
    }
  }

  onIgnoredSubjectsDropdownOpenChange(opened: boolean) {
    if (!opened) {
      this.ignoredSubjectsFilterTerm.set('');
    }
  }

  onDefaultSubjectDropdownKeydown(event: KeyboardEvent) {
    this.applyFilterKey(event, this.defaultSubjectFilterTerm);
  }

  onIgnoredSubjectsDropdownKeydown(event: KeyboardEvent) {
    this.applyFilterKey(event, this.ignoredSubjectsFilterTerm);
  }

  filteredDefaultSubjects() {
    return filterSubjectsByTerm(this.defaultSubjects(), this.defaultSubjectFilterTerm());
  }

  filteredIgnoredSubjects() {
    const selected = this.form()?.controls.ignoredSubjects.value ?? [];
    const selectedSet = new Set(selected);
    return filterKeepingSelectedInOrder(this.ignoredSubjects(), this.ignoredSubjectsFilterTerm(), selectedSet);
  }

  applyFilterKey(event: KeyboardEvent, filterTerm: WritableSignal<string>) {
    if (!this.enableDesktopSubjectTypingFilter) {
      return;
    }
    if (event.ctrlKey || event.altKey || event.metaKey) {
      return;
    }

    if (event.key === 'Backspace') {
      const value = filterTerm();
      if (value.length > 0) {
        filterTerm.set(value.substring(0, value.length - 1));
      }
      event.preventDefault();
      return;
    }

    if (event.key === 'Escape') {
      filterTerm.set('');
      event.preventDefault();
      return;
    }

    if (event.key.length === 1) {
      filterTerm.set(filterTerm() + event.key);
      event.preventDefault();
    }
  }

}
