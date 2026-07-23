import { Component, Inject, ChangeDetectionStrategy, signal, WritableSignal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { AuthServiceWrapper } from '../auth-service-wrapper.class';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Podcast } from '../podcast.interface';
import { firstValueFrom, forkJoin } from 'rxjs';
import { environment } from './../../environments/environment';
import { Subject } from '../subject.interface';
import { PodcastServiceType } from "../podcast-service-type.enum";
import { AddPodcastSendComponent } from '../add-podcast-send/add-podcast-send.component';
import { AddPodcastForm } from '../add-podcast-form.interface';
import { AddPodcastPost } from '../add-podcast-post.interface';
import { MatInputModule } from '@angular/material/input';
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
  selector: 'app-add-podcast-dialog-component',
  imports: [
    MatDialogModule,
    MatProgressSpinnerModule,
    MatButtonModule,
    ReactiveFormsModule,
    MatTabsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatCheckboxModule,
    KeyValuePipe,
    MatMenuModule,
    MatIconModule
  ],
  templateUrl: './add-podcast-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './add-podcast-dialog.component.sass'
})
export class AddPodcastDialogComponent {
  readonly enableDesktopSubjectTypingFilter: boolean = typeof window !== 'undefined'
    && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  protected readonly noCompareFunction = noCompareFunction;

  podcastName: string;
  readonly isLoading = signal<boolean>(true);
  readonly isInError = signal<boolean>(false);
  readonly notFound = signal<boolean>(false);
  podcastServices = Object
    .values(PodcastServiceType)
    .filter(value => typeof value !== 'number')
    .map(x => x as keyof typeof PodcastServiceType)

  readonly form = signal<FormGroup<AddPodcastForm> | undefined>(undefined);
  originalPodcast: Podcast | undefined;
  readonly defaultSubjects = signal<string[]>([]);
  readonly ignoredSubjects = signal<string[]>([]);
  readonly defaultSubjectFilterTerm = signal<string>('');
  readonly ignoredSubjectsFilterTerm = signal<string>('');
  readonly languages = signal<{ [key: string]: string }>({});
  readonly titleRegexPresets = signal<NamedRegexPreset[]>([]);
  readonly descriptionRegexPresets = signal<NamedRegexPreset[]>([]);
  podcastId: string;
  readonly highlightSubjectsTab = signal<boolean>(false);

  constructor(
    private auth: AuthServiceWrapper,
    private http: HttpClient,
    private regexPresetsService: RegexPresetsService,
    private dialogRef: MatDialogRef<AddPodcastDialogComponent, any>,
    @Inject(MAT_DIALOG_DATA) public data: {
      podcastName: string,
      defaultSubjectFromEpisode?: string,
      forceBypassShortEpisodeChecking?: boolean,
      podcastId: string,
      episodeId?: string,
      episodeLangUnset?: boolean
    },
    private dialog: MatDialog,
  ) {
    this.podcastName = data.podcastName;
    this.podcastId = data.podcastId;
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
      const podcastEndpoint = new URL(`/podcast/${this.podcastId}`, environment.api).toString();
      const subjectsEndpoint = new URL("/subjects", environment.api).toString();
      const languagesEndpoint = new URL("/languages", environment.api).toString();

      var resp = await firstValueFrom(forkJoin(
        {
          podcast: this.http.get<Podcast>(podcastEndpoint, { headers: headers, observe: "response" }),
          subjects: this.http.get<Subject[]>(subjectsEndpoint, { headers: headers }),
          languages: this.http.get<{ [key: string]: string }>(languagesEndpoint, { headers: headers })
        }
      ));
      if (resp.podcast.status == 200 && resp.podcast.body) {
        this.originalPodcast = resp.podcast.body;
        const form = new FormGroup<AddPodcastForm>({
          podcastName: new FormControl(this.podcastName, { nonNullable: true }),
          ...buildPodcastFormControls(resp.podcast.body)
        });
        this.form.set(form);
        if (this.data.forceBypassShortEpisodeChecking) {
          form.controls.bypassShortEpisodeChecking.setValue(true);
        }

        const desiredDefaultSubject = this.data.defaultSubjectFromEpisode ?? resp.podcast.body.defaultSubject;
        if (desiredDefaultSubject != null) {
          form.controls.defaultSubject.setValue(desiredDefaultSubject);
        }
        this.highlightSubjectsTab.set(this.data.defaultSubjectFromEpisode != null
          && desiredDefaultSubject != null
          && desiredDefaultSubject !== '');

        let initial: string[] = [];
        if (desiredDefaultSubject != null) {
          initial.push(desiredDefaultSubject);
        }
        this.defaultSubjects.set([...initial].concat(resp.subjects.filter(x => desiredDefaultSubject == null || desiredDefaultSubject != x.name).map(x => x.name)));
        const ignoredSubjects = resp.podcast.body.ignoredSubjects ?? [];
        this.ignoredSubjects.set(ignoredSubjects.concat(resp.subjects.filter(x => !ignoredSubjects.includes(x.name)).map(x => x.name)));
        this.languages.set(buildPodcastLanguageOptions(resp.languages));
        this.isLoading.set(false);
      } else {
        this.isLoading.set(false);
        this.isInError.set(true);
        if (resp.podcast.status == 404) {
          this.notFound.set(true);
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

  applyTitleRegexPreset(pattern: string): void {
    const form = this.form();
    if (!form) {
      return;
    }

    this.regexPresetsService.applyTitleRegexPreset(
      pattern,
      form.controls.titleRegex,
      form.controls.podcastName.value ?? this.podcastName,
    );
  }

  applyDescriptionRegexPreset(pattern: string): void {
    const form = this.form();
    if (!form) {
      return;
    }

    this.regexPresetsService.applyDescriptionRegexPreset(
      pattern,
      form.controls.descriptionRegex,
      form.controls.podcastName.value ?? this.podcastName,
    );
  }

  onSubmit() {
    const form = this.form();
    if (form?.valid) {
      const update: Podcast = {
        name: form.controls.podcastName.value,
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

  getChanges(prev: Podcast, now: Podcast): AddPodcastPost {
    const changes: AddPodcastPost = getPodcastChanges(prev, now);
    if (prev.name != now.name) changes.podcastName = now.name;
    return changes;
  }

  send(podcastId: string, changes: AddPodcastPost) {
    const dialogRef = this.dialog.open(AddPodcastSendComponent, { disableClose: true, autoFocus: true });
    dialogRef.componentInstance.submit(podcastId, changes);
    dialogRef.afterClosed().subscribe(async result => {
      if (result.updated) {
        await this.applyEpisodeLanguageFromPodcast(podcastId, changes);
        this.dialogRef.close({ updated: true, response: result.response });
      }
    });
  }

  private async applyEpisodeLanguageFromPodcast(podcastId: string, changes: AddPodcastPost) {
    if (!this.data.episodeLangUnset || !this.data.episodeId) {
      return;
    }

    const podcastLang = changes.lang;
    if (!podcastLang || podcastLang === 'unset') {
      return;
    }

    try {
      const token = await firstValueFrom(this.auth.authService.getAccessTokenSilently({
        authorizationParams: {
          audience: `https://api.cultpodcasts.com/`,
          scope: 'curate'
        }
      }));
      let headers: HttpHeaders = new HttpHeaders();
      headers = headers.set('Authorization', 'Bearer ' + token);
      const episodeEndpoint = new URL(`/episode/${podcastId}/${this.data.episodeId}`, environment.api).toString();
      await firstValueFrom(this.http.post(episodeEndpoint, { lang: podcastLang }, { headers }));
    } catch (error) {
      console.error('Failed to apply podcast default language to episode.', error);
    }
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

  onTabChange(selectedIndex: number) {
    if (selectedIndex === 2) {
      this.highlightSubjectsTab.set(false);
    }
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
